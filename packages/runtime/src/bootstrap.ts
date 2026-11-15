import { createApp, createLogger, defineModule, token, type App, type GoModule, type GoPlugin, type Logger } from '@go-/core';
import { loadEnvFiles, redactConfig, resolveEnvironment, type ConfigDefinition } from '@go-/config';
import type { ContractSpec } from '@go-/contracts';
import type { Infer, ObjectSchema, Shape } from '@go-/shared';
import { isLogLevel, type LogLevel } from '@go-/types';
import { createHttpServer, type GoHttpServer, type HttpServerOptions } from './http.js';
import { assertNodeVersion } from './process.js';

export interface BootstrapOptions<S extends Shape> {
  name: string;
  config: ConfigDefinition<S>;
  /** Préfixe des variables d'environnement (ex. `API`). */
  envPrefix?: string;
  modules?: (config: Readonly<Infer<ObjectSchema<S>>>) => readonly GoModule[];
  plugins?: readonly GoPlugin[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  logger?: Logger;
}

/**
 * Prépare une application GO- : version de Node, environnement, fichiers .env,
 * configuration validée, logger adapté à l'environnement. N'effectue aucun démarrage.
 */
export function bootstrap<S extends Shape>(options: BootstrapOptions<S>): { app: App; config: Readonly<Infer<ObjectSchema<S>>> } {
  assertNodeVersion();
  const baseEnv = options.env ?? process.env;
  const environment = resolveEnvironment(baseEnv.NODE_ENV);
  const { env, loaded } = loadEnvFiles({ environment, env: baseEnv, ...(options.cwd && { cwd: options.cwd }) });
  const config = options.config.load({ env, ...(options.envPrefix && { prefix: options.envPrefix }) });
  const level: LogLevel = isLogLevel(env.LOG_LEVEL) ? env.LOG_LEVEL : environment === 'production' ? 'info' : environment === 'test' ? 'warn' : 'debug';
  const logger = options.logger ?? createLogger({ name: options.name, level, format: environment === 'production' ? 'json' : 'pretty' });
  logger.debug('configuration chargée', { files: loaded, config: redactConfig(config as Record<string, unknown>, options.config.secrets) });
  const app = createApp({
    name: options.name,
    env: environment,
    logger,
    config: config as Record<string, unknown>,
    modules: options.modules?.(config) ?? [],
    ...(options.plugins && { plugins: options.plugins }),
  });
  return { app, config };
}

export const HTTP_SERVER = token<GoHttpServer>('http-server');

/**
 * Module GO- exposant un contrat en HTTP : démarre le serveur avec l'application
 * et l'arrête proprement avec elle.
 */
export function httpModule<C extends ContractSpec>(options: {
  port: number;
  host?: string;
  dependsOn?: readonly string[];
  server: (app: App) => Omit<HttpServerOptions<C>, 'logger'> & { logger?: Logger };
}): GoModule {
  let http: GoHttpServer | undefined;
  return defineModule({
    name: 'http',
    ...(options.dependsOn && { dependsOn: options.dependsOn }),
    register: ({ container, app, logger }) => {
      container.factory(HTTP_SERVER, () => (http ??= createHttpServer({ logger, ...options.server(app) })));
    },
    async onStart({ container, logger }) {
      const { url } = await container.resolve(HTTP_SERVER).listen(options.port, options.host);
      logger.info(`à l'écoute sur ${url}`);
    },
    async onStop() {
      await http?.close();
    },
  });
}
