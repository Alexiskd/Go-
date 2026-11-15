import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import type { Logger } from '@go-/core';
import { redactSecrets, type HotConfig } from './config.js';
import { toAction, verifyGithubSignature, type HotAction } from './github.js';
import { createProxy } from './proxy.js';
import { prepareRelease, remoteHead, sh } from './release.js';
import { Worker } from './worker.js';

export const HOOK_PATH = '/__go/hook';
export const STATUS_PATH = '/__go/hot';
export const PREVIEW_COOKIE = 'go_preview';

interface SlotState {
  building: boolean;
  lastError?: string;
  requestedSha?: string;
}

export interface HotStatus {
  production: { sha: string; startedAt: string } | null;
  previews: { pr: number; sha: string; startedAt: string; url: string }[];
  building: string[];
  errors: Record<string, string>;
}

/**
 * Superviseur de mise à jour à chaud. Il reçoit le trafic public et le relaie à l'instance
 * de production, ou à la preview d'une PR choisie par cookie. À chaque événement GitHub signé,
 * il prépare la nouvelle version à côté de l'ancienne, vérifie qu'elle répond, bascule le trafic
 * puis arrête l'ancienne : aucune coupure, aucun redéploiement de l'hébergeur.
 */
export class Supervisor {
  private production: Worker | undefined;
  private readonly previews = new Map<number, Worker>();
  private readonly state = new Map<string, SlotState>();
  private readonly pending = new Map<string, HotAction>();
  private queue: Promise<void> = Promise.resolve();
  private readonly proxy = createProxy();
  private server: Server | undefined;
  /** Dossiers à ne jamais supprimer (build initial de l'hébergeur). */
  private readonly protectedDirs = new Set<string>();

  constructor(private readonly config: HotConfig, private readonly logger: Logger) {}

  /** Démarre le superviseur ; `initialDir` = code déjà construit par l'hébergeur (servi immédiatement). */
  async start(options: { initialDir?: string } = {}): Promise<{ port: number }> {
    await mkdir(this.config.releasesDir, { recursive: true });
    if (options.initialDir) {
      this.protectedDirs.add(options.initialDir);
      const sha = this.config.initialCommit ?? (await sh('git rev-parse HEAD', { cwd: options.initialDir, timeoutMs: 10_000 }).then((s) => s.trim(), () => 'initial'));
      this.production = await this.startWorker('production', options.initialDir, sha);
      this.logger.info(`production servie depuis le build initial (${sha.slice(0, 12)})`);
    }
    this.server = createServer((req, res) => void this.handle(req, res));
    this.server.on('upgrade', (req, socket, head) => {
      const target = this.targetFor(req);
      if (target) this.proxy.upgrade(req, socket, head, target.port);
      else socket.destroy();
    });
    this.server.keepAliveTimeout = 65_000;
    this.server.headersTimeout = 66_000;
    await new Promise<void>((resolve) => this.server!.listen(this.config.port, resolve));
    const { port } = this.server.address() as AddressInfo;
    this.logger.info(`superviseur à l'écoute sur le port ${port} (webhook : POST ${HOOK_PATH})`);
    if (this.config.syncOnBoot) void this.syncProduction();
    return { port };
  }

  /** Aligne la production sur le dernier commit de la branche (utile après un redémarrage de l'hébergeur). */
  async syncProduction(): Promise<void> {
    try {
      const head = await remoteHead(this.config, this.config.branch);
      if (head && head !== this.production?.sha) this.schedule({ type: 'production', sha: head });
    } catch (error) {
      this.logger.warn('synchronisation initiale impossible', { error: this.clean(error) });
    }
  }

  /** Planifie une action ; les actions d'un même emplacement sont fusionnées (seule la dernière compte). */
  schedule(action: HotAction): void {
    if (action.type === 'ignore') return;
    const key = action.type === 'production' ? 'production' : `pr-${action.pr}`;
    const queued = this.pending.has(key);
    this.pending.set(key, action);
    if (action.type !== 'close-preview') this.slot(key).requestedSha = action.sha;
    if (queued) return;
    this.queue = this.queue
      .then(() => {
        const next = this.pending.get(key)!;
        this.pending.delete(key);
        return this.run(key, next);
      })
      .catch((error) => this.logger.error('erreur inattendue du superviseur', { error: this.clean(error) }));
  }

