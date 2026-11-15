import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileConflictError, addProjectReference, assertPackageName, moduleTemplate, openApiToTs, packageTemplate, render, schemaToTs,
  workspaceTemplate, writeFiles,
} from '../index.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'go-gen-'));

test('render : variables connues uniquement', () => {
  assert.equal(render('Bonjour {{ name }} / {{name}}', { name: 'GO-' }), 'Bonjour GO- / GO-');
  assert.throws(() => render('{{x}}', {}), /inconnue/);
});

test('writeFiles : tout ou rien, refus des chemins sortants, force', () => {
  const dir = tmp();
  writeFiles(dir, [{ path: 'a/b.txt', content: '1' }]);
  assert.throws(() => writeFiles(dir, [{ path: 'c.txt', content: '2' }, { path: 'a/b.txt', content: '3' }]), FileConflictError);
  assert.equal(existsSync(join(dir, 'c.txt')), false);
  writeFiles(dir, [{ path: 'a/b.txt', content: '3' }], { force: true });
  assert.equal(readFileSync(join(dir, 'a/b.txt'), 'utf8'), '3');
  assert.throws(() => writeFiles(dir, [{ path: '../evil.txt', content: 'x' }]), /hors de la cible/);
  assert.deepEqual(writeFiles(dir, [{ path: 'd.txt', content: '' }], { dryRun: true }), ['d.txt']);
  assert.equal(existsSync(join(dir, 'd.txt')), false);
});

test('addProjectReference est idempotent', () => {
  const file = join(tmp(), 'tsconfig.json');
  writeFileSync(file, JSON.stringify({ files: [] }));
  assert.equal(addProjectReference(file, 'packages/x'), true);
  assert.equal(addProjectReference(file, 'packages/x'), false);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).references, [{ path: 'packages/x' }]);
});

test('templates : noms validés et fichiers attendus', () => {
  assert.throws(() => assertPackageName('Mon Projet'), /invalide/);
  assert.deepEqual(workspaceTemplate({ name: 'mon-projet' }).map((f) => f.path).filter((p) => p.endsWith('.ts')).sort(), [
    'apps/api/src/__tests__/api.test.ts', 'apps/api/src/app.ts', 'apps/api/src/config.ts', 'apps/api/src/main.ts', 'packages/contracts/src/index.ts',
  ]);
  const pkg = packageTemplate({ name: 'PaymentGateway', scope: '@acme' });
  assert.equal(JSON.parse(pkg[0]!.content).name, '@acme/payment-gateway');
  assert.match(pkg[2]!.content, /export function paymentGatewayInfo/);
  const mod = moduleTemplate({ name: 'billing service' });
  assert.deepEqual(mod.map((f) => f.path), ['src/modules/billing-service.module.ts', 'src/__tests__/billing-service.module.test.ts']);
  assert.match(mod[0]!.content, /BILLING_SERVICE_SERVICE/);
});

test('OpenAPI → TypeScript', () => {
  assert.equal(schemaToTs({ type: ['string', 'null'] }), 'string | null');
  assert.equal(schemaToTs({ type: 'array', items: { enum: ['a', 'b'] } }), 'Array<"a" | "b">');
  const ts = openApiToTs({
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    components: { schemas: { ApiError: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } } },
    paths: {
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'full', in: 'query', schema: { type: 'boolean' } }],
          responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string', description: 'Identifiant' }, 'x-tag': { type: 'integer' } }, required: ['id'] } } } } },
        },
      },
    },
  });
  assert.match(ts, /export type ApiError = \{\n  code: string;\n\}/);
  assert.match(ts, /getUser: \{/);
  assert.match(ts, /params: \{\n      id: string;/);
  assert.match(ts, /full\?: boolean;/);
  assert.match(ts, /\/\*\* Identifiant \*\//);
  assert.match(ts, /"x-tag"\?: number;/);
  assert.throws(() => openApiToTs({ swagger: '2.0' }), /OpenAPI 3/);
});
