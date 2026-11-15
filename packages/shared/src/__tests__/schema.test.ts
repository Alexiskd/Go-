import { test } from 'node:test';
import assert from 'node:assert/strict';
import { s, SchemaError, type Infer } from '../index.js';

const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  age: s.number().int().min(0).optional(),
  role: s.enum(['admin', 'user']).default('user'),
  tags: s.array(s.string().nonEmpty()).max(3).default([]),
  bio: s.string().nullable().optional(),
});
type User = Infer<typeof User>;

test('parse un objet valide, applique les défauts et supprime les clés inconnues', () => {
  const input = { id: '3f1c2a8e-9b4d-4c3e-8a1f-2b6d7e9f0a1b', email: 'a@b.fr', extra: 'x' };
  const user: User = User.parse(input);
  assert.deepEqual(user, { id: input.id, email: 'a@b.fr', role: 'user', tags: [] });
});

test('rapporte toutes les erreurs avec leur chemin', () => {
  const r = User.safeParse({ id: 'nope', email: 'x', age: 1.5, tags: ['', 'a'] });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error instanceof SchemaError);
  const paths = r.error.issues.map((i) => i.path.join('.'));
  assert.deepEqual(paths.sort(), ['age', 'email', 'id', 'tags.0']);
});

test('union, littéraux et nullable', () => {
  const Shape = s.union(s.object({ kind: s.literal('a'), n: s.number() }), s.object({ kind: s.literal('b') }));
  assert.deepEqual(Shape.parse({ kind: 'b' }), { kind: 'b' });
  assert.equal(Shape.is({ kind: 'c' }), false);
  assert.equal(s.string().nullable().parse(null), null);
});

test('extend / pick / omit / partial', () => {
  const Base = s.object({ a: s.string(), b: s.number() });
  assert.deepEqual(Base.pick('a').parse({ a: 'x', b: 1 }), { a: 'x' });
  assert.deepEqual(Base.omit('a').parse({ b: 1 }), { b: 1 });
  assert.deepEqual(Base.partial().parse({}), {});
  assert.deepEqual(Base.extend({ c: s.boolean() }).parse({ a: 'x', b: 1, c: true }), { a: 'x', b: 1, c: true });
});

test('produit un JSON Schema exploitable par OpenAPI', () => {
  const json = User.describe('Utilisateur').toJSONSchema();
  assert.equal(json.type, 'object');
  assert.equal(json.description, 'Utilisateur');
  assert.deepEqual(json.required, ['id', 'email']);
  const props = json.properties as Record<string, Record<string, unknown>>;
  assert.equal(props.id?.format, 'uuid');
  assert.equal(props.age?.type, 'integer');
  assert.equal(props.role?.default, 'user');
  assert.deepEqual(props.bio?.type, ['string', 'null']);
});

test('les défauts mutables ne sont pas partagés entre deux parse', () => {
  const S = s.object({ list: s.array(s.string()).default([]) });
  const a = S.parse({});
  a.list.push('x');
  assert.deepEqual(S.parse({}).list, []);
});
