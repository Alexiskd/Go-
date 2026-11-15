import type { Result } from '@go-/types';

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Renvoie la valeur ou lève l'erreur portée par le résultat. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error ? result.error : new Error(String(result.error));
}

/** Exécute une fonction et capture son exception dans un Result. */
export async function attempt<T>(fn: () => T | Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}
