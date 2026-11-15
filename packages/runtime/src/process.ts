import type { App } from '@go-/core';

/** Compare deux versions semver simples (`22.12.0`). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** Vérifie la version de Node.js ; lève une erreur explicite si elle est trop ancienne. */
export function assertNodeVersion(minimum = '22.12.0', current = process.versions.node): void {
  if (compareVersions(current, minimum) < 0) {
    throw new Error(`GO- nécessite Node.js ${minimum} ou plus récent (version actuelle : ${current})`);
  }
}

export interface ProcessLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
}

export interface RunOptions {
  signals?: readonly NodeJS.Signals[];
  /** Délai maximal de l'arrêt propre avant sortie forcée (défaut 10 s). */
  shutdownTimeoutMs?: number;
  exit?: (code: number) => void;
  process?: ProcessLike;
}

export interface RunningApp {
  readonly app: App;
  /** Arrêt propre ; résout avec le code de sortie. */
  shutdown(reason?: string): Promise<number>;
}

/**
 * Démarre une application et gère son cycle de vie de processus :
 * SIGINT/SIGTERM → arrêt propre borné dans le temps, erreurs non gérées → arrêt + code 1.
 */
export async function runApp(app: App, options: RunOptions = {}): Promise<RunningApp> {
  const { signals = ['SIGINT', 'SIGTERM'], shutdownTimeoutMs = 10_000, exit = (code) => process.exit(code) } = options;
  const proc = options.process ?? process;
  let stopping: Promise<number> | undefined;

  const detach = () => {
    for (const signal of signals) proc.off(signal, onSignal);
    proc.off('uncaughtException', onFatal);
    proc.off('unhandledRejection', onFatal);
  };

  const shutdown = (reason = 'arrêt demandé', code = 0): Promise<number> =>
    (stopping ??= (async () => {
      app.logger.info(`arrêt de « ${app.name} » : ${reason}`);
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<number>((resolve) => {
        timer = setTimeout(() => {
          app.logger.error(`arrêt non terminé après ${shutdownTimeoutMs} ms, sortie forcée`);
          resolve(1);
        }, shutdownTimeoutMs);
        timer.unref?.();
      });
      const stop = app.stop().then(
        () => code,
        (error) => {
          app.logger.error('erreur pendant l’arrêt', { error });
          return 1;
        },
      );
      const finalCode = await Promise.race([stop, timeout]);
      clearTimeout(timer);
      detach();
      return finalCode;
    })());

  function onSignal(signal: NodeJS.Signals) {
    void shutdown(`signal ${signal}`).then(exit);
  }
  function onFatal(error: unknown) {
    app.logger.error('erreur fatale non gérée', { error });
    void shutdown('erreur fatale', 1).then(exit);
  }

  for (const signal of signals) proc.on(signal, onSignal);
  proc.on('uncaughtException', onFatal);
  proc.on('unhandledRejection', onFatal);

  try {
    await app.start();
  } catch (error) {
    detach();
    throw error;
  }
  return { app, shutdown: (reason) => shutdown(reason) };
}
