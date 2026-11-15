/* ---------- CORS ---------- */

export interface CorsOptions {
  /** Origines autorisées (comparaison exacte) ou `'*'` (interdit avec credentials). */
  origins: readonly string[] | '*';
  credentials?: boolean;
  methods?: readonly string[];
  headers?: readonly string[];
  maxAgeSec?: number;
}

export interface CorsPolicy {
  isAllowed(origin: string | undefined): boolean;
  /** En-têtes à renvoyer ; vide si l'origine n'est pas autorisée. */
  headers(origin: string | undefined, preflight?: boolean): Record<string, string>;
}

export function createCorsPolicy(options: CorsOptions): CorsPolicy {
  if (options.origins === '*' && options.credentials) throw new Error("CORS : l'origine '*' est interdite avec credentials");
  const allowed = options.origins === '*' ? null : new Set(options.origins.map((o) => o.replace(/\/$/, '')));
  const methods = (options.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).join(', ');
  const allowHeaders = (options.headers ?? ['Content-Type', 'Authorization', 'X-Request-Id']).join(', ');
  const isAllowed = (origin: string | undefined) => !!origin && (allowed === null || allowed.has(origin));

  return {
    isAllowed,
    headers(origin, preflight = false) {
      if (!isAllowed(origin)) return {};
      return {
        'Access-Control-Allow-Origin': allowed === null ? '*' : origin!,
        ...(allowed !== null && { Vary: 'Origin' }),
        ...(options.credentials && { 'Access-Control-Allow-Credentials': 'true' }),
        ...(preflight && {
          'Access-Control-Allow-Methods': methods,
          'Access-Control-Allow-Headers': allowHeaders,
          'Access-Control-Max-Age': String(options.maxAgeSec ?? 600),
        }),
      };
    },
  };
}

/* ---------- En-têtes de sécurité ---------- */

/** En-têtes recommandés pour une API JSON (OWASP Secure Headers). */
export function securityHeaders(options: { hsts?: boolean } = {}): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(options.hsts && { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' }),
  };
}

/* ---------- Limitation de débit ---------- */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Secondes avant qu'un nouveau jeton soit disponible. */
  retryAfterSec: number;
}

/** Seau à jetons en mémoire, par clé (IP, utilisateur…). Pour plusieurs instances, utiliser un stockage partagé. */
export function createRateLimiter(options: { capacity: number; refillPerSec: number; now?: () => number; maxKeys?: number }) {
  const { capacity, refillPerSec, now = () => Date.now() / 1000, maxKeys = 10_000 } = options;
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    take(key: string, cost = 1): RateLimitResult {
      const t = now();
      const b = buckets.get(key) ?? { tokens: capacity, at: t };
      b.tokens = Math.min(capacity, b.tokens + (t - b.at) * refillPerSec);
      b.at = t;
      buckets.delete(key);
      if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value!);
      buckets.set(key, b);
      if (b.tokens >= cost) {
        b.tokens -= cost;
        return { allowed: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
      }
      return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((cost - b.tokens) / refillPerSec) };
    },
    reset: (key: string) => void buckets.delete(key),
  };
}
