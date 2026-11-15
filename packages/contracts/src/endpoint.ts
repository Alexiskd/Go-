import type { Infer, ObjectSchema, Schema, Shape } from '@go-/shared';
import type { Simplify } from '@go-/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** `false` : public ; `true` : authentifié ; chaîne : permission requise (ex. `users:write`). */
export type EndpointAuth = boolean | string;

export interface EndpointSpec {
  readonly method: HttpMethod;
  /** Chemin relatif au contrat, paramètres au format `:id`. */
  readonly path: string;
  readonly summary: string;
  readonly tags?: readonly string[];
  readonly auth?: EndpointAuth;
  readonly params?: ObjectSchema<Shape>;
  readonly query?: ObjectSchema<Shape>;
  readonly body?: Schema<any>;
  readonly response: Schema<any>;
  /** Statut HTTP de succès (défaut 200). */
  readonly status?: number;
  /**
   * En-tête Cache-Control de la réponse réussie, ex. `public, max-age=60, stale-while-revalidate=300`
   * pour des données publiques peu changeantes. Défaut : `no-store` (`private, no-store` si authentifié).
   */
  readonly cacheControl?: string;
}

type InputPart<K extends string, S> = S extends Schema<any> ? { [P in K]: Infer<S> } : {};

/** Entrée d'un endpoint : `{ params?, query?, body? }` selon ce qu'il déclare. */
export type EndpointInput<E extends EndpointSpec> = Simplify<
  InputPart<'params', E['params']> & InputPart<'query', E['query']> & InputPart<'body', E['body']>
>;
export type EndpointOutput<E extends EndpointSpec> = Infer<E['response']>;

export interface ContractSpec {
  readonly name: string;
  readonly version: string;
  /** Préfixe commun, ex. `/api/v1`. */
  readonly basePath: string;
  readonly endpoints: { readonly [name: string]: EndpointSpec };
}

export const defineEndpoint = <const E extends EndpointSpec>(endpoint: E): E => endpoint;

export function defineContract<const C extends ContractSpec>(contract: C): C {
  const seen = new Set<string>();
  for (const [name, e] of Object.entries(contract.endpoints)) {
    const key = `${e.method} ${e.path}`;
    if (seen.has(key)) throw new Error(`Contrat « ${contract.name} » : route dupliquée ${key} (${name})`);
    seen.add(key);
    for (const param of pathParams(e.path)) {
      if (!e.params || !(param in e.params.shape)) throw new Error(`Endpoint « ${name} » : paramètre « :${param} » non déclaré dans params`);
    }
  }
  return contract;
}

/** Noms des paramètres d'un chemin : `/users/:id` → `['id']`. */
export function pathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
}

/** Remplit les paramètres d'un chemin en les encodant. */
export function buildPath(path: string, params: Record<string, unknown> = {}): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, key: string) => {
    if (params[key] === undefined) throw new Error(`Paramètre de chemin manquant : ${key}`);
    return encodeURIComponent(String(params[key]));
  });
}
