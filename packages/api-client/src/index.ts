/**
 * @go-/api-client — client typé, sans dépendance, fonctionnant dans le navigateur
 * (React, Next.js, Angular) comme dans Node.js. Les types et la validation viennent
 * du contrat : aucune structure de données n'est réécrite côté frontend.
 */
import { ApiErrorSchema, buildPath, type ContractSpec, type EndpointInput, type EndpointOutput, type EndpointSpec } from '@go-/contracts';
import type { Awaitable, ErrorPayload } from '@go-/types';

export class ApiClientError extends Error {
  override readonly name = 'ApiClientError';
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;
  constructor(payload: ErrorPayload | { code: string; message: string; status: number; details?: unknown; requestId?: string }) {
    super(payload.message);
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
    this.requestId = payload.requestId;
  }
}

export interface ApiClientOptions {
  /** URL de l'API, ex. `https://api.exemple.fr` (le basePath du contrat est ajouté). */
  baseUrl: string;
  fetch?: typeof fetch;
  /** Jeton d'accès à envoyer en `Authorization: Bearer`. */
  getToken?: () => Awaitable<string | undefined | null>;
  headers?: Record<string, string>;
  /** Valide les réponses avec le contrat (défaut true). */
  validateResponses?: boolean;
  /** Mode credentials de fetch (ex. 'include' pour des cookies de session). */
  credentials?: 'omit' | 'same-origin' | 'include';
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

type HasInput<E extends EndpointSpec> = keyof EndpointInput<E> extends never ? false : true;
type EndpointCall<E extends EndpointSpec> = HasInput<E> extends true
  ? (input: EndpointInput<E>, options?: CallOptions) => Promise<EndpointOutput<E>>
  : (input?: Record<string, never>, options?: CallOptions) => Promise<EndpointOutput<E>>;

export type ApiClient<C extends ContractSpec> = { readonly [K in keyof C['endpoints']]: EndpointCall<C['endpoints'][K]> };

function toQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function createApiClient<C extends ContractSpec>(contract: C, options: ApiClientOptions): ApiClient<C> {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = options.baseUrl.replace(/\/$/, '') + contract.basePath;
  const validate = options.validateResponses ?? true;

  const client: Record<string, unknown> = {};
  for (const [name, endpoint] of Object.entries(contract.endpoints)) {
    client[name] = async (input: { params?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown } = {}, call: CallOptions = {}) => {
      const url = base + buildPath(endpoint.path, input.params) + toQuery(input.query);
      const headers: Record<string, string> = { Accept: 'application/json', ...options.headers, ...call.headers };
      if (endpoint.body !== undefined) headers['Content-Type'] = 'application/json';
      const token = endpoint.auth || options.getToken ? await options.getToken?.() : undefined;
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await doFetch(url, {
        method: endpoint.method,
        headers,
        ...(endpoint.body !== undefined && { body: JSON.stringify(input.body) }),
        ...(call.signal && { signal: call.signal }),
        ...(options.credentials && { credentials: options.credentials }),
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        throw new ApiClientError({ code: 'BAD_RESPONSE', message: `Réponse non JSON (${res.status})`, status: res.status });
      }
      if (!res.ok) {
        const parsed = ApiErrorSchema.safeParse(data);
        throw new ApiClientError(parsed.ok ? parsed.value : { code: 'HTTP_ERROR', message: `Erreur HTTP ${res.status}`, status: res.status });
      }
      if (!validate) return data;
      const parsed = endpoint.response.safeParse(data);
      if (!parsed.ok) {
        throw new ApiClientError({ code: 'CONTRACT_MISMATCH', message: `Réponse de « ${name} » non conforme au contrat`, status: res.status, details: parsed.error.issues });
      }
      return parsed.value;
    };
  }
  return client as ApiClient<C>;
}
