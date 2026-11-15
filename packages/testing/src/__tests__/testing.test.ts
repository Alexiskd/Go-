import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createClock, createMemoryLogger, createTempDir, startTestApp } from '../index.js';

test('logger mémoire', () => {
  const log = createMemoryLogger();
  log.logger.warn('attention');
  log.logger.info('info');
  assert.deepEqual(log.messages('warn'), ['attention']);
  log.clear();
  assert.equal(log.records.length, 0);
});

test('horloge contrôlable', () => {
  const clock = createClock(1000);
  clock.advance(2500);
  assert.equal(clock.now(), 3500);
  assert.equal(clock.seconds(), 3);
});

test('application de test démarrée en environnement test', async () => {
  const app = await startTestApp({ name: 't', modules: [{ name: 'm' }] });
  assert.equal(app.env, 'test');
  assert.equal(app.state, 'started');
  assert.ok(app.log.messages('info').some((m) => m.includes('démarrée')));
  await app.stop();
});

test('répertoire temporaire', async () => {
  const dir = await createTempDir();
  assert.ok(existsSync(dir.path));
  await dir.cleanup();
  assert.equal(existsSync(dir.path), false);
});
