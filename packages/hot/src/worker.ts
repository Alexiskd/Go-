import { spawn, type ChildProcess } from 'node:child_process';
import { request } from 'node:http';
import { createServer, type AddressInfo } from 'node:net';
import type { Logger } from '@go-/core';

/** Réserve un port libre sur la boucle locale. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

function probe(port: number, path: string): Promise<number> {
  return new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path, timeout: 2_000 }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

/** Une instance de l'application, lancée sur un port interne. */
export class Worker {
  private exited = false;
  readonly startedAt = new Date().toISOString();

  private constructor(
    readonly name: string,
    readonly dir: string,
    readonly sha: string,
    readonly port: number,
    private readonly child: ChildProcess,
  ) {
    child.once('exit', () => (this.exited = true));
  }

  get alive(): boolean {
    return !this.exited;
  }

  /**
   * Démarre l'application et attend que son chemin de santé réponde 2xx.
   * En cas d'échec, le processus est arrêté et l'erreur remontée : la version en ligne reste en place.
   */
  static async start(params: {
    name: string;
    dir: string;
    sha: string;
    command: string;
    env: Record<string, string>;
    healthPath: string;
    healthTimeoutMs: number;
    portEnv: string;
    hostEnv: string;
    logger: Logger;
  }): Promise<Worker> {
    const port = await freePort();
    // `exec` remplace le shell par l'application : les signaux d'arrêt lui parviennent directement.
    const child = spawn('sh', ['-c', `exec ${params.command}`], {
      cwd: params.dir,
      env: { ...process.env, ...params.env, PORT: String(port), [params.portEnv]: String(port), [params.hostEnv]: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = params.logger.child(params.name);
    const forward = (level: 'info' | 'error') => (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) if (line.trim()) log[level](line.trimEnd());
    };
    child.stdout?.on('data', forward('info'));
    child.stderr?.on('data', forward('error'));
    const worker = new Worker(params.name, params.dir, params.sha, port, child);

    const deadline = Date.now() + params.healthTimeoutMs;
    while (Date.now() < deadline) {
      if (!worker.alive) throw new Error(`« ${params.name} » s'est arrêté pendant le démarrage`);
      const status = await probe(port, params.healthPath);
      if (status >= 200 && status < 300) return worker;
      await new Promise((r) => setTimeout(r, 250));
    }
    await worker.stop(2_000);
    throw new Error(`« ${params.name} » ne répond pas sur ${params.healthPath} après ${params.healthTimeoutMs} ms`);
  }

  /** Arrêt propre (SIGTERM), forcé après le délai. */
  stop(timeoutMs = 10_000): Promise<void> {
    if (!this.alive) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.child.kill('SIGKILL'), timeoutMs);
      this.child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      this.child.kill('SIGTERM');
    });
  }
}
