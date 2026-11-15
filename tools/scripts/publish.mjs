#!/usr/bin/env node
/**
 * Publie les packages publics du monorepo sur npm, dans l'ordre des dépendances.
 * Les versions déjà publiées sont ignorées : la commande peut être relancée sans risque.
 *
 *   node tools/scripts/publish.mjs            publication réelle (CI, NODE_AUTH_TOKEN requis)
 *   node tools/scripts/publish.mjs --dry-run  ordre + contenu des archives, sans réseau
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const dryRun = process.argv.includes('--dry-run');
const provenance = process.argv.includes('--provenance');

const workspaces = ['packages', 'tools', 'apps']
  .flatMap((dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).map((d) => join(root, dir, d)) : []))
  .filter((dir) => existsSync(join(dir, 'package.json')))
  .map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .filter(({ pkg }) => !pkg.private);

const byName = new Map(workspaces.map((w) => [w.pkg.name, w]));
const ordered = [];
const seen = new Set();
const visit = (w) => {
  if (seen.has(w.pkg.name)) return;
  seen.add(w.pkg.name);
  for (const dep of Object.keys(w.pkg.dependencies ?? {})) if (byName.has(dep)) visit(byName.get(dep));
  ordered.push(w);
};
workspaces.forEach(visit);

const published = (name, version) => {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === version;
  } catch {
    return false;
  }
};

for (const { dir, pkg } of ordered) {
  const id = `${pkg.name}@${pkg.version}`;
  if (dryRun) {
    const files = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' }))[0].files.map((f) => f.path);
    if (!files.some((f) => f.startsWith('dist/'))) throw new Error(`${id} : dist/ absent, lancez « npm run build » d'abord`);
    if (files.some((f) => f.includes('__tests__'))) throw new Error(`${id} : les tests ne doivent pas être publiés`);
    console.log(`• ${id} (${files.length} fichiers)`);
    continue;
  }
  if (published(pkg.name, pkg.version)) {
    console.log(`= ${id} déjà publié`);
    continue;
  }
  execFileSync('npm', ['publish', '--access', 'public', ...(provenance ? ['--provenance'] : [])], { cwd: dir, stdio: 'inherit' });
  console.log(`✔ ${id} publié`);
}
