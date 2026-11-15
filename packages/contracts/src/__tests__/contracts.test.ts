import { test } from 'node:test';
import assert from 'node:assert/strict';
import { s } from '@go-/shared';
import {
  ApiErrorSchema, apiV1, buildPath, defineContract, defineEndpoint, pageMeta, pathParams, toOpenApi,
  type EndpointInput, type EndpointOutput, type UserDto,
} from '../index.js';

test('les DTO valident les données et ne laissent passer aucun champ interne', () => {
  const user = apiV1.endpoints.me.response.parse({
    id: '3f1c2a8e-9b4d-4c3e-8a1f-2b6d7e9f0a1b', email: 'a@b.fr', displayName: 'A', role: 'admin',
    createdAt: '2026-11-15T12:00:00.000Z', passwordHash: 'secret',
  });
  assert.equal('passwordHash' in user, false);
  assert.equal(apiV1.endpoints.login.body.is({ email: 'a@b.fr', password: 'court' }), false);
  assert.equal(apiV1.endpoints.createUser.body.parse({ email: 'a@b.fr', displayName: 'A', password: '12345678' }).role, 'viewer');
});

test('types inférés des endpoints', () => {
  const input: EndpointInput<typeof apiV1.endpoints.getUser> = { params: { id: 'x' } };
  const output: EndpointOutput<typeof apiV1.endpoints.me> = {} as UserDto;
  assert.ok(input && output);
});

test('defineContract refuse routes dupliquées et paramètres non déclarés', () => {
  const ep = defineEndpoint({ method: 'GET', path: '/a', summary: 'a', response: s.string() });
  assert.throws(() => defineContract({ name: 'x', version: 'v1', basePath: '', endpoints: { a: ep, b: ep } }), /dupliquée/);
  assert.throws(
    () => defineContract({ name: 'x', version: 'v1', basePath: '', endpoints: { a: defineEndpoint({ method: 'GET', path: '/a/:id', summary: 'a', response: s.string() }) } }),
    /non déclaré/,
  );
});

test('chemins : paramètres et encodage', () => {
  assert.deepEqual(pathParams('/orgs/:orgId/users/:id'), ['orgId', 'id']);
  assert.equal(buildPath('/users/:id', { id: 'a/b' }), '/users/a%2Fb');
  assert.throws(() => buildPath('/users/:id'), /manquant/);
});

test('pagination et erreurs normalisées', () => {
  assert.deepEqual(pageMeta(2, 10, 35), { page: 2, pageSize: 10, total: 35, totalPages: 4 });
  assert.equal(ApiErrorSchema.is({ code: 'NOT_FOUND', message: 'x', status: 404 }), true);
  assert.equal(ApiErrorSchema.is({ code: 'INCONNU', message: 'x', status: 404 }), false);
});

test('OpenAPI 3.1 généré depuis le contrat', () => {
  const doc = toOpenApi(apiV1, { servers: [{ url: 'http://localhost:3000' }] });
  assert.equal(doc.openapi, '3.1.0');
  const getUser = doc.paths['/api/v1/users/{id}']?.get as Record<string, any>;
  assert.equal(getUser.operationId, 'getUser');
  assert.deepEqual(getUser.parameters[0], { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
  assert.equal(getUser['x-go-permission'], 'users:read');
  assert.ok(getUser.responses['403']);
  const create = doc.paths['/api/v1/users']?.post as Record<string, any>;
  assert.ok(create.responses['201']);
  assert.ok(create.requestBody);
  const list = doc.paths['/api/v1/users']?.get as Record<string, any>;
  assert.equal(list.parameters.find((p: any) => p.name === 'page').required, false);
  assert.equal((doc.paths['/api/v1/health']?.get as any).security, undefined);
});
