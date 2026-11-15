import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError } from '@go-/core';
import { s } from '@go-/shared';
import { defineConfig, envFilesFor, loadEnvFiles, parseDotenv, redactConfig, resolveEnvironment } from '../index.js';

const config = defineConfig(
  {
    port: s.number().int().min(1).max(65535).default(3000),
    debug: s.boolean().default(false),
    databaseUrl: s.string().url(),
    corsOrigins: s.array(s.string()).default([]),
    jwtSecret: s.string().min(32),
  },
  { secrets: ['jwtSecret'] },
);

test('charge et convertit les variables préfixées', () => {
  const values = config.load({
    prefix: 'api',
    env: { API_PORT: '8080', API_DEBUG: 'yes', API_DATABASE_URL: 'postgres://u@h/db', API_CORS_ORIGINS: 'https://a.fr, https://b.fr', API_JWT_SECRET: 'x'.repeat(32) },
  });
  assert.equal(values.port, 8080);
  assert.equal(values.debug, true);
  assert.deepEqual(values.corsOrigins, ['https://a.fr', 'https://b.fr']);
  assert.ok(Object.isFrozen(values));
  assert.deepEqual(redactConfig(values, config.secrets).jwtSecret, '[REDACTED]');
});

test('erreur explicite listant chaque variable fautive', () => {
  assert.throws(
    () => config.load({ env: { PORT: 'abc', JWT_SECRET: 'court' } }),
    (e: unknown) => e instanceof ConfigError && /PORT : nombre attendu/.test(e.message) && /DATABASE_URL/.test(e.message) && /JWT_SECRET : au moins 32/.test(e.message),
  );
});

test('parseDotenv gère guillemets, commentaires et export', () => {
  const env = parseDotenv('# commentaire\nexport A=1\nB="deux\\nlignes"\nC=\'litteral\' \nD=valeur # note\nE=\n');
  assert.deepEqual(env, { A: '1', B: 'deux\nlignes', C: 'litteral', D: 'valeur', E: '' });
});

test('loadEnvFiles : ordre de priorité et environnement réel prioritaire', () => {
  const dir = mkdtempSync(join(tmpdir(), 'go-env-'));
  writeFileSync(join(dir, '.env'), 'A=base\nB=base\nC=base');
  writeFileSync(join(dir, '.env.production'), 'B=prod');
  writeFileSync(join(dir, '.env.local'), 'C=local');
  const { env, loaded } = loadEnvFiles({ cwd: dir, environment: 'production', env: { A: 'reel' } });
  assert.deepEqual([env.A, env.B, env.C], ['reel', 'prod', 'local']);
  assert.deepEqual(loaded, ['.env', '.env.local', '.env.production']);
  assert.ok(!envFilesFor('test').includes('.env.local'));
});

test('resolveEnvironment', () => {
  assert.equal(resolveEnvironment(undefined), 'development');
  assert.equal(resolveEnvironment('production'), 'production');
  assert.throws(() => resolveEnvironment('prod'), ConfigError);
});
