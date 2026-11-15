import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bearerToken, createCorsPolicy, createRateLimiter, definePolicy, generateSecret, hashPassword, needsRehash,
  requireSecret, safeEqual, securityHeaders, signJwt, verifyJwt, verifyPassword,
} from '../index.js';

const FAST = { N: 2 ** 10 };
const SECRET = 'k'.repeat(16) + 'Zs8#pQ2!vW9@xR4&';

test('mots de passe : hachage salé, vérification, rehash', async () => {
  const h1 = await hashPassword('motdepasse', FAST);
  const h2 = await hashPassword('motdepasse', FAST);
  assert.notEqual(h1, h2);
  assert.match(h1, /^scrypt\$1024\$8\$1\$/);
  assert.equal(await verifyPassword('motdepasse', h1), true);
  assert.equal(await verifyPassword('mauvais', h1), false);
  assert.equal(await verifyPassword('motdepasse', 'bcrypt$xx'), false);
  assert.equal(needsRehash(h1), true);
  assert.equal(needsRehash(h1, FAST), false);
});

test('JWT : signature, expiration, émetteur, audience', () => {
  let now = 1_000_000;
  const clock = () => now;
  const token = signJwt({ role: 'admin' }, SECRET, { subject: 'u1', expiresIn: 60, issuer: 'go-', audience: 'web', now: clock });
  const ok = verifyJwt(token, SECRET, { issuer: 'go-', audience: 'web', now: clock });
  assert.ok(ok.ok && ok.value.sub === 'u1' && ok.value.role === 'admin');
  assert.deepEqual(verifyJwt(token, SECRET, { audience: 'admin', now: clock }), { ok: false, error: 'invalid_audience' });
  assert.deepEqual(verifyJwt(token, SECRET, { issuer: 'autre', now: clock }), { ok: false, error: 'invalid_issuer' });
  assert.deepEqual(verifyJwt(token, 'x'.repeat(40), { now: clock }), { ok: false, error: 'invalid_signature' });
  now += 120;
  assert.deepEqual(verifyJwt(token, SECRET, { now: clock }), { ok: false, error: 'expired' });
});

test('JWT : refuse alg none, jetons altérés et secrets courts', () => {
  const token = signJwt({ sub: 'u1' }, SECRET);
  const [, payload] = token.split('.');
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
  assert.deepEqual(verifyJwt(none, SECRET), { ok: false, error: 'unsupported_algorithm' });
  const forged = token.split('.');
  forged[1] = Buffer.from('{"sub":"admin"}').toString('base64url');
  assert.deepEqual(verifyJwt(forged.join('.'), SECRET), { ok: false, error: 'invalid_signature' });
  assert.deepEqual(verifyJwt('abc', SECRET), { ok: false, error: 'malformed' });
  assert.throws(() => signJwt({}, 'court'), /32 octets/);
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(bearerToken('Basic abc'), undefined);
});

test('RBAC : jokers, héritage, rôle inconnu', () => {
  const policy = definePolicy<'admin' | 'editor' | 'viewer' | 'support', 'users:read' | 'users:write' | 'billing:read'>(
    { admin: ['*'], editor: ['users:write'], viewer: ['users:read'], support: ['billing:*'] },
    { inherits: { editor: ['viewer'] } },
  );
  assert.equal(policy.can('admin', 'billing:read'), true);
  assert.equal(policy.can('editor', 'users:read'), true);
  assert.equal(policy.can('viewer', 'users:write'), false);
  assert.equal(policy.can('support', 'billing:read'), true);
  assert.equal(policy.can(undefined, 'users:read'), false);
  assert.throws(() => definePolicy<'a' | 'b', 'x:y'>({ a: [], b: [] }, { inherits: { a: ['b'], b: ['a'] } }), /circulaire/);
});

test('CORS : liste blanche, preflight, refus de * avec credentials', () => {
  const cors = createCorsPolicy({ origins: ['https://app.fr'], credentials: true });
  assert.deepEqual(cors.headers('https://evil.fr'), {});
  const h = cors.headers('https://app.fr', true);
  assert.equal(h['Access-Control-Allow-Origin'], 'https://app.fr');
  assert.equal(h['Access-Control-Allow-Credentials'], 'true');
  assert.ok(h['Access-Control-Allow-Methods']);
  assert.throws(() => createCorsPolicy({ origins: '*', credentials: true }), /interdite/);
  assert.ok(securityHeaders({ hsts: true })['Strict-Transport-Security']);
});

test('limitation de débit : seau à jetons', () => {
  let t = 0;
  const limiter = createRateLimiter({ capacity: 2, refillPerSec: 1, now: () => t });
  assert.equal(limiter.take('ip').allowed, true);
  assert.equal(limiter.take('ip').allowed, true);
  const blocked = limiter.take('ip');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 1);
  t = 1;
  assert.equal(limiter.take('ip').allowed, true);
  assert.equal(limiter.take('autre').allowed, true);
});

test('secrets : génération, comparaison, refus des valeurs faibles', () => {
  const secret = generateSecret();
  assert.ok(secret.length >= 64);
  assert.equal(requireSecret({ S: secret }, 'S'), secret);
  assert.throws(() => requireSecret({}, 'S'), /manquant/);
  assert.throws(() => requireSecret({ S: 'changeme'.repeat(5) }, 'S'), /faible/);
  assert.throws(() => requireSecret({ S: 'a'.repeat(40) }, 'S'), /faible/);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
});
