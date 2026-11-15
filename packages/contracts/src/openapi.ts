import type { JsonSchema } from '@go-/shared';
import { ApiErrorSchema } from './common.js';
import type { ContractSpec } from './endpoint.js';

export interface OpenApiInfo {
  title?: string;
  version?: string;
  description?: string;
  servers?: { url: string; description?: string }[];
}

export type OpenApiDocument = { openapi: string; info: Record<string, unknown>; paths: Record<string, Record<string, unknown>>; [key: string]: unknown };

const STATUS_TEXT: Record<number, string> = { 200: 'Succès', 201: 'Créé', 400: 'Requête invalide', 401: 'Non authentifié', 403: 'Interdit', 404: 'Introuvable', 422: 'Validation échouée' };

/** Génère un document OpenAPI 3.1 à partir d'un contrat GO-. */
export function toOpenApi(contract: ContractSpec, info: OpenApiInfo = {}): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  const errorRef = { $ref: '#/components/schemas/ApiError' };
  const errorResponse = (code: number) => ({ description: STATUS_TEXT[code] ?? 'Erreur', content: { 'application/json': { schema: errorRef } } });

  for (const [operationId, e] of Object.entries(contract.endpoints)) {
    const path = (contract.basePath + e.path).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    const parameters: unknown[] = [];
    for (const [location, schema] of [['path', e.params], ['query', e.query]] as const) {
      if (!schema) continue;
      const json = schema.toJSONSchema() as { properties?: Record<string, JsonSchema>; required?: string[] };
      for (const [name, prop] of Object.entries(json.properties ?? {})) {
        parameters.push({ name, in: location, required: location === 'path' || (json.required ?? []).includes(name), schema: prop });
      }
    }
    const status = e.status ?? 200;
    const responses: Record<string, unknown> = {
      [status]: { description: STATUS_TEXT[status] ?? 'Succès', content: { 'application/json': { schema: e.response.toJSONSchema() } } },
    };
    if (e.body || e.params || e.query) responses[422] = errorResponse(422);
    if (e.auth) responses[401] = errorResponse(401);
    if (typeof e.auth === 'string') responses[403] = errorResponse(403);
    if (e.params) responses[404] = errorResponse(404);

    (paths[path] ??= {})[e.method.toLowerCase()] = {
      operationId,
      summary: e.summary,
      ...(e.tags && { tags: [...e.tags] }),
      ...(parameters.length && { parameters }),
      ...(e.body && { requestBody: { required: true, content: { 'application/json': { schema: e.body.toJSONSchema() } } } }),
      ...(e.auth && { security: [{ bearerAuth: [] }] }),
      ...(typeof e.auth === 'string' && { 'x-go-permission': e.auth }),
      responses,
    };
  }

  return {
    openapi: '3.1.0',
    info: { title: info.title ?? contract.name, version: info.version ?? contract.version, ...(info.description && { description: info.description }) },
    ...(info.servers && { servers: info.servers }),
    paths,
    components: {
      schemas: { ApiError: ApiErrorSchema.toJSONSchema() },
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  };
}
