/**
 * Test de bout en bout : l'API de référence est démarrée sur un port libre et
 * consommée par @go-/api-client, exactement comme le ferait un frontend React,
 * Next.js ou Angular. Les deux côtés partagent le même contrat @go-/contracts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClientError, createApiClient } from '@go-/api-client';
import { apiV1 } from '@go-/contracts';
import { HTTP_SERVER } from '@go-/runtime';
import { startTestApp } from '@go-/testing';
import { apiModules } from '../app.js';
import { apiConfig } from '../config.js';

const ADMIN = { email: 'admin@go.dev', password: 'mot-de-passe-admin' };

async function startApi() {
  const config = apiConfig.load({
    env: {},
    overrides: { port: 0, host: '127.0.0.1', passwordCost: 10, jwtSecret: 's'.repeat(20) + 'Q7x!pZ2#mW9@rT4$aB8%', adminEmail: ADMIN.email, adminPassword: ADMIN.password, rateLimitPerMinute: 1000, corsOrigins: ['http://localhost:3001'] },
  });
  const app = await startTestApp({ name: 'api', config, modules: apiModules(config, 'test') });
  const { port } = app.container.resolve(HTTP_SERVER).server.address() as { port: number };
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

test('parcours complet frontend ↔ backend via le contrat partagé', async (t) => {
  const { app, baseUrl } = await startApi();
  t.after(() => app.stop());
  let token: string | undefined;
  const api = createApiClient(apiV1, { baseUrl, getToken: () => token });

  const health = await api.health();
  assert.equal(health.status, 'ok');

  await assert.rejects(api.me(), (e: unknown) => e instanceof ApiClientError && e.status === 401);
  await assert.rejects(
    api.login({ body: { email: ADMIN.email, password: 'mauvais-mot-de-passe' } }),
    (e: unknown) => e instanceof ApiClientError && e.code === 'UNAUTHORIZED',
  );

  const session = await api.login({ body: ADMIN });
  assert.equal(session.tokenType, 'Bearer');
  token = session.accessToken;

  const me = await api.me();
  assert.equal(me.role, 'admin');
  assert.equal('passwordHash' in me, false);

  const created = await api.createUser({ body: { email: 'Lecteur@Go.dev', displayName: 'Lecteur', password: 'lecteur-123', role: 'viewer' } });
  assert.equal(created.email, 'lecteur@go.dev');
  await assert.rejects(
    api.createUser({ body: { email: 'lecteur@go.dev', displayName: 'Doublon', password: 'lecteur-123', role: 'viewer' } }),
    (e: unknown) => e instanceof ApiClientError && e.status === 409,
  );

  const page = await api.listUsers({ query: { page: 1, pageSize: 1 } });
  assert.equal(page.items.length, 1);
  assert.deepEqual(page.meta, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
  assert.equal((await api.getUser({ params: { id: created.id } })).displayName, 'Lecteur');
  await assert.rejects(
    api.getUser({ params: { id: '3f1c2a8e-9b4d-4c3e-8a1f-2b6d7e9f0a1b' } }),
    (e: unknown) => e instanceof ApiClientError && e.code === 'NOT_FOUND',
  );

  // Un « viewer » peut lire mais pas écrire.
  token = (await api.login({ body: { email: 'lecteur@go.dev', password: 'lecteur-123' } })).accessToken;
  assert.equal((await api.listUsers({ query: { page: 1, pageSize: 20 } })).meta.total, 2);
  await assert.rejects(
    api.createUser({ body: { email: 'x@go.dev', displayName: 'X', password: '12345678', role: 'admin' } }),
    (e: unknown) => e instanceof ApiClientError && e.code === 'FORBIDDEN',
  );
});

test('validation, OpenAPI, CORS, en-têtes de sécurité et jetons falsifiés', async (t) => {
  const { app, baseUrl } = await startApi();
  t.after(() => app.stop());

  const invalid = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'pas-un-email', password: 'x' }) });
  assert.equal(invalid.status, 422);
  const body = (await invalid.json()) as { details: { issues: { path: string }[] } };
  assert.deepEqual(body.details.issues.map((i) => i.path).sort(), ['body.email', 'body.password']);

  const doc = (await (await fetch(`${baseUrl}/openapi.json`)).json()) as { openapi: string; paths: Record<string, unknown> };
  assert.equal(doc.openapi, '3.1.0');
  assert.ok(doc.paths['/api/v1/users/{id}']);

  const res = await fetch(`${baseUrl}/api/v1/health`, { headers: { origin: 'http://localhost:3001' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3001');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const evil = await fetch(`${baseUrl}/api/v1/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);

  const forged = await fetch(`${baseUrl}/api/v1/users/me`, { headers: { authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' } });
  assert.equal(forged.status, 401);
});

test('limitation de débit', async (t) => {
  const config = apiConfig.load({ env: {}, overrides: { port: 0, host: '127.0.0.1', passwordCost: 10, rateLimitPerMinute: 2 } });
  const app = await startTestApp({ name: 'api', config, modules: apiModules(config, 'test', () => undefined) });
  t.after(() => app.stop());
  const { port } = app.container.resolve(HTTP_SERVER).server.address() as { port: number };
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await fetch(`http://127.0.0.1:${port}/api/v1/health`)).status);
  assert.deepEqual(statuses, [200, 200, 429]);
});

test('secret JWT obligatoire en production', () => {
  const config = apiConfig.load({ env: {} });
  assert.throws(() => apiModules(config, 'production'), /obligatoire en production/);
});