  /** Attend la fin des mises à jour en cours (tests, arrêt). */
  idle(): Promise<void> {
    return this.queue;
  }

  status(): HotStatus {
    const errors: Record<string, string> = {};
    const building: string[] = [];
    for (const [key, s] of this.state) {
      if (s.lastError) errors[key] = s.lastError;
      if (s.building) building.push(key);
    }
    return {
      production: this.production ? { sha: this.production.sha, startedAt: this.production.startedAt } : null,
      previews: [...this.previews].map(([pr, w]) => ({ pr, sha: w.sha, startedAt: w.startedAt, url: `/pr/${pr}` })),
      building,
      errors,
    };
  }

  async stop(): Promise<void> {
    await this.queue;
    await new Promise<void>((resolve) => (this.server?.listening ? this.server.close(() => resolve()) : resolve()));
    this.server?.closeAllConnections();
    await Promise.all([this.production?.stop(), ...[...this.previews.values()].map((w) => w.stop())]);
    this.proxy.close();
  }

  /* ------------------------------------------------------------------ */

  private slot(key: string): SlotState {
    let s = this.state.get(key);
    if (!s) this.state.set(key, (s = { building: false }));
    return s;
  }

  private clean(error: unknown): string {
    return redactSecrets(error instanceof Error ? error.message : String(error), [this.config.gitToken, this.config.webhookSecret]);
  }

  private startWorker(name: string, dir: string, sha: string, preview?: number): Promise<Worker> {
    return Worker.start({
      name,
      dir,
      sha,
      command: this.config.startCommand,
      healthPath: this.config.healthPath,
      healthTimeoutMs: this.config.healthTimeoutMs,
      portEnv: this.config.portEnv,
      hostEnv: this.config.hostEnv,
      logger: this.logger,
      env: {
        GO_VERSION: preview ? `pr${preview}-${sha.slice(0, 12)}` : sha.slice(0, 12),
        RENDER_GIT_COMMIT: sha,
        IS_PULL_REQUEST: preview ? 'true' : 'false',
        ...(preview && { GO_HOT_PREVIEW: String(preview) }),
      },
    });
  }

  private async retire(worker: Worker | undefined): Promise<void> {
    if (!worker) return;
    await worker.stop();
    if (!this.protectedDirs.has(worker.dir)) await rm(worker.dir, { recursive: true, force: true });
  }

  private async run(key: string, action: HotAction): Promise<void> {
    const slot = this.slot(key);
    const log = this.logger.child(key);
    if (action.type === 'close-preview') {
      const worker = this.previews.get(action.pr);
      this.previews.delete(action.pr);
      this.state.delete(key);
      await this.retire(worker);
      if (worker) log.info('preview arrêtée (PR fermée)');
      return;
    }
    if (action.type === 'ignore') return;
    const current = action.type === 'production' ? this.production : this.previews.get(action.pr);
    if (current?.sha === action.sha) {
      log.info(`déjà à jour (${action.sha.slice(0, 12)})`);
      return;
    }
    slot.building = true;
    const started = Date.now();
    try {
      const release = await prepareRelease({
        config: this.config,
        name: key,
        ref: action.type === 'production' ? this.config.branch : action.ref,
        sha: action.sha,
        previousDir: (current ?? this.production)?.dir,
        logger: log,
      });
      let worker: Worker;
      try {
        worker = await this.startWorker(key, release.dir, release.sha, action.type === 'preview' ? action.pr : undefined);
      } catch (error) {
        await rm(release.dir, { recursive: true, force: true });
        throw error;
      }
      // Bascule : les nouvelles requêtes vont vers la nouvelle version, l'ancienne termine les siennes.
      if (action.type === 'production') {
        this.production = worker;
      } else {
        if (!current && this.previews.size >= this.config.maxPreviews) {
          const [oldestPr, oldest] = [...this.previews][0]!;
          this.previews.delete(oldestPr);
          log.warn(`limite de ${this.config.maxPreviews} previews : arrêt de la PR ${oldestPr}`);
          await this.retire(oldest);
        }
        this.previews.set(action.pr, worker);
      }
      delete slot.lastError;
      log.info(`en ligne : ${release.sha.slice(0, 12)} (${Math.round((Date.now() - started) / 1000)} s, sans redéploiement)`);
      await this.retire(current);
    } catch (error) {
      slot.lastError = this.clean(error);
      log.error(`mise à jour abandonnée, la version en ligne est conservée : ${slot.lastError}`);
    } finally {
      slot.building = false;
    }
  }

