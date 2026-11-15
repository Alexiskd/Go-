import type { Awaitable } from '@go-/types';

export type EventMap = { [event: string]: unknown };
export type Handler<P> = (payload: P) => Awaitable<void>;

/**
 * Bus d'événements typé. `emit` attend tous les gestionnaires (en parallèle)
 * et lève une AggregateError si l'un d'eux échoue : aucune erreur n'est avalée.
 */
export class EventBus<E extends EventMap = EventMap> {
  private readonly handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler);
    return () => this.off(event, handler);
  }

  once<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    const wrapper: Handler<E[K]> = (payload) => {
      this.off(event, wrapper);
      return handler(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof E>(event: K, handler: Handler<E[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  async emit<K extends keyof E>(event: K, payload: E[K]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set?.size) return;
    const results = await Promise.allSettled([...set].map(async (h) => h(payload)));
    const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);
    if (errors.length) throw new AggregateError(errors, `${errors.length} gestionnaire(s) en échec pour « ${String(event)} »`);
  }

  listenerCount(event: keyof E): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
