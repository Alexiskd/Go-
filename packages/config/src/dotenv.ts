import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment } from '@go-/types';

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/;

/** Analyse le contenu d'un fichier .env (guillemets, commentaires, \n dans les valeurs "…"). */
export function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of content.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const m = LINE.exec(raw);
    if (!m) continue;
    const key = m[1]!;
    let value = (m[2] ?? '').trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'" || quote === '`') && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }
    out[key] = value;
  }
  return out;
}

/**
 * Fichiers chargés, du moins prioritaire au plus prioritaire :
 * `.env`, `.env.local` (sauf en test), `.env.<env>`, `.env.<env>.local`.
 * Les variables déjà présentes dans l'environnement réel gardent toujours la priorité.
 */
export function envFilesFor(environment: Environment): string[] {
  return ['.env', ...(environment === 'test' ? [] : ['.env.local']), `.env.${environment}`, `.env.${environment}.local`];
}

export function loadEnvFiles(options: { cwd?: string; environment: Environment; env?: Record<string, string | undefined> }): {
  env: Record<string, string | undefined>;
  loaded: string[];
} {
  const cwd = options.cwd ?? process.cwd();
  const base = options.env ?? process.env;
  const fromFiles: Record<string, string> = {};
  const loaded: string[] = [];
  for (const file of envFilesFor(options.environment)) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    Object.assign(fromFiles, parseDotenv(readFileSync(path, 'utf8')));
    loaded.push(file);
  }
  return { env: { ...fromFiles, ...base }, loaded };
}
