/**
 * Test de bout en bout du superviseur : un vrai dépôt Git local joue le rôle de GitHub,
 * des webhooks signés déclenchent les mises à jour, et le trafic est vérifié à chaque étape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger, type LogRecord } from '@go-/core';
import { authenticatedUrl, loadHotConfig, redactSecrets, Supervisor, toAction, verifyGithubSignature, type HotConfig } from '../index.js';

const SECRET = 'secret-du-webhook';
const sign = (body: string) => 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

test('signature GitHub et traduction des événements', () => {
  const body = Buffer.from('{"a":1}');
  assert.equal(verifyGithubSignature(SECRET, body, sign('{"a":1}')), true);
  assert.equal(verifyGithubSignature(SECRET, body, sign('{"a":2}')), false);
  assert.equal(verifyGithubSignature(SECRET, body, undefined), false);

  const opts = { branch: 'main', allowedAuthors: [] as string[] };
  assert.deepEqual(toAction('push', { ref: 'refs/heads/main', after: 'abc' }, opts), { type: 'production', sha: 'abc' });
  assert.equal(toAction('push', { ref: 'refs/heads/dev', after: 'abc' }, opts).type, 'ignore');
  const pr = (action: string, headRepo = 'me/app', login = 'claude') => ({
    action, number: 4, repository: { full_name: 'me/app' },
    pull_request: { head: { sha: 's', ref: 'feat', repo: { full_name: headRepo } }, user: { login } },
  });
  assert.deepEqual(toAction('pull_request', pr('synchronize'), opts), { type: 'preview', pr: 4, sha: 's', ref: 'feat', author: 'claude' });
  assert.deepEqual(toAction('pull_request', pr('closed'), opts), { type: 'close-preview', pr: 4 });
  assert.match((toAction('pull_request', pr('opened', 'pirate/app'), opts) as { reason: string }).reason, /fork/);
  assert.match((toAction('pull_request', pr('opened', 'me/app', 'inconnu'), { branch: 'main', allowedAuthors: ['claude'] }) as { reason: string }).reason, /non autorisé/);
});

test('configuration et masquage des jetons', () => {
  assert.throws(() => loadHotConfig({}), /GO_HOT_REPO/);
  const c = loadHotConfig({ RENDER_GIT_REPO_SLUG: 'me/app', GO_HOT_START: 'node a.js', PORT: '10000', GO_HOT_GIT_TOKEN: 'ghp_tok' });
  assert.equal(c.repoUrl, 'https://github.com/me/app.git');
  assert.equal(authenticatedUrl(c), 'https://x-access-token:ghp_tok@github.com/me/app.git');
  assert.equal(redactSecrets('fatal: https://x-access-token:ghp_tok@github.com ghp_tok', ['ghp_tok']), 'fatal: https://x-access-token:***@github.com ***');
});

const SERVER = (label: string) => `
const http = require('node:http');
http.createServer((req, res) => {
  if (req.url === '/api/v1/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ version: process.env.GO_VERSION })); }
  res.end(${JSON.stringify(label)});
}).listen(Number(process.env.API_PORT), process.env.API_HOST);
process.on('SIGTERM', () => process.exit(0));
`;

test('mise à jour à chaud, previews de PR, échec sans coupure', { timeout: 120_000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'go-hot-'));
  const origin = join(root, 'origin');
  mkdirSync(origin);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();
  const commit = (file: string, content: string, message: string) => {
    writeFileSync(join(origin, file), content);
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', message);
    return git(origin, 'rev-parse', 'HEAD');
  };
  git(origin, 'init', '-q', '-b', 'main');
  writeFileSync(join(origin, 'package.json'), '{"name":"app","private":true}');
  commit('server.js', SERVER('v1'), 'v1');

  const initial = join(root, 'initial');
  git(root, 'clone', '-q', `file://${origin}`, initial);
  mkdirSync(join(initial, 'node_modules', 'marqueur'), { recursive: true });

  const records: LogRecord[] = [];
  const config: HotConfig = {
    ...loadHotConfig({ GO_HOT_REPO: `file://${origin}`, GO_HOT_START: 'node server.js' }),
    port: 0,
    webhookSecret: SECRET,
    releasesDir: join(root, 'releases'),
    installCommand: 'echo installe > installed.txt',
    buildCommand: 'true',
    maxPreviews: 1,
    syncOnBoot: false,
    healthTimeoutMs: 15_000,
  };
  const supervisor = new Supervisor(config, createLogger({ level: 'debug', sink: (r) => records.push(r) }));
  const { port } = await supervisor.start({ initialDir: initial });
  t.after(() => supervisor.stop());
  const base = `http://127.0.0.1:${port}`;
  const text = async (path: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, { headers, redirect: 'manual' });
    return { status: res.status, body: await res.text(), headers: res.headers };
  };
  const hook = (event: string, payload: unknown, signature?: string) => {
    const body = JSON.stringify(payload);
    return fetch(base + '/__go/hook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-github-event': event, 'x-hub-signature-256': signature ?? sign(body) } });
  };

  assert.equal((await text('/')).body, 'v1');

  // Webhook non signé : refusé.
  assert.equal((await hook('push', { ref: 'refs/heads/main', after: 'x' }, 'sha256=faux')).status, 401);

  // Fusion dans main → nouvelle version en ligne sans redémarrer le superviseur.
  const v2 = commit('server.js', SERVER('v2'), 'v2');
  const accepted = await hook('push', { ref: 'refs/heads/main', after: v2 });
  assert.equal(accepted.status, 202);
  await supervisor.idle();
  assert.equal((await text('/')).body, 'v2');
  assert.equal(supervisor.status().production?.sha, v2);
  assert.ok(existsSync(initial), 'le build initial n’est jamais supprimé');
  const releaseDir = records.find((r) => /dépendances inchangées/.test(r.msg));
  assert.ok(releaseDir, 'node_modules réutilisés quand les dépendances ne changent pas');
  assert.equal(JSON.parse((await text('/api/v1/health')).body).version, v2.slice(0, 12));

  // PR 7 : preview lancée à côté de la production, choisie par cookie ou en-tête.
  git(origin, 'checkout', '-q', '-b', 'feature');
  const pr7 = commit('server.js', SERVER('preview-7'), 'pr7');
  git(origin, 'checkout', '-q', 'main');
  const prPayload = (action: string, number: number, sha: string, ref: string, headRepo = 'me/app') => ({
    action, number, repository: { full_name: 'me/app' }, pull_request: { head: { sha, ref, repo: { full_name: headRepo } }, user: { login: 'claude' } },
  });
  await hook('pull_request', prPayload('opened', 7, pr7, 'feature'));
  await supervisor.idle();
  const select = await text('/pr/7');
  assert.equal(select.status, 302);
  const cookie = select.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal(cookie, 'go_preview=7');
  const preview = await text('/', { cookie });
  assert.equal(preview.body, 'preview-7');
  assert.equal(preview.headers.get('x-go-preview'), '7');
  assert.equal((await text('/', { 'x-go-preview': '7' })).body, 'preview-7');
  assert.equal((await text('/')).body, 'v2', 'la production n’est pas affectée');
  assert.equal(JSON.parse((await text('/api/v1/health', { cookie })).body).version, `pr7-${pr7.slice(0, 12)}`);

  // PR depuis un fork : ignorée.
  const fork = await (await hook('pull_request', prPayload('opened', 9, pr7, 'feature', 'pirate/app'))).json() as { accepted: boolean; reason: string };
  assert.equal(fork.accepted, false);

  // Limite de previews : la PR 8 remplace la plus ancienne.
  git(origin, 'checkout', '-q', '-b', 'feature-8');
  const pr8 = commit('server.js', SERVER('preview-8'), 'pr8');
  git(origin, 'checkout', '-q', 'main');
  await hook('pull_request', prPayload('opened', 8, pr8, 'feature-8'));
  await supervisor.idle();
  assert.deepEqual(supervisor.status().previews.map((p) => p.pr), [8]);
  assert.equal((await text('/', { cookie })).body, 'v2', 'preview disparue : retour à la production');

  // PR fermée : preview arrêtée.
  await hook('pull_request', prPayload('closed', 8, pr8, 'feature-8'));
  await supervisor.idle();
  assert.equal(supervisor.status().previews.length, 0);
  assert.equal((await text('/pr/8')).status, 404);

  // Version cassée : la production reste en ligne.
  const broken = commit('server.js', 'process.exit(1)', 'cassé');
  await hook('push', { ref: 'refs/heads/main', after: broken });
  await supervisor.idle();
  assert.equal((await text('/')).body, 'v2');
  assert.match(supervisor.status().errors.production!, /arrêté pendant le démarrage/);

  // Statut public.
  const status = JSON.parse((await text('/__go/hot')).body);
  assert.equal(status.production.sha, v2);
});
