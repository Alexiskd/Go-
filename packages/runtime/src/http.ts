import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlib, gzip } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { ForbiddenError, GoError, UnauthorizedError, ValidationError, toGoError, type Logger } from '@go-/core';
import type { ContractSpec, EndpointInput, EndpointOutput, EndpointSpec } from '@go-/contracts';
import { coerceFromString, type Schema, type SchemaError } from '@go-/shared';
import type { Awaitable } from '@go-/types';
import { LIVE_EVENTS_PATH, LIVE_VERSION_PATH, LiveChannel, deploymentInfo, type DeploymentInfo } from './deployment.js';

export interface Principal {
  readonly id: string;
  readonly role?: string;
  readonly [claim: string]: unknown;
}

export interface RequestContext {
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingMessage['headers'];
  readonly ip: string | undefined;
  readonly logger: Logger;
  /** Utilisateur authentifié (présent si l'endpoint exige une authentification). */
  readonly principal: Principal | undefined;
  /** Annulé si le client se déconnecte. */
  readonly signal: AbortSignal;
  /** Ajoute un en-tête à la réponse. */
  setHeader(name: string, value: string): void;
}

export type EndpointHandler<E extends EndpointSpec> = (input: EndpointInput<E>, ctx: RequestContext) => Awaitable<EndpointOutput<E>>;
export type ContractHandlers<C extends ContractSpec> = { [K in keyof C['endpoints']]: EndpointHandler<C['endpoints'][K]> };

/** Interface minimale attendue pour CORS (compatible avec @go-/security). */
export interface CorsLike {
  headers(origin: string | undefined, preflight?: boolean): Record<string, string>;
}

export interface HttpServerOptions<C extends ContractSpec> {
  contract: C;
  handlers: ContractHandlers<C>;
  logger: Logger;
  /** Résout l'utilisateur à partir de la requête ; `undefined` = anonyme. */
  authenticate?: (req: IncomingMessage) => Awaitable<Principal | undefined>;
  /** Vérifie une permission (`auth: 'users:write'`). Obligatoire si le contrat en déclare. */
  authorize?: (principal: Principal, permission: string) => Awaitable<boolean>;
  cors?: CorsLike;
  /** En-têtes ajoutés à toutes les réponses (ex. securityHeaders()). */
  headers?: Record<string, string>;
  /** Taille maximale du corps (défaut 1 Mo). */
  bodyLimitBytes?: number;
  /** Valide (et nettoie) chaque réponse avec son schéma — défaut true. */
  validateResponses?: boolean;
  /** Routes supplémentaires hors contrat (ex. `GET /openapi.json`). */
  extraRoutes?: Record<string, (ctx: RequestContext) => Awaitable<unknown>>;
  /** Appelé avant chaque requête (limitation de débit…) ; lever une GoError pour refuser. */
  beforeRequest?: (req: IncomingMessage, ctx: RequestContext) => Awaitable<void>;
  /**
   * Compression des réponses JSON (brotli ou gzip selon Accept-Encoding) au-delà de `threshold` octets.
   * Défaut : activée, seuil 1 024 octets. `false` pour la désactiver (ex. derrière un proxy qui compresse).
   */
  compression?: boolean | { threshold?: number };
  /** ETag faible + réponse 304 sur les GET réussis (défaut true). */
  etag?: boolean;
  /**
   * Rechargement en direct après redéploiement : expose `GET /__go/version` et le flux
   * `GET /__go/live` (Server-Sent Events), et ajoute l'en-tête `X-Go-Version` à chaque réponse.
   * `true` lit la version depuis l'environnement Render ; défaut : désactivé.
   */
  live?: boolean | DeploymentInfo;
}

interface Route {
  name: string;
  endpoint: EndpointSpec;
  /** Chemin complet (basePath + path). */
  path: string;
  regex: RegExp;
  keys: string[];
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;
const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Choix de l'encodage : brotli (qualité 4, rapide) en priorité, sinon gzip. */
function pickEncoding(accept: string | undefined): 'br' | 'gzip' | undefined {
  if (!accept) return undefined;
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return undefined;
}

const etagOf = (body: Buffer) => `W/"${createHash('sha1').update(body).digest('base64url')}"`;

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(',').some((t) => {
    const v = t.trim();
    return v === '*' || v === etag || v.replace(/^W\//, '') === etag.replace(/^W\//, '');
  });
}

/** Index des routes : accès direct pour les chemins fixes, liste par méthode pour les chemins à paramètres. */
function indexRoutes(routes: Route[]) {
  const fixed = new Map<string, Route>();
  const dynamic = new Map<string, Route[]>();
  for (const r of routes) {
    if (r.keys.length === 0) fixed.set(`${r.endpoint.method} ${r.path}`, r);
    else {
      const list = dynamic.get(r.endpoint.method) ?? [];
      list.push(r);
      dynamic.set(r.endpoint.method, list);
    }
  }
  return (method: string, pathname: string): { route: Route; match: RegExpExecArray | null } | undefined => {
    const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const direct = fixed.get(`${method} ${normalized}`);
    if (direct) return { route: direct, match: null };
    for (const r of dynamic.get(method) ?? []) {
      const match = r.regex.exec(pathname);
      if (match) return { route: r, match };
    }
    return undefined;
  };
}

function compile(contract: ContractSpec): Route[] {
  return Object.entries(contract.endpoints).map(([name, endpoint]) => {
    const keys: string[] = [];
    const pattern = (contract.basePath + endpoint.path)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) => {
        keys.push(k);
        return '([^/]+)';
      });
    return { name, endpoint, keys, path: contract.basePath + endpoint.path, regex: new RegExp(`^${pattern}/?$`) };
  });
}

