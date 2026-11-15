import type { IncomingMessage, ServerResponse } from 'node:http';

/** Version déployée : le commit Git en production comme en preview de PR. */
export interface DeploymentInfo {
  /** Identifiant court du commit (12 caractères) ou `dev` en local. */
  readonly version: string;
  readonly commit: string | undefined;
  readonly branch: string | undefined;
  /** Vrai pour une preview de pull request (Render : IS_PULL_REQUEST). */
  readonly preview: boolean;
  readonly service: string | undefined;
  /** URL publique du service (Render : RENDER_EXTERNAL_URL). */
  readonly url: string | undefined;
  readonly startedAt: string;
}

/**
 * Lit les variables injectées par Render à chaque déploiement
 * (RENDER_GIT_COMMIT, RENDER_GIT_BRANCH, IS_PULL_REQUEST, RENDER_SERVICE_NAME, RENDER_EXTERNAL_URL).
 * `GO_VERSION` permet de fixer la version sur un autre hébergeur.
 */
export function deploymentInfo(env: Record<string, string | undefined> = process.env, now = new Date()): DeploymentInfo {
  const commit = env.RENDER_GIT_COMMIT || env.GIT_COMMIT || undefined;
  return {
    version: env.GO_VERSION || commit?.slice(0, 12) || 'dev',
    commit,
    branch: env.RENDER_GIT_BRANCH || undefined,
    preview: env.IS_PULL_REQUEST === 'true',
    service: env.RENDER_SERVICE_NAME || undefined,
    url: env.RENDER_EXTERNAL_URL || undefined,
    startedAt: now.toISOString(),
  };
}

export const LIVE_VERSION_PATH = '/__go/version';
export const LIVE_EVENTS_PATH = '/__go/live';

/**
 * Canal « live » : les pages ouvertes s'abonnent en Server-Sent Events et reçoivent la version
 * déployée. Quand Render remplace l'instance, la connexion se coupe, le navigateur se reconnecte
 * au nouveau serveur, voit une autre version et se recharge.
 */
export class LiveChannel {
  private readonly clients = new Set<ServerResponse>();
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(readonly info: DeploymentInfo, private readonly heartbeatMs = 25_000) {}

  /** Nombre de pages connectées. */
  get size(): number {
    return this.clients.size;
  }

  attach(req: IncomingMessage, res: ServerResponse, headers: Record<string, string>): void {
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Désactive la mise en tampon des proxys (nginx, Render) pour un envoi immédiat.
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\nevent: version\ndata: ${JSON.stringify(this.info)}\n\n`);
    this.clients.add(res);
    req.socket.setKeepAlive(true);
    req.socket.setTimeout(0);
    res.on('close', () => this.clients.delete(res));
    this.heartbeat ??= setInterval(() => {
      for (const client of this.clients) client.write(': ping\n\n');
    }, this.heartbeatMs).unref();
  }

  /** Prévient les pages de l'arrêt (redéploiement) puis ferme les flux. */
  close(): void {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const client of this.clients) {
      client.end(`event: shutdown\ndata: {}\n\n`);
    }
    this.clients.clear();
  }
}
