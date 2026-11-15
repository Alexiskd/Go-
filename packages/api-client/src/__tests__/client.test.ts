import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiV1 } from '@go-/contracts';
import { ApiClientError, createApiClient } from '../index.js';

type Call = { url: string; init: RequestInit };

const fakeFetch = (status: number, body: unknown, calls: Call[] = []): typeof fetch =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

const USER = { id: '3f1c2a8e-9b4d-4c3e-8a1f-2b6d7e9f0a1b', email: 'a@b.fr', displayName: 'A', role: 'admin', createdAt: '2026-11-15T12:00:00.000Z' };

test('construit l’URL, les en-têtes, le jeton et valide la réponse', async () => {
  const calls: Call[] = [];
  const api = createApiClient(apiV1, { baseUrl: 'https://api.fr/', fetch: fakeFetch(200, { ...USER, passwordHash: 'x' }, calls), getToken: () => 'jwt' });
  const user = await api.getUser({ params: { id: USER.id } });
  assert.equal(calls[0]!.url, `https://api.fr/api/v1/users/${USER.id}`);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer jwt');
  assert.equal('passwordHash' in user, false);
  assert.equal(user.email, 'a@b.fr');
});

test('query string et corps JSON', async () => {
  const calls: Call[] = [];
  const api = createApiClient(apiV1, { baseUrl: 'http://x', fetch: fakeFetch(200, { accessToken: 't', tokenType: 'Bearer', expiresIn: 60 }, calls) });
  await api.login({ body: { email: 'a@b.fr', password: '12345678' } });
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal(calls[0]!.init.body, JSON.stringify({ email: 'a@b.fr', password: '12345678' }));
  const list = createApiClient(apiV1, { baseUrl: 'http://x', fetch: fakeFetch(200, { items: [], meta: { page: 2, pageSize: 5, total: 0, totalPages: 1 } }, calls) });
  await list.listUsers({ query: { page: 2, pageSize: 5 } });
  assert.equal(calls[1]!.url, 'http://x/api/v1/users?page=2&pageSize=5');
});

test('erreurs normalisées et réponses non conformes', async () => {
  const api = createApiClient(apiV1, { baseUrl: 'http://x', fetch: fakeFetch(404, { code: 'NOT_FOUND', message: 'absent', status: 404, requestId: 'r1' }) });
  await assert.rejects(api.getUser({ params: { id: USER.id } }), (e: unknown) => e instanceof ApiClientError && e.code === 'NOT_FOUND' && e.requestId === 'r1');
  const bad = createApiClient(apiV1, { baseUrl: 'http://x', fetch: fakeFetch(200, { status: 'perdu' }) });
  await assert.rejects(bad.health(), (e: unknown) => e instanceof ApiClientError && e.code === 'CONTRACT_MISMATCH');
  const html = createApiClient(apiV1, { baseUrl: 'http://x', fetch: (async () => new Response('<html>', { status: 502 })) as typeof fetch });
  await assert.rejects(html.health(), (e: unknown) => e instanceof ApiClientError && e.code === 'BAD_RESPONSE');
});
