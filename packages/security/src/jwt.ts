import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Result } from '@go-/types';

/**
 * JSON Web Tokens HS256 (RFC 7519 / RFC 7515) construits sur HMAC-SHA256 de node:crypto.
 * Seul `HS256` est accepté : `alg: none` et toute substitution d'algorithme sont refusés.
 */
export interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [claim: string]: unknown;
}

export interface SignOptions {
  /** Durée de validité en secondes. */
  expiresIn?: number;
  issuer?: string;
  audience?: string;
  subject?: string;
  /** Horloge injectable (secondes epoch), pour les tests. */
  now?: () => number;
}

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  /** Tolérance de décalage d'horloge en secondes (défaut 5). */
  clockToleranceSec?: number;
  now?: () => number;
}

export type JwtError = 'malformed' | 'invalid_signature' | 'unsupported_algorithm' | 'expired' | 'not_yet_valid' | 'invalid_issuer' | 'invalid_audience';

export const MIN_SECRET_BYTES = 32;
const nowSec = () => Math.floor(Date.now() / 1000);
const b64 = (data: string | Buffer) => Buffer.from(data).toString('base64url');

function assertSecret(secret: string | Buffer) {
  if (Buffer.byteLength(secret) < MIN_SECRET_BYTES) throw new Error(`Le secret JWT doit faire au moins ${MIN_SECRET_BYTES} octets`);
}

const sign = (input: string, secret: string | Buffer) => createHmac('sha256', secret).update(input).digest();

export function signJwt(claims: JwtClaims, secret: string | Buffer, options: SignOptions = {}): string {
  assertSecret(secret);
  const iat = (options.now ?? nowSec)();
  const payload: JwtClaims = {
    ...claims,
    iat,
    ...(options.expiresIn !== undefined && { exp: iat + options.expiresIn }),
    ...(options.issuer && { iss: options.issuer }),
    ...(options.audience && { aud: options.audience }),
    ...(options.subject && { sub: options.subject }),
  };
  const head = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify(payload))}`;
  return `${head}.${b64(sign(head, secret))}`;
}

export function verifyJwt<T extends JwtClaims = JwtClaims>(token: string, secret: string | Buffer, options: VerifyOptions = {}): Result<T, JwtError> {
  assertSecret(secret);
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'malformed' };
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: unknown };
  let payload: T;
  try {
    header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (header.alg !== 'HS256') return { ok: false, error: 'unsupported_algorithm' };
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'malformed' };
  const expected = sign(`${h}.${p}`, secret);
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, error: 'invalid_signature' };

  const now = (options.now ?? nowSec)();
  const tolerance = options.clockToleranceSec ?? 5;
  if (typeof payload.exp === 'number' && now > payload.exp + tolerance) return { ok: false, error: 'expired' };
  if (typeof payload.nbf === 'number' && now + tolerance < payload.nbf) return { ok: false, error: 'not_yet_valid' };
  if (options.issuer && payload.iss !== options.issuer) return { ok: false, error: 'invalid_issuer' };
  if (options.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(options.audience)) return { ok: false, error: 'invalid_audience' };
  }
  return { ok: true, value: payload };
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <jeton>`. */
export function bearerToken(header: string | undefined | null): string | undefined {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header?.trim() ?? '');
  return m?.[1];
}
