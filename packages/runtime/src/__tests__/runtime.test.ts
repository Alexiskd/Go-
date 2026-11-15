import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, createLogger, type LogRecord } from '@go-/core';
import { defineConfig } from '@go-/config';
import { defineContract, defineEndpoint } from '@go-/contracts';
import { s } from '@go-/shared';
import { assertNodeVersion, bootstrap, compareVersions, createHttpServer, httpModule, runApp, HTTP_SERVER } from '../index.js';

const silent = () => {
  const records: LogRecord[] = [];
  return { records, logger: createLogger({ level: 'debug', sink: (r) => records.push(r) }) };
};

test('versions de Node', () => {
  assert.equal(compareVersions('22.12.0', '22.9.1'), 1);
  assert.equal(compareVersions('v20.0.0', '22.0.0'), -1);
  assert.throws(() => assertNodeVersion('22.12.0', '20.10.0'), /Node.js 22.12.0/);
});

test('runApp : arrêt propre sur signal, code de sortie', async () => {
  const proc = new EventEmitter();
  const trace: string[] = [];
  const app = createApp({ name: 't', env: 'test', logger: silent().logger, modules: [{ name: 'm', onStop: () => void trace.push('stop') }] });
  const exited = new Promise<number>((resolve) => runApp(app, { process: proc, exit: resolve }).then(() => proc.emit('SIGTERM', 'SIGTERM')));
  assert.equal(await exited, 0);
  assert.deepEqual(trace, ['stop']);
  assert.equal(proc.listenerCount('SIGTERM'), 0);
});

test('runApp : erreur fatale → arrêt et code 1', async () => {
  const proc = new EventEmitter();
  const app = createApp({ name: 't', env: 'test', logger: silent().logger });
  const exited = new Promise<number>((resolve) => runApp(app, { process: proc, exit: resolve }).then(() => proc.emit('unhandledRejection', new Error('boom'))));
  assert.equal(await exited, 1);
});

const contract = defineContract({
  name: 'test', version: 'v1', basePath: '/api',
  endpoints: {
    echo: defineEndpoint({ method: 'POST', path: '/echo', summary: 'echo', auth: false, body: s.object({ n: s.number().int() }), response: s.object({ n: s.number() }), status: 201 }),
    item: defineEndpoint({ method: 'GET', path: '/items/:id', summary: 'item', auth: 'items:read', params: s.object({ id: s.number().int() }), query: s.object({ full: s.boolean().default(false) }), response: s.object({ id: s.number(), full: s.boolean() }) }),
    leak: defineEndpoint({ method: 'GET', path: '/leak', summary: 'leak', auth: false, response: s.object({ name: s.string() }) }),
    broken: defineEndpoint({ method: 'GET', path: '/broken', summary: 'broken', auth: false, response: s.object({ name: s.string() }) }),
  },
});