function validationError(where: string, error: SchemaError): ValidationError {
  return new ValidationError(`Données invalides (${where})`, {
    details: { issues: error.issues.map((i) => ({ path: [where, ...i.path].join('.'), message: i.message, code: i.code })) },
  });
}

function parseStrings(raw: Record<string, string>, schema: Schema<unknown> & { shape?: Record<string, Schema<unknown>> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const field = schema.shape?.[k];
    out[k] = field ? coerceFromString(v, field) : v;
  }
  return out;
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!/^application\/(.+\+)?json\b/i.test(type)) throw new GoError('BAD_REQUEST', 'Content-Type application/json attendu');
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new GoError('BAD_REQUEST', `Corps trop volumineux (max ${limit} octets)`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new GoError('BAD_REQUEST', `Corps trop volumineux (max ${limit} octets)`);
    chunks.push(chunk as Buffer);
  }
  if (!size) throw new GoError('BAD_REQUEST', 'Corps JSON manquant');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GoError('BAD_REQUEST', 'JSON invalide');
  }
}

export interface GoHttpServer {
  readonly server: Server;
  /** Canal de rechargement en direct (si `live` est activé). */
  readonly live: LiveChannel | undefined;
  listen(port?: number, host?: string): Promise<{ port: number; url: string }>;
  close(timeoutMs?: number): Promise<void>;
}

/**
 * Serveur HTTP Node.js piloté par un contrat GO- : routage, validation des entrées,
 * authentification / permissions, validation des réponses, erreurs normalisées, CORS.
 */
