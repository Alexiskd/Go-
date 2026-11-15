import type { Awaitable, Environment } from '@go-/types';
import { deepFreeze } from '@go-/shared';
import { Container, token } from './container.js';
import { EventBus } from './events.js';
import { createLogger, type Logger } from './logger.js';

export interface AppEvents {
  'app:init': { app: App };
  'app:started': { app: App };
  'app:stopping': { app: App };
  'app:stopped': { app: App };
  [event: string]: unknown;
}

export interface ModuleContext {
  readonly app: App;
  readonly container: Container;
  readonly events: EventBus<AppEvents>;
  readonly logger: Logger;
  readonly config: Readonly<Record<string, unknown>>;
  readonly env: Environment;
}

/** Un module a une responsabilité unique et déclare ses dépendances. */
export interface GoModule {
  readonly name: string;
  readonly dependsOn?: readonly string[];
  /** Enregistre ses fournisseurs dans le conteneur (synchrone, sans effet de bord). */
  register?(ctx: ModuleContext): void;
  onInit?(ctx: ModuleContext): Awaitable<void>;
  onStart?(ctx: ModuleContext): Awaitable<void>;
  onStop?(ctx: ModuleContext): Awaitable<void>;
}

/** Un plugin étend l'application de l'extérieur (observabilité, intégrations…). */
export interface GoPlugin {
  readonly name: string;
  setup(app: App): Awaitable<void>;
}

export const defineModule = <M extends GoModule>(module: M): M => module;
export const definePlugin = <P extends GoPlugin>(plugin: P): P => plugin;

export const APP = token<App>('app');
export const LOGGER = token<Logger>('logger');
export const CONFIG = token<Readonly<Record<string, unknown>>>('config');
export const EVENTS = token<EventBus<AppEvents>>('events');

export type AppState = 'created' | 'initialized' | 'started' | 'stopped';

export interface AppOptions {
  name: string;
  env?: Environment;
  config?: Record<string, unknown>;
  logger?: Logger;
  modules?: readonly GoModule[];
  plugins?: readonly GoPlugin[];
}

export interface App {
  readonly name: string;
  readonly env: Environment;
  readonly state: AppState;
  readonly container: Container;
  readonly events: EventBus<AppEvents>;
  readonly logger: Logger;
  readonly config: Readonly<Record<string, unknown>>;
  readonly modules: readonly GoModule[];
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Trie les modules pour que chaque dépendance soit initialisée avant son dépendant. */
export function sortModules(modules: readonly GoModule[]): GoModule[] {
  const byName = new Map<string, GoModule>();
  for (const m of modules) {
    if (byName.has(m.name)) throw new Error(`Module « ${m.name} » déclaré deux fois`);
    byName.set(m.name, m);
  }
  const sorted: GoModule[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (m: GoModule, trail: string[]) => {
    const s = state.get(m.name);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`Dépendance circulaire entre modules : ${[...trail, m.name].join(' → ')}`);
    state.set(m.name, 'visiting');
    for (const dep of m.dependsOn ?? []) {
      const d = byName.get(dep);
      if (!d) throw new Error(`Le module « ${m.name} » dépend de « ${dep} », absent de l'application`);
      visit(d, [...trail, m.name]);
    }
    state.set(m.name, 'done');
    sorted.push(m);
  };
  for (const m of modules) visit(m, []);
  return sorted;
}

export function createApp(options: AppOptions): App {
  const env = options.env ?? 'development';
  const logger = options.logger ?? createLogger({ name: options.name, format: env === 'production' ? 'json' : 'pretty' });
  const config = deepFreeze({ ...options.config });
  const modules = sortModules(options.modules ?? []);
  const container = new Container();
  const events = new EventBus<AppEvents>();
  let state: AppState = 'created';
  let pending: Promise<void> | undefined;

  const app: App = {
    name: options.name,
    env,
    get state() {
      return state;
    },
    container,
    events,
    logger,
    config,
    modules,
    async init() {
      if (state !== 'created') return;
      return (pending ??= (async () => {
        for (const plugin of options.plugins ?? []) {
          await plugin.setup(app);
          logger.debug(`plugin « ${plugin.name} » chargé`);
        }
        for (const m of modules) m.register?.(ctxFor(m));
        for (const m of modules) {
          await m.onInit?.(ctxFor(m));
          logger.debug(`module « ${m.name} » initialisé`);
        }
        state = 'initialized';
        await events.emit('app:init', { app });
      })().finally(() => (pending = undefined)));
    },
    async start() {
      if (state === 'started') return;
      if (state === 'stopped') throw new Error('Une application arrêtée ne peut pas redémarrer');
      await app.init();
      const started: GoModule[] = [];
      try {
        for (const m of modules) {
          await m.onStart?.(ctxFor(m));
          started.push(m);
        }
      } catch (error) {
        logger.error('échec du démarrage, arrêt des modules déjà démarrés', { error });
        for (const m of started.reverse()) {
          try {
            await m.onStop?.(ctxFor(m));
          } catch (stopError) {
            logger.error(`échec de l'arrêt du module « ${m.name} »`, { error: stopError });
          }
        }
        state = 'stopped';
        throw error;
      }
      state = 'started';
      logger.info(`application « ${app.name} » démarrée`, { env, modules: modules.map((m) => m.name) });
      await events.emit('app:started', { app });
    },
    async stop() {
      if (state === 'stopped' || state === 'created') {
        state = 'stopped';
        return;
      }
      await events.emit('app:stopping', { app });
      const errors: unknown[] = [];
      for (const m of [...modules].reverse()) {
        try {
          await m.onStop?.(ctxFor(m));
        } catch (error) {
          errors.push(error);
          logger.error(`échec de l'arrêt du module « ${m.name} »`, { error });
        }
      }
      state = 'stopped';
      await events.emit('app:stopped', { app });
      if (errors.length) throw new AggregateError(errors, 'Arrêt incomplet');
    },
  };

  container.value(APP, app).value(LOGGER, logger).value(CONFIG, config).value(EVENTS, events);
  const contexts = new Map<string, ModuleContext>();
  const ctxFor = (m: GoModule): ModuleContext => {
    let ctx = contexts.get(m.name);
    if (!ctx) {
      ctx = { app, container, events, config, env, logger: logger.child(m.name) };
      contexts.set(m.name, ctx);
    }
    return ctx;
  };
  return app;
}
