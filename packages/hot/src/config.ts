/**
 * Configuration du superviseur, lue depuis l'environnement (Render : variables du service).
 * Tous les noms commencent par GO_HOT_.
 */
export interface HotConfig {
  /** Port public (Render fournit PORT). */
  port: number;
  /** Dépôt Git, ex. https://github.com/Alexiskd/Go-.git ou file:///chemin (tests). */
  repoUrl: string;
  /** Jeton GitHub en lecture pour un dépôt privé (jamais journalisé). */
  gitToken: string | undefined;
  /** Branche de production. */
  branch: string;
  /** Secret du webhook GitHub (signature HMAC SHA-256). Sans lui, le webhook est refusé. */
  webhookSecret: string | undefined;
  /** Dossier des versions construites. */
  releasesDir: string;
  /** Commandes exécutées dans chaque version (shell). */
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  /** Variable qui donne son port à l'application (ex. API_PORT), et celle de son hôte. */
  portEnv: string;
  hostEnv: string;
  /** Chemin vérifié avant la bascule (doit répondre 2xx). */
  healthPath: string;
  healthTimeoutMs: number;
  /** Délai maximal d'une étape (install, build). */
  stepTimeoutMs: number;
  /** Nombre maximal de previews de PR simultanées (mémoire limitée). */
  maxPreviews: number;
  /** Auteurs autorisés pour les previews (vide = tous les auteurs du dépôt, jamais les forks). */
  allowedAuthors: string[];
  /** Synchronise la production sur le dernier commit de la branche au démarrage. */
  syncOnBoot: boolean;
  /** Commit déjà présent dans le dossier courant (build Render initial). */
  initialCommit: string | undefined;
}

const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
const list = (v: string | undefined) => (v ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export function loadHotConfig(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): HotConfig {
  const repoUrl = env.GO_HOT_REPO ?? (env.RENDER_GIT_REPO_SLUG ? `https://github.com/${env.RENDER_GIT_REPO_SLUG}.git` : undefined);
  if (!repoUrl) throw new Error('GO_HOT_REPO manquant (URL du dépôt Git)');
  if (!env.GO_HOT_START) throw new Error("GO_HOT_START manquant (commande de démarrage de l'application, ex. node apps/api/dist/main.js)");
  return {
    port: int(env.PORT ?? env.GO_HOT_PORT, 10000),
    repoUrl,
    gitToken: env.GO_HOT_GIT_TOKEN || undefined,
    branch: env.GO_HOT_BRANCH ?? env.RENDER_GIT_BRANCH ?? 'main',
    webhookSecret: env.GO_HOT_WEBHOOK_SECRET || undefined,
    releasesDir: env.GO_HOT_RELEASES ?? `${cwd}/.go-hot`,
    installCommand: env.GO_HOT_INSTALL ?? 'npm install --include=dev --no-audit --no-fund',
    buildCommand: env.GO_HOT_BUILD ?? 'npm run build',
    startCommand: env.GO_HOT_START,
    portEnv: env.GO_HOT_PORT_ENV ?? 'API_PORT',
    hostEnv: env.GO_HOT_HOST_ENV ?? 'API_HOST',
    healthPath: env.GO_HOT_HEALTH ?? '/api/v1/health',
    healthTimeoutMs: int(env.GO_HOT_HEALTH_TIMEOUT_MS, 60_000),
    stepTimeoutMs: int(env.GO_HOT_STEP_TIMEOUT_MS, 15 * 60_000),
    maxPreviews: int(env.GO_HOT_MAX_PREVIEWS, 2),
    allowedAuthors: list(env.GO_HOT_ALLOWED_AUTHORS),
    syncOnBoot: env.GO_HOT_SYNC_ON_BOOT !== 'false',
    initialCommit: env.RENDER_GIT_COMMIT || undefined,
  };
}

/** URL d'accès Git avec le jeton, pour les dépôts privés ; à ne jamais journaliser. */
export function authenticatedUrl(config: Pick<HotConfig, 'repoUrl' | 'gitToken'>): string {
  if (!config.gitToken || !config.repoUrl.startsWith('https://')) return config.repoUrl;
  const url = new URL(config.repoUrl);
  url.username = 'x-access-token';
  url.password = config.gitToken;
  return url.toString();
}

/** Masque tout jeton présent dans un texte (messages d'erreur de git). */
export function redactSecrets(text: string, secrets: Array<string | undefined>): string {
  let out = text;
  for (const s of secrets) if (s) out = out.split(s).join('***');
  return out.replace(/x-access-token:[^@\s]+@/g, 'x-access-token:***@');
}