test('serveur HTTP : routage, validation, auth, permissions, nettoyage des réponses', async (t) => {
  const { logger } = silent();
  const http = createHttpServer({
    contract,
    logger,
    authenticate: (req) => (req.headers.authorization === 'Bearer ok' ? { id: 'u1', role: 'reader' } : req.headers.authorization === 'Bearer nope' ? { id: 'u2' } : undefined),
    authorize: (p, perm) => p.role === 'reader' && perm === 'items:read',
    cors: { headers: (origin): Record<string, string> => (origin === 'https://app.fr' ? { 'Access-Control-Allow-Origin': origin } : {}) },
    headers: { 'X-Content-Type-Options': 'nosniff' },
    handlers: {
      echo: ({ body }) => ({ n: body.n }),
      item: ({ params, query }, ctx) => {
        ctx.setHeader('X-Principal', ctx.principal!.id);
        return { id: params.id, full: query.full };
      },
      leak: () => ({ name: 'a', passwordHash: 'secret' }) as { name: string },
      broken: () => ({ name: 42 }) as unknown as { name: string },
    },
    extraRoutes: { 'GET /openapi.json': () => ({ openapi: '3.1.0' }) },
  });
  const { url } = await http.listen(0, '127.0.0.1');
  t.after(() => http.close());
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(url + path, init);
    return { status: res.status, headers: res.headers, body: (res.status === 204 ? undefined : await res.json()) as any };
  };
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const created = await call('/api/echo', json({ n: 2 }));
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { n: 2 });
  assert.equal(created.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(created.headers.get('x-request-id'));

  const invalid = await call('/api/echo', json({ n: 1.5 }));
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.code, 'VALIDATION_FAILED');
  assert.equal(invalid.body.details.issues[0].path, 'body.n');

  assert.equal((await call('/api/echo', { method: 'POST', body: '{' , headers: { 'content-type': 'application/json' } })).status, 400);
  assert.equal((await call('/api/echo', { method: 'POST', body: 'n=1' })).status, 400);

  assert.equal((await call('/api/items/7')).status, 401);
  assert.equal((await call('/api/items/7', { headers: { authorization: 'Bearer nope' } })).status, 403);
  const item = await call('/api/items/7?full=true', { headers: { authorization: 'Bearer ok', 'x-request-id': 'req-42' } });
  assert.deepEqual(item.body, { id: 7, full: true });
  assert.equal(item.headers.get('x-principal'), 'u1');
  assert.equal(item.headers.get('x-request-id'), 'req-42');
  const badParam = await call('/api/items/abc', { headers: { authorization: 'Bearer ok' } });
  assert.equal(badParam.status, 422);

  assert.deepEqual((await call('/api/leak')).body, { name: 'a' });
  const broken = await call('/api/broken');
  assert.equal(broken.status, 500);
  assert.equal(broken.body.message, 'Erreur interne');

  const notFound = await call('/api/nope');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body.code, 'NOT_FOUND');

  const preflight = await fetch(url + '/api/echo', { method: 'OPTIONS', headers: { origin: 'https://app.fr' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://app.fr');
  assert.deepEqual((await call('/openapi.json')).body, { openapi: '3.1.0' });
});

test('serveur HTTP : refuse un contrat avec permissions sans authorize', () => {
  assert.throws(() => createHttpServer({ contract, logger: silent().logger, authenticate: () => undefined, handlers: {} as never }), /authorize/);
});

test('bootstrap + httpModule : configuration depuis .env, démarrage et arrêt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'go-boot-'));
  writeFileSync(join(dir, '.env'), 'APP_PORT=0\nAPP_GREETING=salut');
  const config = defineConfig({ port: s.number().int().min(0), greeting: s.string() });
  const pingContract = defineContract({ name: 'p', version: 'v1', basePath: '', endpoints: { ping: defineEndpoint({ method: 'GET', path: '/ping', summary: 'ping', response: s.object({ msg: s.string() }) }) } });
  const { app, config: values } = bootstrap({
    name: 'boot', config, envPrefix: 'app', cwd: dir, env: { NODE_ENV: 'test' }, logger: silent().logger,
    modules: (c) => [httpModule({ port: c.port, host: '127.0.0.1', server: () => ({ contract: pingContract, handlers: { ping: () => ({ msg: c.greeting }) } }) })],
  });
  assert.equal(values.greeting, 'salut');
  await app.start();
  const { port } = app.container.resolve(HTTP_SERVER).server.address() as { port: number };
  const res = await fetch(`http://127.0.0.1:${port}/ping`);
  assert.deepEqual(await res.json(), { msg: 'salut' });
  await app.stop();
  assert.equal(app.container.resolve(HTTP_SERVER).server.listening, false);
});

