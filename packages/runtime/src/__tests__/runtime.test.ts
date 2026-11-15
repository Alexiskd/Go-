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
