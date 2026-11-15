import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, camelCase, deepFreeze, deepMerge, kebabCase, once, pascalCase, retry, constantCase, unwrap, ok, err } from '../index.js';

test('deepMerge fusionne en profondeur et ignore la pollution de prototype', () => {
  const merged = deepMerge({ a: { b: 1, c: 2 }, list: [1] }, { a: { c: 3 }, list: [2] }, JSON.parse('{"__proto__":{"x":1}}'));
  assert.deepEqual(merged, { a: { b: 1, c: 3 }, list: [2] });
  assert.equal(({} as Record<string, unknown>).x, undefined);
});

test('deepFreeze gèle récursivement', () => {
  const o = deepFreeze({ a: { b: 1 } });
  assert.ok(Object.isFrozen(o.a));
});

test('retry réessaie puis réussit', async () => {
  let calls = 0;
  const value = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error('boom');
    return 'ok';
  }, { delayMs: 1 });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
});

test('retry abandonne après le nombre de tentatives', async () => {
  await assert.rejects(retry(async () => { throw new Error('ko'); }, { attempts: 2, delayMs: 1 }), /ko/);
});

test('once mémorise le résultat', () => {
  let n = 0;
  const f = once(() => ++n);
  f();
  assert.equal(f(), 1);
});

test('conversions de casse', () => {
  assert.equal(kebabCase('UserProfile'), 'user-profile');
  assert.equal(pascalCase('user-profile'), 'UserProfile');
  assert.equal(camelCase('user_profile id'), 'userProfileId');
  assert.equal(constantCase('databaseUrl'), 'DATABASE_URL');
  assert.equal(kebabCase('HTTPServer2'), 'http-server-2');
});

test('Result : attempt / unwrap', async () => {
  const r = await attempt(() => { throw new Error('x'); });
  assert.equal(r.ok, false);
  assert.equal(unwrap(ok(1)), 1);
  assert.throws(() => unwrap(err(new Error('e'))), /e/);
});
