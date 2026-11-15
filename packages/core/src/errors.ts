import { ERROR_CODES, type ErrorCode, type ErrorPayload, type Json } from '@go-/types';

export interface GoErrorOptions {
  details?: Json;
  cause?: unknown;
  /** Message montré au client ; par défaut le message de l'erreur (sauf erreurs 5xx). */
  expose?: boolean;
}

/** Erreur applicative GO- : un code normalisé, un statut HTTP, des détails sérialisables. */
export class GoError extends Error {
  override name = 'GoError';
  readonly status: number;
  readonly details: Json | undefined;
  readonly expose: boolean;

  constructor(readonly code: ErrorCode, message: string, options: GoErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.status = ERROR_CODES[code];
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
  }

  toPayload(requestId?: string): ErrorPayload {
    return {
      code: this.code,
      message: this.expose ? this.message : 'Erreur interne',
      status: this.status,
      ...(this.expose && this.details !== undefined && { details: this.details }),
      ...(requestId && { requestId }),
    };
  }
}

export class ValidationError extends GoError {
  override name = 'ValidationError';
  constructor(message = 'Données invalides', options: GoErrorOptions = {}) {
    super('VALIDATION_FAILED', message, options);
  }
}
export class UnauthorizedError extends GoError {
  override name = 'UnauthorizedError';
  constructor(message = 'Authentification requise', options: GoErrorOptions = {}) {
    super('UNAUTHORIZED', message, options);
  }
}
export class ForbiddenError extends GoError {
  override name = 'ForbiddenError';
  constructor(message = 'Accès refusé', options: GoErrorOptions = {}) {
    super('FORBIDDEN', message, options);
  }
}
export class NotFoundError extends GoError {
  override name = 'NotFoundError';
  constructor(message = 'Ressource introuvable', options: GoErrorOptions = {}) {
    super('NOT_FOUND', message, options);
  }
}
export class ConflictError extends GoError {
  override name = 'ConflictError';
  constructor(message = 'Conflit', options: GoErrorOptions = {}) {
    super('CONFLICT', message, options);
  }
}
export class ConfigError extends GoError {
  override name = 'ConfigError';
  constructor(message: string, options: GoErrorOptions = {}) {
    super('CONFIG_INVALID', message, { ...options, expose: false });
  }
}

/** Convertit n'importe quelle erreur en GoError ; les erreurs inconnues deviennent INTERNAL (non exposées). */
export function toGoError(error: unknown): GoError {
  if (error instanceof GoError) return error;
  return new GoError('INTERNAL', error instanceof Error ? error.message : String(error), { cause: error, expose: false });
}
