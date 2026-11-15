import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hachage de mots de passe avec scrypt (node:crypto, RFC 7914).
 * Format stocké : `scrypt$N$r$p$sel$hash` (base64url), auto-descriptif pour permettre
 * d'augmenter le coût plus tard (`needsRehash`).
 */
export interface PasswordHashOptions {
  /** Coût CPU/mémoire, puissance de 2 (défaut 2^15). */
  N?: number;
  r?: number;
  p?: number;
  keyLength?: number;
}

const DEFAULTS = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 } as const;

const derive = (password: string, salt: Buffer, keyLength: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, keyLength, { ...options, maxmem: 256 * options.N! * options.r! }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

export async function hashPassword(password: string, options: PasswordHashOptions = {}): Promise<string> {
  const { N, r, p, keyLength } = { ...DEFAULTS, ...options };
  if (!password) throw new Error('Mot de passe vide');
  const salt = randomBytes(16);
  const key = await derive(password, salt, keyLength, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(keyB64, 'base64url');
  if (!expected.length) return false;
  try {
    const actual = await derive(password, Buffer.from(saltB64, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Vrai si le hash a été produit avec des paramètres plus faibles que ceux demandés. */
export function needsRehash(stored: string, options: PasswordHashOptions = {}): boolean {
  const { N, r, p } = { ...DEFAULTS, ...options };
  const [algo, n, rr, pp] = stored.split('$');
  return algo !== 'scrypt' || Number(n) < N || Number(rr) < r || Number(pp) < p;
}
