#!/usr/bin/env node
/**
 * Banc de mesure GO- (à lancer après « npm run build ») :
 *   node tools/scripts/bench.mjs
 * Mesure la validation de schémas, le débit du serveur HTTP et la taille des réponses.
 */
import { s } from '@go-/shared';
import { createLogger } from '@go-/core';
import { defineContract, defineEndpoint } from '@go-/contracts';
import { createHttpServer } from '@go-/runtime';
import { request, Agent } from 'node:http';

const Item = s.object({
  id: s.string().uuid(),
  name: s.string().min(1).max(100),
  mass: s.number().min(0),
  tags: s.array(s.string()).default([]),
  orbit: s.object({ a: s.number(), e: s.number().min(0).max(1), i: s.number(), period: s.number().positive().optional() }),
});
const List = s.object({ items: s.array(Item) });
const sample = {
  items: Array.from({ length: 200 }, (_, i) => ({
    id: '3f1c2a8e-9b4d-4c3e-8a1f-2b6d7e9f0a1b', name: `Astre ${i}`, mass: i * 1e20, tags: ['planète', 'solide'],
    orbit: { a: 1.0 + i, e: 0.01, i: 0.5, period: 365.25 }, internal: 'x',
  })),
};

function bench(label, fn, ms = 1500) {
  for (let i = 0; i < 50; i++) fn();
  let n = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) {
    fn();
    n++;
  }
  const opsPerSec = Math.round((n / ms) * 1000);
  console.log(`${label.padEnd(42)} ${opsPerSec.toLocaleString('fr-FR').padStart(10)} op/s`);
  return opsPerSec;
}

const results = {};
results.parse = bench('schéma : parse liste de 200 objets', () => List.parse(sample));
results.invalid = bench('schéma : safeParse invalide (200 erreurs)', () => List.safeParse({ items: sample.items.map((x) => ({ ...x, mass: -1 })) }));

const contract = defineContract({
  name: 'bench', version: 'v1', basePath: '/api/v1',
  endpoints: {
    list: defineEndpoint({ method: 'GET', path: '/bodies', summary: 'liste', response: List }),
    ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`r${i}`, defineEndpoint({ method: 'GET', path: `/r${i}/:id`, summary: 'r', params: s.object({ id: s.string() }), response: s.object({ id: s.string() }) })])),
    last: defineEndpoint({ method: 'GET', path: '/health', summary: 'health', response: s.object({ ok: s.boolean() }) }),
  },
});
const handlers = { list: () => sample, last: () => ({ ok: true }), ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`r${i}`, ({ params }) => ({ id: params.id })])) };
const http = createHttpServer({ contract, handlers, logger: createLogger({ level: 'silent' }) });
const { port } = await http.listen(0, '127.0.0.1');
const agent = new Agent({ keepAlive: true, maxSockets: 32 });

const get = (path, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, agent, headers }, (res) => {
      let size = 0;
      res.on('data', (c) => (size += c.length));
      res.on('end', () => resolve({ status: res.statusCode, size }));
    });
    req.on('error', reject);
    req.end();
  });

async function load(label, path, headers, ms = 2000) {
  let n = 0;
  const end = performance.now() + ms;
  await Promise.all(Array.from({ length: 32 }, async () => {
    while (performance.now() < end) {
      await get(path, headers);
      n++;
    }
  }));
  const rps = Math.round((n / ms) * 1000);
  console.log(`${label.padEnd(42)} ${rps.toLocaleString('fr-FR').padStart(10)} req/s`);
  return rps;
}

results.health = await load('HTTP : /health (41e route)', '/api/v1/health', {});
results.listRps = await load('HTTP : liste 200 astres', '/api/v1/bodies', { 'accept-encoding': 'gzip, br' });
const plain = await get('/api/v1/bodies');
const negotiated = await get('/api/v1/bodies', { 'accept-encoding': 'gzip, br' });
console.log(`${'HTTP : taille liste (sans / avec compression)'.padEnd(42)} ${plain.size} / ${negotiated.size} octets`);
await http.close();
agent.destroy();
