import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface GeneratedFile {
  /** Chemin relatif à la racine cible. */
  path: string;
  content: string;
}

export interface WriteOptions {
  /** Écrase les fichiers existants (défaut : refus). */
  force?: boolean;
  dryRun?: boolean;
}

export class FileConflictError extends Error {
  override readonly name = 'FileConflictError';
  constructor(readonly files: string[]) {
    super(`Fichier(s) déjà existant(s), rien n'a été écrit : ${files.join(', ')} (utiliser --force pour écraser)`);
  }
}

/** Écrit un lot de fichiers de façon atomique vis-à-vis des conflits : tout ou rien. */
export function writeFiles(root: string, files: readonly GeneratedFile[], options: WriteOptions = {}): string[] {
  for (const f of files) {
    const rel = relative(root, join(root, f.path));
    if (rel.startsWith('..') || f.path.startsWith('/')) throw new Error(`Chemin hors de la cible refusé : ${f.path}`);
  }
  const conflicts = files.filter((f) => existsSync(join(root, f.path))).map((f) => f.path);
  if (conflicts.length && !options.force) throw new FileConflictError(conflicts);
  if (options.dryRun) return files.map((f) => f.path);
  for (const f of files) {
    const target = join(root, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
  return files.map((f) => f.path);
}

/** Remplace `{{cle}}` par la valeur correspondante ; une clé inconnue est une erreur. */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Variable de template inconnue : ${key}`);
    return vars[key]!;
  });
}

/** Ajoute une référence de projet au tsconfig.json racine (idempotent). */
export function addProjectReference(tsconfigPath: string, referencePath: string): boolean {
  const json = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as { references?: { path: string }[] };
  json.references ??= [];
  if (json.references.some((r) => r.path === referencePath)) return false;
  json.references.push({ path: referencePath });
  writeFileSync(tsconfigPath, JSON.stringify(json, null, 2) + '\n');
  return true;
}

export const toJson = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
