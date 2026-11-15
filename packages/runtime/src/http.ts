import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ForbiddenError, GoError, UnauthorizedError, ValidationError, toGoError, type Logger } from '@go-/core';
import type { ContractSpec, EndpointInput, EndpointOutput, EndpointSpec } from '@go-/contracts';
import { coerceFromString, type Schema, type SchemaError } from '@go-/shared';
import type { Awaitable } from '@go-/types';

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
}

interface Route {
  name: string;
  endpoint: EndpointSpec;
  regex: RegExp;
  keys: string[];
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function compile(contract: ContractSpec): Route[] {
  return Object.entries(contract.endpoints).map(([name, endpoint]) => {
    const keys: string[] = [];
    const pattern = (contract.basePath + endpoint.path)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) => {
        keys.push(k);
        return '([^/]+)';
      });
    return { name, endpoint, keys, regex: new RegExp(`^${pattern}/?$`) };
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
  listen(port?: number, host?: string): Promise<{ port: number; url: string }>;
  close(timeoutMs?: number): Promise<void>;
}

/**
 * Serveur HTTP Node.js piloté par un contrat GO- : routage, validation des entrées,
 * authentification / permissions, validation des réponses, erreurs normalisées, CORS.
 */
export function createHttpServer<C extends ContractSpec>(options: HttpServerOptions<C>): GoHttpServer {
  const routes = compile(options.contract);
  const { logger, bodyLimitBytes = 1_048_576, validateResponses = true } = options;
  const needsAuthorize = routes.some((r) => typeof r.endpoint.auth === 'string');
  if (needsAuthorize && !options.authorize) throw new Error('Le contrat déclare des permissions : fournir `authorize`');
  if (routes.some((r) => r.endpoint.auth) && !options.authenticate) throw new Error('Le contrat exige une authentification : fournir `authenticate`');

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && SAFE_REQUEST_ID.test(incomingId) ? incomingId : randomUUID();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = (req.method ?? 'GET').toUpperCase();
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

    const send = (status: number, body: unknown, preflight = false) => {
      const headers: Record<string, string> = {
        ...options.headers,
        ...options.cors?.headers(origin, preflight),
        ...extraHeaders,
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      };
      if (body === undefined) {
        res.writeHead(status, headers).end();
      } else {
        res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
      }
      reqLogger.info(`${method} ${url.pathname} ${status}`, { durationMs: Math.round(performance.now() - started) });
    };

    try {
      if (method === 'OPTIONS') return send(204, undefined, true);
      await options.beforeRequest?.(req, ctx);

      const extra = options.extraRoutes?.[`${method} ${url.pathname}`];
      if (extra) return send(200, await extra(ctx));

      let route: Route | undefined;
      let match: RegExpExecArray | null = null;
      for (const r of routes) {
        if (r.endpoint.method !== method) continue;
        match = r.regex.exec(url.pathname);
        if (match) {
          route = r;
          break;
        }
      }
      if (!route || !match) throw new GoError('NOT_FOUND', `Route introuvable : ${method} ${url.pathname}`);
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
        const raw = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match![i + 1]!)]));
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
      send(endpoint.status ?? 200, body);
    } catch (error) {
      const goError = toGoError(error);
      if (goError.status >= 500) reqLogger.error('erreur serveur', { error });
      if (!res.headersSent) send(goError.status, goError.toPayload(requestId));
      else res.destroy();
    }
  };

  const server = createServer((req, res) => void handle(req, res));
  server.headersTimeout = 30_000;
  server.requestTimeout = 60_000;

  return {
    server,
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
