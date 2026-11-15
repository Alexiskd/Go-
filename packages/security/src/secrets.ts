import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

/** Génère un secret aléatoire (base64url), par ex. pour JWT_SECRET. */
export const generateSecret = (bytes = 48): string => randomBytes(bytes).toString('base64url');

/** Identifiant opaque, non devinable (jetons de session, de réinitialisation…). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Comparaison à temps constant de deux chaînes (via leur empreinte, pour supporter des longueurs différentes). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

const WEAK = /^(changeme|secret|password|test|dev|123456|azerty|qwerty)/i;

/**
 * Lit un secret obligatoire depuis l'environnement et refuse les valeurs faibles.
 * Ne jamais importer ce module dans un bundle frontend.
 */
export function requireSecret(env: Record<string, string | undefined>, name: string, options: { minLength?: number } = {}): string {
  const value = env[name];
  const min = options.minLength ?? 32;
  if (!value) throw new Error(`Secret manquant : ${name}`);
  if (value.length < min) throw new Error(`Secret trop court : ${name} (minimum ${min} caractères)`);
  if (WEAK.test(value) || new Set(value).size < 8) throw new Error(`Secret trop faible : ${name}`);
  return value;
}