test('serveur HTTP : compression, ETag/304, Cache-Control, chemins avec / final', async (t) => {
  const { gunzipSync, brotliDecompressSync } = await import('node:zlib');
  const { request } = await import('node:http');
  const big = { items: Array.from({ length: 300 }, (_, i) => ({ name: `astre-${i}` })) };
  const c = defineContract({
    name: 'perf', version: 'v1', basePath: '/api',
    endpoints: {
      list: defineEndpoint({ method: 'GET', path: '/list', summary: 'l', response: s.object({ items: s.array(s.object({ name: s.string() })) }), cacheControl: 'public, max-age=60' }),
      small: defineEndpoint({ method: 'GET', path: '/small', summary: 's', response: s.object({ ok: s.boolean() }) }),
    },
  });
  const http = createHttpServer({ contract: c, logger: silent().logger, handlers: { list: () => big, small: () => ({ ok: true }) } });
  const { port } = await http.listen(0, '127.0.0.1');
  t.after(() => http.close());
  // Requête brute : fetch décompresserait automatiquement.
  const raw = (path: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
      request({ host: '127.0.0.1', port, path, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (x: Buffer) => chunks.push(x));
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
      }).on('error', reject).end();
    });

  const br = await raw('/api/list', { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(br.headers['content-encoding'], 'br');
  assert.equal(br.headers['vary'], 'Accept-Encoding');
  assert.equal(br.headers['cache-control'], 'public, max-age=60');
  assert.deepEqual(JSON.parse(brotliDecompressSync(br.body).toString()), big);
  assert.ok(br.body.length < JSON.stringify(big).length / 4);

  const gz = await raw('/api/list', { 'accept-encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.deepEqual(JSON.parse(gunzipSync(gz.body).toString()), big);

  const plain = await raw('/api/list');
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.equal(Number(plain.headers['content-length']), JSON.stringify(big).length);

  const small = await raw('/api/small/', { 'accept-encoding': 'br' });
  assert.equal(small.status, 200, 'le / final est accepté');
  assert.equal(small.headers['content-encoding'], undefined, 'pas de compression sous le seuil');
  assert.equal(small.headers['cache-control'], 'no-store');

  const etag = plain.headers['etag'] as string;
  assert.match(etag, /^W\/"/);
  const notModified = await raw('/api/list', { 'if-none-match': etag });
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body.length, 0);
  assert.equal((await raw('/api/list', { 'if-none-match': 'W/"autre"' })).status, 200);
});

test('serveur HTTP : compression désactivable, endpoints authentifiés en private', async (t) => {
  const c = defineContract({
    name: 'p', version: 'v1', basePath: '',
    endpoints: { me: defineEndpoint({ method: 'GET', path: '/me', summary: 'me', auth: true, response: s.object({ blob: s.string() }) }) },
  });
  const http = createHttpServer({
    contract: c, logger: silent().logger, compression: false, etag: false,
    authenticate: () => ({ id: 'u' }),
    handlers: { me: () => ({ blob: 'x'.repeat(5000) }) },
  });
  const { url } = await http.listen(0, '127.0.0.1');
  t.after(() => http.close());
  const res = await fetch(url + '/me', { headers: { 'accept-encoding': 'br' } });
  assert.equal(res.headers.get('content-encoding'), null);
  assert.equal(res.headers.get('etag'), null);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
});

test('live : version déployée, flux SSE, en-tête X-Go-Version, fermeture des flux', async () => {
  const { deploymentInfo } = await import('../index.js');
  const info = deploymentInfo({ RENDER_GIT_COMMIT: '0123456789abcdef0123', RENDER_GIT_BRANCH: 'main', IS_PULL_REQUEST: 'false' });
  assert.equal(info.version, '0123456789ab');
  assert.equal(deploymentInfo({}).version, 'dev');
  assert.equal(deploymentInfo({ GO_VERSION: 'pr-12', RENDER_GIT_COMMIT: 'x' }).version, 'pr-12');

  const c = defineContract({ name: 'l', version: 'v1', basePath: '', endpoints: { ping: defineEndpoint({ method: 'GET', path: '/ping', summary: 'p', response: s.object({ ok: s.boolean() }) }) } });
  const http = createHttpServer({ contract: c, logger: silent().logger, live: info, handlers: { ping: () => ({ ok: true }) } });
  const { url } = await http.listen(0, '127.0.0.1');
  const ping = await fetch(url + '/ping');
  assert.equal(ping.headers.get('x-go-version'), '0123456789ab');
  assert.equal(((await (await fetch(url + '/__go/version')).json()) as { version: string }).version, '0123456789ab');

  const stream = await fetch(url + '/__go/live');
  assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = stream.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: version\ndata: \{"version":"0123456789ab"/);
  assert.equal(http.live!.size, 1);
  const started = Date.now();
  await http.close();
  assert.ok(Date.now() - started < 2000, 'les flux ne bloquent pas l’arrêt');
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    rest += new TextDecoder().decode(value);
  }
  assert.match(rest, /event: shutdown/);
});
