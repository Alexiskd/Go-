import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toInitArgs } from '../index.js';

test('traduit les arguments vers go- init', () => {
  assert.deepEqual(toInitArgs(['mon-projet']), ['init', 'mon-projet', '--install']);
  assert.deepEqual(toInitArgs(['mon-projet', '--no-install']), ['init', 'mon-projet']);
  assert.deepEqual(toInitArgs(['--name', 'x', '--install']), ['init', '--name', 'x', '--install']);
});
