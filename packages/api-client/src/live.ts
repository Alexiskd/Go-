/**
 * Rechargement en direct côté navigateur : la page suit la version déployée par le serveur GO-
 * (`/__go/live`, Server-Sent Events) et se recharge dès qu'une nouvelle version est en ligne
 * — après la fusion d'une PR dans main, ou à chaque nouveau commit d'une preview de PR.
 */

export interface LiveVersion {
  version: string;
  commit?: string;
  branch?: string;
  preview?: boolean;
  url?: string;
  startedAt?: string;
}

/** Sous-ensemble d'EventSource utilisé (permet de l'injecter dans les tests). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  close(): void;
  onerror: ((event: unknown) => void) | null;
}

export interface WatchDeploymentsOptions {
  /** URL du serveur GO- (défaut : origine de la page). */
  baseUrl?: string;
  /** Appelé quand la version déployée change. */
  onUpdate?: (next: LiveVersion, previous: LiveVersion) => void;
  /** Recharge la page à la nouvelle version (défaut : true dans un navigateur). */
  reload?: boolean;
  /** Intervalle du mode de secours par interrogation, sans EventSource (défaut 15 s). */
  pollMs?: number;
  EventSource?: new (url: string) => EventSourceLike;
  fetch?: typeof fetch;
  /** Rechargement de la page (injectable pour les tests). */
  doReload?: () => void;
}

export interface DeploymentWatcher {
  /** Version en cours (undefined avant la première réponse). */
  readonly current: LiveVersion | undefined;
  stop(): void;
}

export function watchDeployments(options: WatchDeploymentsOptions = {}): DeploymentWatcher {
  const g = globalThis as { location?: { origin: string; reload(): void }; EventSource?: new (url: string) => EventSourceLike };
  const base = (options.baseUrl ?? g.location?.origin ?? '').replace(/\/$/, '');
  const ES = options.EventSource ?? g.EventSource;
  const doFetch: typeof fetch | undefined = options.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
  const reload = options.reload ?? !!g.location;
  const doReload = options.doReload ?? (() => g.location?.reload());
  let current: LiveVersion | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let source: EventSourceLike | undefined;

  const receive = (next: LiveVersion) => {
    if (stopped || !next?.version) return;
    if (!current) {
      current = next;
      return;
    }
    if (next.version === current.version) return;
    const previous = current;
    current = next;
    options.onUpdate?.(next, previous);
    if (reload) {
      stop();
      doReload();
    }
  };

  const poll = async () => {
    try {
      const res = await doFetch!(`${base}/__go/version`, { cache: 'no-store' } as RequestInit);
      if (res.ok) receive((await res.json()) as LiveVersion);
    } catch {
      /* serveur en cours de redéploiement : nouvel essai au prochain tour */
    }
  };

  function stop() {
    stopped = true;
    source?.close();
    if (timer) clearInterval(timer);
  }

  if (ES) {
    // EventSource se reconnecte seul (directive `retry` envoyée par le serveur).
    source = new ES(`${base}/__go/live`);
    source.addEventListener('version', (event) => {
      try {
        receive(JSON.parse(event.data) as LiveVersion);
      } catch {
        /* message illisible ignoré */
      }
    });
  } else if (doFetch) {
    void poll();
    timer = setInterval(() => void poll(), options.pollMs ?? 15_000);
    (timer as { unref?: () => void }).unref?.();
  }

  return {
    get current() {
      return current;
    },
    stop,
  };
}