  /* ---------------- trafic ---------------- */

  private previewRequested(req: IncomingMessage): number | undefined {
    const header = req.headers['x-go-preview'];
    const fromHeader = typeof header === 'string' ? header : undefined;
    const fromCookie = /(?:^|;\s*)go_preview=(\d+)/.exec(req.headers.cookie ?? '')?.[1];
    const value = Number(fromHeader ?? fromCookie);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  private targetFor(req: IncomingMessage): Worker | undefined {
    const pr = this.previewRequested(req);
    const preview = pr ? this.previews.get(pr) : undefined;
    return preview?.alive ? preview : this.production;
  }

  private json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === HOOK_PATH) return this.webhook(req, res);
    if (req.method === 'GET' && url.pathname === STATUS_PATH) return this.json(res, 200, this.status());

    const prMatch = /^\/pr\/(\d+|off)\/?$/.exec(url.pathname);
    if (req.method === 'GET' && prMatch) {
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      if (prMatch[1] === 'off') {
        res.writeHead(302, { Location: '/', 'Set-Cookie': `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}` }).end();
        return;
      }
      const pr = Number(prMatch[1]);
      if (!this.previews.has(pr) && !this.slot(`pr-${pr}`).building) {
        return this.json(res, 404, { code: 'NOT_FOUND', message: `Aucune preview en ligne pour la PR ${pr}`, status: 404 });
      }
      res.writeHead(302, { Location: '/', 'Set-Cookie': `${PREVIEW_COOKIE}=${pr}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}` }).end();
      return;
    }

    const target = this.targetFor(req);
    if (!target?.alive) return this.json(res, 503, { code: 'UNAVAILABLE', message: 'Application en cours de démarrage', status: 503 }, { 'Retry-After': '5' });
    const pr = this.previewRequested(req);
    this.proxy.web(req, res, target.port, pr && target !== this.production ? { 'X-Go-Preview': String(pr) } : {});
  }

  private async webhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.config.webhookSecret) {
      return this.json(res, 503, { code: 'UNAVAILABLE', message: 'Webhook désactivé : GO_HOT_WEBHOOK_SECRET manquant', status: 503 });
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > 5 * 1024 * 1024) return this.json(res, 413, { code: 'BAD_REQUEST', message: 'Corps trop volumineux', status: 413 });
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);
    if (!verifyGithubSignature(this.config.webhookSecret, body, req.headers['x-hub-signature-256'] as string | undefined)) {
      this.logger.warn('webhook refusé : signature invalide');
      return this.json(res, 401, { code: 'UNAUTHORIZED', message: 'Signature invalide', status: 401 });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return this.json(res, 400, { code: 'BAD_REQUEST', message: 'JSON invalide', status: 400 });
    }
    const action = toAction(req.headers['x-github-event'] as string | undefined, payload, this.config);
    if (action.type === 'ignore') this.logger.info(`webhook ignoré : ${action.reason}`);
    else this.logger.info(`webhook accepté : ${action.type}${'pr' in action ? ` PR ${action.pr}` : ''}`);
    this.schedule(action);
    this.json(res, 202, { accepted: action.type !== 'ignore', action: action.type, ...(action.type === 'ignore' && { reason: action.reason }) });
  }
}