export function createHttpServer<C extends ContractSpec>(options: HttpServerOptions<C>): GoHttpServer {
  const routes = compile(options.contract);
  const findRoute = indexRoutes(routes);
  const { logger, bodyLimitBytes = 1_048_576, validateResponses = true, etag = true } = options;
  const live = options.live ? new LiveChannel(options.live === true ? deploymentInfo() : options.live) : undefined;
  const threshold = options.compression === false ? Infinity : (typeof options.compression === 'object' ? options.compression.threshold : undefined) ?? 1024;
  const needsAuthorize = routes.some((r) => typeof r.endpoint.auth === 'string');
  if (needsAuthorize && !options.authorize) throw new Error('Le contrat déclare des permissions : fournir `authorize`');
  if (routes.some((r) => r.endpoint.auth) && !options.authenticate) throw new Error('Le contrat exige une authentification : fournir `authenticate`');

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && SAFE_REQUEST_ID.test(incomingId) ? incomingId : randomUUID();
    const url = new URL(req.url ?? '/', 'http://localhost');
    // HEAD est traité comme GET, sans corps (sondes de santé, vérifications de liens).
    const isHead = (req.method ?? '').toUpperCase() === 'HEAD';
    const method = isHead ? 'GET' : (req.method ?? 'GET').toUpperCase();
    const origin = req.headers.origin;
    const abort = new AbortController();
    res.on('close', () => !res.writableFinished && abort.abort());
    const extraHeaders: Record<string, string> = {};
    let principal: Principal | undefined;
    const reqLogger = logger.child('req', { requestId });

    const ctx: RequestContext = {
      requestId,
      method,
      path: url.pathname,
      headers: req.headers,
      ip: req.socket.remoteAddress,
      logger: reqLogger,
      get principal() {
        return principal;
      },
      signal: abort.signal,
      setHeader: (name, value) => void (extraHeaders[name] = value),
    };

    const send = async (status: number, body: unknown, preflight = false, cacheControl = 'no-store') => {
      const cors = options.cors?.headers(origin, preflight);
      const headers: Record<string, string> = {
        ...options.headers,
        ...cors,
        ...extraHeaders,
        'X-Request-Id': requestId,
        'Cache-Control': cacheControl,
        ...(live && { 'X-Go-Version': live.info.version }),
      };
      const vary = new Set((headers.Vary ?? '').split(',').map((v) => v.trim()).filter(Boolean));
      let payload: Buffer | undefined;
      if (body !== undefined) {
        payload = Buffer.from(JSON.stringify(body));
        headers['Content-Type'] = 'application/json; charset=utf-8';
        if (etag && method === 'GET' && status === 200) {
          const tag = etagOf(payload);
          headers.ETag = tag;
          if (etagMatches(req.headers['if-none-match'] as string | undefined, tag)) {
            status = 304;
            payload = undefined;
            delete headers['Content-Type'];
          }
        }
        if (payload && payload.length >= threshold) {
          vary.add('Accept-Encoding');
          const encoding = pickEncoding(req.headers['accept-encoding'] as string | undefined);
          if (encoding) {
            payload = encoding === 'br'
              ? await brotli(payload, { params: { [zlib.BROTLI_PARAM_QUALITY]: 4, [zlib.BROTLI_PARAM_SIZE_HINT]: payload.length } })
              : await gzipAsync(payload, { level: 5 });
            headers['Content-Encoding'] = encoding;
          }
        }
      }
      if (vary.size) headers.Vary = [...vary].join(', ');
      if (payload) headers['Content-Length'] = String(payload.length);
      res.writeHead(status, headers).end(isHead ? undefined : payload);
      if (reqLogger.isEnabled('info')) {
        reqLogger.info(`${method} ${url.pathname} ${status}`, { durationMs: Math.round(performance.now() - started) });
      }
    };

    try {
      if (method === 'OPTIONS') return await send(204, undefined, true);
      await options.beforeRequest?.(req, ctx);

      if (live && method === 'GET' && url.pathname === LIVE_EVENTS_PATH) {
        live.attach(req, res, { ...options.headers, ...options.cors?.headers(origin), 'X-Request-Id': requestId, 'X-Go-Version': live.info.version });
        return;
      }
      if (live && method === 'GET' && url.pathname === LIVE_VERSION_PATH) return await send(200, live.info);
      const extra = options.extraRoutes?.[`${method} ${url.pathname}`];
      if (extra) return await send(200, await extra(ctx));

      const found = findRoute(method, url.pathname);
      if (!found) throw new GoError('NOT_FOUND', `Route introuvable : ${method} ${url.pathname}`);
      const { route, match } = found;
      const { endpoint } = route;

      if (endpoint.auth) {
        principal = await options.authenticate!(req);
        if (!principal) throw new UnauthorizedError();
        if (typeof endpoint.auth === 'string' && !(await options.authorize!(principal, endpoint.auth))) {
          throw new ForbiddenError(`Permission requise : ${endpoint.auth}`);
        }
      } else if (options.authenticate) {
        principal = await options.authenticate(req);
      }

      const input: Record<string, unknown> = {};
      if (endpoint.params) {
        const raw = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match?.[i + 1] ?? '')]));
        const r = endpoint.params.safeParse(parseStrings(raw, endpoint.params));
        if (!r.ok) throw validationError('params', r.error);
        input.params = r.value;
      }
      if (endpoint.query) {
        const r = endpoint.query.safeParse(parseStrings(Object.fromEntries(url.searchParams), endpoint.query));
        if (!r.ok) throw validationError('query', r.error);
        input.query = r.value;
      }
      if (endpoint.body) {
        const r = endpoint.body.safeParse(await readJson(req, bodyLimitBytes));
        if (!r.ok) throw validationError('body', r.error);
        input.body = r.value;
      }

      const handler = options.handlers[route.name as keyof C['endpoints']] as unknown as EndpointHandler<EndpointSpec>;
      const output = await handler(input as EndpointInput<EndpointSpec>, ctx);
      let body: unknown = output;
      if (validateResponses) {
        const r = endpoint.response.safeParse(output);
        if (!r.ok) {
          reqLogger.error(`réponse non conforme au contrat pour « ${route.name} »`, { issues: r.error.issues });
          throw new GoError('INTERNAL', 'Réponse non conforme au contrat', { expose: false });
        }
        body = r.value;
      }
      await send(endpoint.status ?? 200, body, false, endpoint.cacheControl ?? (endpoint.auth ? 'private, no-store' : 'no-store'));
    } catch (error) {
      const goError = toGoError(error);
      if (goError.status >= 500) reqLogger.error('erreur serveur', { error });
      if (!res.headersSent) await send(goError.status, goError.toPayload(requestId));
      else res.destroy();
    }
  };

  const server = createServer((req, res) => void handle(req, res));
  // Keep-alive plus long que celui des répartiteurs de charge (Render, AWS ALB : 60 s)
  // pour éviter les 502 dus à une connexion fermée côté serveur pendant sa réutilisation.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 60_000;

  return {
    server,
    live,
    listen(port = 0, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const address = server.address() as AddressInfo;
          const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
          resolve({ port: address.port, url: `http://${shownHost}:${address.port}` });
        });
      });
    },
    close(timeoutMs = 5_000) {
      // Les flux live sont des connexions longues : on les termine d'abord pour un arrêt immédiat.
      live?.close();
      return new Promise((resolve, reject) => {
        if (!server.listening) return resolve();
        const timer = setTimeout(() => server.closeAllConnections(), timeoutMs);
        timer.unref();
        server.close((error) => {
          clearTimeout(timer);
          error ? reject(error) : resolve();
        });
        server.closeIdleConnections();
      });
    },
  };
}
