/** Lève une erreur si la condition est fausse ; affine le type pour TypeScript. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant violé : ${message}`);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Fusion profonde immuable : les tableaux sont remplacés, pas concaténés. */
export function deepMerge<T extends Record<string, unknown>>(base: T, ...overrides: Array<Record<string, unknown> | undefined>): T {
  const out: Record<string, unknown> = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const [key, value] of Object.entries(override)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (value === undefined) continue;
      const current = out[key];
      out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
    }
  }
  return out as T;
}

/** Gèle récursivement un objet. */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) if (key in obj) out[key] = obj[key];
  return out;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

export interface RetryOptions {
  /** Nombre total de tentatives (défaut 3). */
  attempts?: number;
  /** Délai initial en ms, doublé à chaque échec (défaut 100). */
  delayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  signal?: AbortSignal;
}

/** Réessaie une opération asynchrone avec backoff exponentiel. */
export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 100, maxDelayMs = 10_000, shouldRetry = () => true, signal } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetry(error, attempt)) break;
      await sleep(Math.min(delayMs * 2 ** (attempt - 1), maxDelayMs), signal);
    }
  }
  throw lastError;
}

/** Garantit qu'une fonction n'est exécutée qu'une fois (résultat mémorisé). */
export function once<T>(fn: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

const WORDS = /[A-Z]{2,}(?=[A-Z][a-z]+|\b|[0-9])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+/g;
const words = (input: string): string[] => input.match(WORDS) ?? [];

export const kebabCase = (s: string): string => words(s).map((w) => w.toLowerCase()).join('-');
export const snakeCase = (s: string): string => words(s).map((w) => w.toLowerCase()).join('_');
export const constantCase = (s: string): string => snakeCase(s).toUpperCase();
export const pascalCase = (s: string): string =>
  words(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
export const camelCase = (s: string): string => {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
