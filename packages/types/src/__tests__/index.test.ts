import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES, isEnvironment, isErrorCode, isLogLevel } from '../index.js';

test('guards reconnaissent les valeurs valides', () => {
  assert.equal(isEnvironment('production'), true);
  assert.equal(isEnvironment('prod'), false);
  assert.equal(isLogLevel('warn'), true);
  assert.equal(isLogLevel(3), false);
  assert.equal(isErrorCode('NOT_FOUND'), true);
  assert.equal(isErrorCode('toString'), false);
});

test('chaque code d’erreur porte un statut HTTP', () => {
  for (const status of Object.values(ERROR_CODES)) {
    assert.ok(status >= 400 && status < 600);
  }
});
