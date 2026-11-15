import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

export interface Io {
  cwd: string;
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  /** Sortie des commandes lancées (npm, tsc, node) : héritée par défaut, ignorée dans les tests. */
  stdio?: 'inherit' | 'ignore';
}

/** Erreur destinée à l'utilisateur : message affiché sans pile, code de sortie donné. */
export class CliError extends Error {
  override readonly name = 'CliError';
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

export const readJson = <T = Record<string, unknown>>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** Racine du projet GO- : dossier le plus proche contenant un package.json avec des workspaces. */
export function findRoot(from: string): string | undefined {
  let dir = resolve(from);
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg) && Array.isArray(readJson(pkg).workspaces)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function requireRoot(io: Io): string {
  const root = findRoot(io.cwd);
  if (!root) throw new CliError("Aucun projet GO- trouvé (package.json avec « workspaces »). Lancez d'abord : go- init <dossier>");
  if (!existsSync(join(root, 'tsconfig.json'))) throw new CliError(`tsconfig.json manquant à la racine du projet (${root})`);
  return root;
}

/** Scope npm utilisé par les packages existants du projet (ex. `@acme`). */
export function detectScope(root: string): string | undefined {
  const dir = join(root, 'packages');
  if (!existsSync(dir)) return undefined;
  for (const entry of readdirSync(dir)) {
    const pkg = join(dir, entry, 'package.json');
    if (!existsSync(pkg)) continue;
    const name = readJson<{ name?: string }>(pkg).name ?? '';
    if (name.startsWith('@')) return name.split('/')[0];
  }
  return undefined;
}

function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Cherche un exécutable : d'abord node_modules/.bin du projet, puis le PATH. */
export function findBinary(name: string, root: string, env: Io['env']): string | undefined {
  let dir = root;
  for (;;) {
    const local = join(dir, 'node_modules', '.bin', name);
    if (isExecutable(local)) return local;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const p of (env.PATH ?? '').split(delimiter)) {
    if (p && isExecutable(join(p, name))) return join(p, name);
  }
  return undefined;
}

export function requireTsc(root: string, env: Io['env']): string {
  const tsc = findBinary('tsc', root, env);
  if (!tsc) throw new CliError('TypeScript introuvable : lancez « npm install » (typescript est une devDependency du projet)');
  return tsc;
}

/** Lance une commande en héritant du terminal ; résout avec son code de sortie. */
export function run(command: string, args: readonly string[], options: { cwd: string; env?: Io['env']; stdio?: Io['stdio'] }): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: options.stdio ?? 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });
}

/** Fichiers de test compilés : `<workspace>/dist/__tests__/**\/*.test.js`. */
export function findTestFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name.endsWith('.test.js') && full.includes(`${join('dist', '__tests__')}`)) files.push(full);
    }
  };
  walk(root, 0);
  return files.sort();
}
