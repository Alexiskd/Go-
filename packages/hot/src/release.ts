import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from '@go-/core';
import { authenticatedUrl, redactSecrets, type HotConfig } from './config.js';

export interface ShOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  timeoutMs: number;
  logger?: Logger;
  secrets?: Array<string | undefined>;
}

/** Exécute une commande shell ; rejette avec les dernières lignes de sortie (secrets masqués) en cas d'échec. */
export function sh(command: string, options: ShOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-20_000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const clean = redactSecrets(output, options.secrets ?? []);
      if (code === 0) return resolve(clean);
      const tail = clean.trim().split('\n').slice(-15).join('\n');
      const display = redactSecrets(command, options.secrets ?? []);
      reject(new Error(`« ${display} » a échoué (${signal ? `signal ${signal}` : `code ${code}`})\n${tail}`));
    });
  });
}

/** Empreinte des dépendances : package-lock.json + tous les package.json des workspaces. */
export function dependenciesHash(dir: string): string {
  const hash = createHash('sha256');
  const add = (file: string) => {
    if (existsSync(file)) hash.update(file.slice(dir.length)).update(readFileSync(file));
  };
  add(join(dir, 'package-lock.json'));
  add(join(dir, 'package.json'));
  for (const group of ['packages', 'apps', 'tools']) {
    const base = join(dir, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base).sort()) add(join(base, entry, 'package.json'));
  }
  return hash.digest('hex');
}

export interface Release {
  dir: string;
  sha: string;
}

/**
 * Prépare une version : récupère le commit demandé (clone superficiel), réutilise les
 * node_modules de la version précédente si les dépendances n'ont pas changé, puis compile.
 */
export async function prepareRelease(params: {
  config: HotConfig;
  name: string;
  /** Branche à récupérer (production ou branche de la PR). */
  ref: string;
  /** Commit attendu (informatif : le dernier commit de la branche est utilisé). */
  sha?: string;
  previousDir?: string;
  logger: Logger;
}): Promise<Release> {
  const { config, logger } = params;
  const secrets = [config.gitToken];
  const step = { timeoutMs: config.stepTimeoutMs, secrets, logger };
  const tmp = join(config.releasesDir, `${params.name}-${Date.now().toString(36)}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  try {
    logger.info(`récupération de ${params.ref}${params.sha ? ` (${params.sha.slice(0, 12)})` : ''}`);
    await sh('git init -q', { ...step, cwd: tmp });
    await sh(`git fetch -q --depth 1 "${authenticatedUrl(config)}" "refs/heads/${params.ref}"`, { ...step, cwd: tmp });
    await sh('git checkout -q FETCH_HEAD', { ...step, cwd: tmp });
    const sha = (await sh('git rev-parse HEAD', { ...step, cwd: tmp })).trim();

    const prev = params.previousDir;
    if (prev && existsSync(join(prev, 'node_modules')) && dependenciesHash(prev) === dependenciesHash(tmp)) {
      logger.info('dépendances inchangées : node_modules réutilisés');
      await sh(`cp -a "${join(prev, 'node_modules')}" "${join(tmp, 'node_modules')}"`, { ...step, cwd: tmp });
    } else {
      logger.info('installation des dépendances');
      await sh(config.installCommand, { ...step, cwd: tmp });
    }
    logger.info('compilation');
    await sh(config.buildCommand, { ...step, cwd: tmp });
    return { dir: tmp, sha };
  } catch (error) {
    await rm(tmp, { recursive: true, force: true });
    throw error;
  }
}

/** Dernier commit d'une branche distante, sans rien télécharger. */
export async function remoteHead(config: HotConfig, branch: string): Promise<string | undefined> {
  const out = await sh(`git ls-remote "${authenticatedUrl(config)}" "refs/heads/${branch}"`, {
    cwd: config.releasesDir,
    timeoutMs: 30_000,
    secrets: [config.gitToken],
  });
  return out.trim().split(/\s+/)[0] || undefined;
}
