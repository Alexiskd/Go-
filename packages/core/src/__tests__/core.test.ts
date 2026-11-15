import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Container, EventBus, GoError, NotFoundError, createApp, createLogger, defineModule, definePlugin,
  sortModules, toGoError, token, type LogRecord,
} from '../index.js';

const memory = () => {
  const records: LogRecord[] = [];
  return { records, logger: createLogger({ level: 'debug', sink: (r) => records.push(r) }) };
};

test('logger : niveaux, enfants et masquage des secrets', () => {
  const { records, logger } = memory();
  logger.child('db', { pool: 1 }).info('connecté', { password: 'x', nested: { token: 'y', ok: 1 } });
  const r = records[0]!;
  assert.equal(r.name, 'go-:db');
  assert.equal(r.password, '[REDACTED]');
  assert.deepEqual(r.nested, { token: '[REDACTED]', ok: 1 });
  assert.equal(r.pool, 1);
  const quiet = createLogger({ level: 'warn', sink: (x) => records.push(x) });
  quiet.info('ignoré');
  assert.equal(records.length, 1);
});

test('erreurs : statut, payload normalisé, masquage des erreurs internes', () => {
  const e = new NotFoundError('Utilisateur introuvable', { details: { id: 1 } });
  assert.deepEqual(e.toPayload('req-1'), { code: 'NOT_FOUND', message: 'Utilisateur introuvable', status: 404, details: { id: 1 }, requestId: 'req-1' });
  const internal = toGoError(new Error('mot de passe DB = 1234'));
  assert.equal(internal.status, 500);
  assert.equal(internal.toPayload().message, 'Erreur interne');
  assert.ok(toGoError(e) instanceof GoError);
});

test('événements : typés, once, erreurs agrégées', async () => {
  const bus = new EventBus<{ ping: number }>();
  let total = 0;
  bus.on('ping', (n) => void (total += n));
  bus.once('ping', (n) => void (total += n * 10));
  await bus.emit('ping', 1);
  await bus.emit('ping', 1);
  assert.equal(total, 12);
  bus.on('ping', () => { throw new Error('ko'); });
  await assert.rejects(bus.emit('ping', 1), AggregateError);
});

test('conteneur : singleton, transient, enfant, cycle', () => {
  const A = token<{ n: number }>('A');
  const B = token<number>('B');
  let created = 0;
  const c = new Container().factory(A, () => ({ n: ++created })).factory(B, () => Math.random(), { singleton: false });
  assert.equal(c.resolve(A), c.resolve(A));
  assert.notEqual(c.resolve(B), c.resolve(B));
  const child = c.createChild().value(B, 7);
  assert.equal(child.resolve(B), 7);
  assert.equal(child.resolve(A).n, 1);
  const X = token<unknown>('X');
  const Y = token<unknown>('Y');
  const cyc = new Container().factory(X, (k) => k.resolve(Y)).factory(Y, (k) => k.resolve(X));
  assert.throws(() => cyc.resolve(X), /circulaire : X → Y → X/);
  assert.throws(() => c.resolve(token('absent')), /Aucun fournisseur/);
});

test('modules : ordre topologique, dépendance absente, cycle', () => {
  const names = sortModules([
    { name: 'api', dependsOn: ['db', 'auth'] },
    { name: 'auth', dependsOn: ['db'] },
    { name: 'db' },
  ]).map((m) => m.name);
  assert.deepEqual(names, ['db', 'auth', 'api']);
  assert.throws(() => sortModules([{ name: 'a', dependsOn: ['b'] }]), /absent/);
  assert.throws(() => sortModules([{ name: 'a', dependsOn: ['b'] }, { name: 'b', dependsOn: ['a'] }]), /circulaire/);
});

test('application : cycle de vie complet, plugins, arrêt en ordre inverse', async () => {
  const { logger } = memory();
  const trace: string[] = [];
  const DB = token<{ query: () => string }>('db');
  const db = defineModule({
    name: 'db',
    register: ({ container }) => void container.value(DB, { query: () => 'rows' }),
    onStart: () => void trace.push('start:db'),
    onStop: () => void trace.push('stop:db'),
  });
  const users = defineModule({
    name: 'users',
    dependsOn: ['db'],
    onInit: ({ container }) => void trace.push(`init:users:${container.resolve(DB).query()}`),
    onStart: () => void trace.push('start:users'),
    onStop: () => void trace.push('stop:users'),
  });
  const audit = definePlugin({ name: 'audit', setup: (app) => void app.events.on('app:started', () => void trace.push('plugin:started')) });
  const app = createApp({ name: 'test', env: 'test', logger, modules: [users, db], plugins: [audit], config: { a: { b: 1 } } });
  await app.start();
  assert.equal(app.state, 'started');
  assert.ok(Object.isFrozen(app.config.a));
  await app.stop();
  assert.deepEqual(trace, ['init:users:rows', 'start:db', 'start:users', 'plugin:started', 'stop:users', 'stop:db']);
  await assert.rejects(app.start(), /arrêtée/);
});

test('application : un échec au démarrage arrête les modules déjà démarrés', async () => {
  const { logger } = memory();
  const trace: string[] = [];
  const app = createApp({
    name: 'ko', env: 'test', logger,
    modules: [
      { name: 'a', onStart: () => void trace.push('start:a'), onStop: () => void trace.push('stop:a') },
      { name: 'b', dependsOn: ['a'], onStart: () => { throw new Error('port occupé'); } },
    ],
  });
  await assert.rejects(app.start(), /port occupé/);
  assert.deepEqual(trace, ['start:a', 'stop:a']);
  assert.equal(app.state, 'stopped');
});
