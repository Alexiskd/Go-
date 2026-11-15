import { GoError, NotFoundError, type App, type GoModule } from '@go-/core';
import { apiV1, pageMeta, toOpenApi } from '@go-/contracts';
import { deploymentInfo, httpModule, type ContractHandlers } from '@go-/runtime';
import { createCorsPolicy, createRateLimiter, generateSecret, securityHeaders } from '@go-/security';
import type { Infer } from '@go-/shared';
import type { Environment } from '@go-/types';
import { AUTH_SERVICE, authModule } from './auth.js';
import type { apiConfig } from './config.js';
import { USER_SERVICE, toUserDto, usersModule } from './users.js';

export type ApiConfig = Infer<(typeof apiConfig)['schema']>;

/** Version déployée (commit Git sur Render, ou fixée par @go-/hot). */
const deployment = deploymentInfo();

/** Implémentation du contrat v1 : chaque handler reçoit des entrées déjà validées. */
export function createHandlers(app: App): ContractHandlers<typeof apiV1> {
  const users = () => app.container.resolve(USER_SERVICE);
  const auth = () => app.container.resolve(AUTH_SERVICE);
  const startedAt = Date.now();
  return {
    health: () => ({ status: 'ok', version: deployment.version, uptime: Math.round((Date.now() - startedAt) / 1000), checks: [{ name: 'users', ok: true }] }),
    login: ({ body }) => auth().login(body.email, body.password),
    me: async (_input, ctx) => {
      const user = await users().get(ctx.principal!.id);
      if (!user) throw new NotFoundError('Utilisateur introuvable');
      return toUserDto(user);
    },
    listUsers: async ({ query }) => {
      const { items, total } = await users().list(query.page, query.pageSize);
      return { items: items.map(toUserDto), meta: pageMeta(query.page, query.pageSize, total) };
    },
    getUser: async ({ params }) => {
      const user = await users().get(params.id);
      if (!user) throw new NotFoundError('Utilisateur introuvable');
      return toUserDto(user);
    },
    createUser: async ({ body }) => toUserDto(await users().create(body)),
  };
}

/** Assemble les modules de l'API de référence à partir de la configuration. */
export function apiModules(config: ApiConfig, env: Environment, warn: (msg: string) => void = console.warn): GoModule[] {
  let secret = config.jwtSecret;
  if (!secret) {
    if (env === 'production') throw new GoError('CONFIG_INVALID', 'API_JWT_SECRET est obligatoire en production');
    secret = generateSecret();
    warn('API_JWT_SECRET absent : secret éphémère généré (les jetons expireront au redémarrage)');
  }
  const limiter = createRateLimiter({ capacity: config.rateLimitPerMinute, refillPerSec: config.rateLimitPerMinute / 60 });
  const openapi = toOpenApi(apiV1, { description: 'API de référence de la stack GO-' });

  return [
    usersModule({
      passwordCost: config.passwordCost,
      ...(config.adminEmail && config.adminPassword && { admin: { email: config.adminEmail, password: config.adminPassword } }),
    }),
    authModule({ secret, expiresIn: config.jwtExpiresIn, passwordCost: config.passwordCost }),
    httpModule({
      port: config.port,
      host: config.host,
      dependsOn: ['auth'],
      server: (app) => ({
        contract: apiV1,
        handlers: createHandlers(app),
        authenticate: (req) => app.container.resolve(AUTH_SERVICE).authenticate(req),
        authorize: (principal, permission) => app.container.resolve(AUTH_SERVICE).authorize(principal, permission),
        cors: createCorsPolicy({ origins: config.corsOrigins }),
        headers: securityHeaders({ hsts: env === 'production' }),
        beforeRequest: (req, ctx) => {
          const r = limiter.take(req.socket.remoteAddress ?? 'inconnu');
          if (!r.allowed) {
            ctx.setHeader('Retry-After', String(r.retryAfterSec));
            throw new GoError('RATE_LIMITED', 'Trop de requêtes');
          }
        },
        extraRoutes: { 'GET /openapi.json': () => openapi },
        // Les pages ouvertes se rechargent dès qu'une nouvelle version est en ligne.
        live: deployment,
      }),
    }),
  ];
}
