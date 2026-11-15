import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchDeployments, type EventSourceLike } from '../index.js';

class FakeEventSource implements EventSourceLike {
  static last: FakeEventSource;
  listeners = new Map<string, (e: { data: string }) => void>();
  closed = false;
  onerror = null;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: (e: { data: string }) => void) {
    this.listeners.set(type, listener);
  }
  emit(version: string) {
    this.listeners.get('version')!({ data: JSON.stringify({ version }) });
  }
  close() {
    this.closed = true;
  }
}

test('EventSource : rechargement à la nouvelle version uniquement', () => {
  let reloads = 0;
  const updates: string[] = [];
  const w = watchDeployments({ baseUrl: 'https://app.fr/', EventSource: FakeEventSource, reload: true, doReload: () => reloads++, onUpdate: (n, p) => updates.push(`${p.version}→${n.version}`) });
  const es = FakeEventSource.last;
  assert.equal(es.url, 'https://app.fr/__go/live');
  es.emit('aaa');
  es.emit('aaa'); // reconnexion au même serveur
  assert.equal(reloads, 0);
  es.emit('bbb'); // nouveau déploiement
  assert.equal(reloads, 1);
  assert.deepEqual(updates, ['aaa→bbb']);
  assert.equal(es.closed, true);
  assert.equal(w.current?.version, 'bbb');
});

test('mode de secours par interrogation', async () => {
  const versions = ['v1', 'v1', 'v2'];
  let calls = 0;
  const fakeFetch = (async () => new Response(JSON.stringify({ version: versions[Math.min(calls++, 2)] }))) as typeof fetch;
  let reloaded = false;
  const w = watchDeployments({ baseUrl: 'http://x', fetch: fakeFetch, pollMs: 5, reload: true, doReload: () => (reloaded = true) });
  for (let i = 0; i < 50 && !reloaded; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(reloaded, true);
  assert.equal(w.current?.version, 'v2');
  w.stop();
});
