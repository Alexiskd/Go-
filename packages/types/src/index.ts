/**
 * @go-/types — types utilitaires et constantes partagés par toute la stack GO-.
 * Ce package ne dépend de rien et ne contient aucune logique métier.
 */

/** Résultat explicite d'une opération pouvant échouer, sans exception. */
export type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Valeur synchrone ou asynchrone. */
export type Awaitable<T> = T | Promise<T>;

/** Type nominal : empêche de confondre deux chaînes de sens différent (UserId vs Email). */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Aplatis les intersections pour des infobulles lisibles. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Valeur sérialisable en JSON. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Environnements d'exécution reconnus par GO-. */
export const ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Niveaux de log, du plus verbeux au plus silencieux. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Codes d'erreur normalisés, communs au backend et aux clients. */
export const ERROR_CODES = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CONFIG_INVALID: 500,
  INTERNAL: 500,
  UNAVAILABLE: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

/** Forme normalisée d'une erreur échangée entre services et clients. */
export interface ErrorPayload {
  readonly code: ErrorCode;
  readonly message: string;
  readonly status: number;
  readonly details?: Json;
  readonly requestId?: string;
}

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === 'string' && (ENVIRONMENTS as readonly string[]).includes(value);
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}
