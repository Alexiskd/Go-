import { createHmac, timingSafeEqual } from 'node:crypto';

/** Vérifie l'en-tête `X-Hub-Signature-256` d'un webhook GitHub (HMAC SHA-256 du corps brut). */
export function verifyGithubSignature(secret: string, body: Buffer, header: string | undefined): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const actual = Buffer.from(header.slice(7));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type HotAction =
  | { type: 'production'; sha: string }
  | { type: 'preview'; pr: number; sha: string; ref: string; author: string }
  | { type: 'close-preview'; pr: number }
  | { type: 'ignore'; reason: string };

interface PushPayload {
  ref?: string;
  after?: string;
  deleted?: boolean;
}
interface PullRequestPayload {
  action?: string;
  number?: number;
  repository?: { full_name?: string };
  pull_request?: {
    head?: { sha?: string; ref?: string; repo?: { full_name?: string } | null };
    user?: { login?: string };
  };
}

/**
 * Traduit un événement GitHub en action :
 *  - push sur la branche de production → mise à jour de la production ;
 *  - pull_request opened / reopened / synchronize → preview de la PR ;
 *  - pull_request closed → arrêt de la preview.
 * Les PR venant de forks sont refusées : leur code s'exécuterait sur le serveur.
 */
export function toAction(event: string | undefined, payload: unknown, options: { branch: string; allowedAuthors: string[] }): HotAction {
  if (event === 'ping') return { type: 'ignore', reason: 'ping' };
  if (event === 'push') {
    const p = payload as PushPayload;
    if (p.ref !== `refs/heads/${options.branch}`) return { type: 'ignore', reason: `push sur ${p.ref ?? '?'}` };
    if (p.deleted || !p.after || /^0+$/.test(p.after)) return { type: 'ignore', reason: 'branche supprimée' };
    return { type: 'production', sha: p.after };
  }
  if (event === 'pull_request') {
    const p = payload as PullRequestPayload;
    const pr = p.number;
    if (!pr) return { type: 'ignore', reason: 'numéro de PR absent' };
    if (p.action === 'closed') return { type: 'close-preview', pr };
    if (!['opened', 'reopened', 'synchronize'].includes(p.action ?? '')) return { type: 'ignore', reason: `action ${p.action}` };
    const head = p.pull_request?.head;
    if (!head?.sha || !head.ref) return { type: 'ignore', reason: 'commit de la PR absent' };
    if (head.repo?.full_name !== p.repository?.full_name) return { type: 'ignore', reason: 'PR depuis un fork refusée' };
    const author = p.pull_request?.user?.login ?? '';
    if (options.allowedAuthors.length && !options.allowedAuthors.includes(author)) {
      return { type: 'ignore', reason: `auteur non autorisé : ${author}` };
    }
    return { type: 'preview', pr, sha: head.sha, ref: head.ref, author };
  }
  return { type: 'ignore', reason: `événement ${event ?? 'inconnu'}` };
}
