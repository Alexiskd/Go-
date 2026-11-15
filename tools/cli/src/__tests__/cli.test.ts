/**
 * Tests du CLI go- de bout en bout : un vrai projet est généré dans un dossier
 * temporaire, lié au dépôt GO- local, compilé avec TypeScript puis testé.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTestFiles, main, planDev, type Io } from '../index.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

function makeIo(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = { cwd, env: process.env, out: (l) => out.push(l), err: (l) => err.push(l), stdio: 'ignore' };
  return { io, out, err, text: () => out.join('\n'), errors: () => err.join('\n') };
}

/** Simule « npm install » hors ligne : lie les packages GO- du dépôt et les workspaces du projet. */
function linkDependencies(project: string, slug: string) {
  const nm = join(project, 'node_modules');
  mkdirSync(join(nm, '@go-'), { recursive: true });
  mkdirSync(join(nm, '@types'), { recursive: true });
  mkdirSync(join(nm, `@${slug}`), { recursive: true });
  for (const p of ['types', 'shared', 'core', 'config', 'contracts', 'runtime', 'security', 'api-client', 'testing']) {
    symlinkSync(join(REPO, 'packages', p), join(nm, '@go-', p), 'dir');
  }
  symlinkSync(join(REPO, 'node_modules', '@types', 'node'), join(nm, '@types', 'node'), 'dir');
  symlinkSync(join(project, 'packages', 'contracts'), join(nm, `@${slug}`, 'contracts'), 'dir');
}

test('aide, version et erreurs d’usage', async () => {
  const a = makeIo(tmpdir());
  assert.equal(await main(['--version'], a.io), 0);
  assert.match(a.text(), /^\d+\.\d+\.\d+$/);
  const b = makeIo(tmpdir());
  assert.equal(await main([], b.io), 2);
  assert.match(b.text(), /Usage : go- <commande>/);
  const c = makeIo(tmpdir());
  assert.equal(await main(['deploy'], c.io), 2);
  assert.match(c.errors(), /Commande inconnue/);
  const d = makeIo(tmpdir());
  assert.equal(await main(['build', '--inconnu'], d.io), 2);
  const e = makeIo(mkdtempSync(join(tmpdir(), 'go-cli-')));
  assert.equal(await main(['build'], e.io), 1);
  assert.match(e.errors(), /Aucun projet GO- trouvé/);
});

test('init → build → test → create package/module → generate openapi/types', async () => {
  const base = mkdtempSync(join(tmpdir(), 'go-cli-'));
  const project = join(base, 'mon-app');

  const init = makeIo(base);
  assert.equal(await main(['init', 'mon-app', '--local', REPO], init.io), 0, init.errors());
  assert.match(init.text(), /Projet « mon-app » créé/);
  const pkg = JSON.parse(readFileSync(join(project, 'apps/api/package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@go-/core'], `file:${join(REPO, 'packages', 'core')}`);

  const again = makeIo(base);
  assert.equal(await main(['init', 'mon-app'], again.io), 1);
  assert.match(again.errors(), /n'est pas vide/);

  linkDependencies(project, 'mon-app');
  const tested = makeIo(project);
  assert.equal(await main(['test'], tested.io), 0, tested.errors());
  assert.ok(existsSync(join(project, 'apps/api/dist/main.js')));
  assert.deepEqual(findTestFiles(project).map((f) => f.slice(project.length + 1)), ['apps/api/dist/__tests__/api.test.js']);

  const createPkg = makeIo(join(project, 'apps'));
  assert.equal(await main(['create', 'package', 'Billing', '--description', 'Facturation'], createPkg.io), 0, createPkg.errors());
  assert.equal(JSON.parse(readFileSync(join(project, 'packages/billing/package.json'), 'utf8')).name, '@mon-app/billing');
  assert.ok(JSON.parse(readFileSync(join(project, 'tsconfig.json'), 'utf8')).references.some((r: { path: string }) => r.path === 'packages/billing'));

  const createMod = makeIo(project);
  assert.equal(await main(['create', 'module', 'notifications', '--dir', 'apps/api'], createMod.io), 0, createMod.errors());
  assert.ok(existsSync(join(project, 'apps/api/src/modules/notifications.module.ts')));
  const conflict = makeIo(project);
  assert.equal(await main(['create', 'module', 'notifications', '--dir', 'apps/api'], conflict.io), 1);
  assert.match(conflict.errors(), /déjà existant/);

  const retest = makeIo(project);
  assert.equal(await main(['test'], retest.io), 0, retest.errors());
  assert.equal(findTestFiles(project).length, 3);

  const openapi = makeIo(project);
  assert.equal(await main(['generate', 'openapi', '--out', 'docs/openapi.json'], openapi.io), 0, openapi.errors());
  const doc = JSON.parse(readFileSync(join(project, 'docs/openapi.json'), 'utf8'));
  assert.ok(doc.paths['/api/v1/hello'].get);

  const types = makeIo(project);
  assert.equal(await main(['generate', 'types', 'docs/openapi.json', '--out', 'packages/billing/src/api-types.ts'], types.io), 0, types.errors());
  writeFileSync(
    join(project, 'packages/billing/src/use-types.ts'),
    "import type { Operations } from './api-types.js';\nexport const sample: Operations['hello']['response'] = { message: 'ok' };\n",
  );
  const finalBuild = makeIo(project);
  assert.equal(await main(['build'], finalBuild.io), 0, 'les types générés doivent compiler');

  assert.throws(() => planDev(project, 'web'), /introuvable dans apps\/ \(disponibles : api\)/);
  assert.equal(planDev(project, 'api').entry, join(project, 'apps/api/dist/main.js'));

  const doctor = makeIo(project);
  const doctorCode = await main(['doctor'], doctor.io);
  assert.equal(doctorCode, doctor.text().includes('✖') ? 1 : 0);
  assert.match(doctor.text(), /✔ projet GO-/);
  assert.match(doctor.text(), /✔ aucune dépendance Java\/JVM/);
});

test('generate : erreurs explicites', async () => {
  const base = mkdtempSync(join(tmpdir(), 'go-cli-'));
  const io = makeIo(base);
  assert.equal(await main(['generate', 'types', 'absent.json'], io.io), 1);
  assert.match(io.errors(), /Fichier introuvable/);
  writeFileSync(join(base, 'swagger.json'), JSON.stringify({ swagger: '2.0' }));
  const v2 = makeIo(base);
  assert.equal(await main(['generate', 'types', 'swagger.json'], v2.io), 1);
  assert.match(v2.errors(), /OpenAPI 3/);
});
