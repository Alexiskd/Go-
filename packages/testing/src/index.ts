import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, createLogger, type App, type AppOptions, type LogRecord, type Logger } from '@go-/core';
import type { LogLevel } from '@go-/types';

export interface MemoryLogger {
  readonly logger: Logger;
  readonly records: LogRecord[];
  /** Messages des enregistrements, éventuellement filtrés par niveau. */
  messages(level?: LogRecord['level']): string[];
  clear(): void;
}

/** Logger qui conserve les enregistrements en mémoire pour les assertions. */
export function createMemoryLogger(level: LogLevel = 'debug'): MemoryLogger {
  const records: LogRecord[] = [];
  return {
    logger: createLogger({ level, sink: (r) => records.push(r) }),
    records,
    messages: (lvl) => records.filter((r) => !lvl || r.level === lvl).map((r) => r.msg),
    clear: () => void records.splice(0),
  };
}

/** Horloge contrôlable : `clock.now()` en millisecondes, `clock.seconds()` en secondes. */
export function createClock(startMs = Date.UTC(2026, 0, 1)) {
  let current = startMs;
  return {
    now: () => current,
    seconds: () => Math.floor(current / 1000),
    advance: (ms: number) => void (current += ms),
    set: (ms: number) => void (current = ms),
  };
}

/** Application en environnement `test`, logger mémoire, démarrée ; à arrêter avec `stop()`. */
export async function startTestApp(options: Omit<AppOptions, 'env' | 'logger'> & { start?: boolean }): Promise<App & { log: MemoryLogger }> {
  const log = createMemoryLogger();
  const app = createApp({ ...options, env: 'test', logger: log.logger });
  if (options.start === false) await app.init();
  else await app.start();
  return Object.assign(app, { log });
}

/** Répertoire temporaire supprimé automatiquement par `cleanup()`. */
export async function createTempDir(prefix = 'go-test-'): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}
