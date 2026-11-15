/**
 * Génère des types TypeScript à partir d'un document OpenAPI 3.x :
 * un type par schéma de `components.schemas` et une interface `Operations`
 * décrivant params / query / body / response de chaque opération.
 */
type JsonSchema = { [key: string]: any };

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const key = (k: string) => (IDENT.test(k) ? k : JSON.stringify(k));
const refName = (ref: string) => ref.split('/').pop()!.replace(/[^A-Za-z0-9_$]/g, '_');

export function schemaToTs(schema: JsonSchema | undefined, indent = ''): string {
  if (!schema || Object.keys(schema).length === 0) return 'unknown';
  if (schema.$ref) return refName(schema.$ref);
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v: unknown) => JSON.stringify(v)).join(' | ');
  if (schema.anyOf || schema.oneOf) return (schema.anyOf ?? schema.oneOf).map((s: JsonSchema) => schemaToTs(s, indent)).join(' | ');
  if (schema.allOf) return schema.allOf.map((s: JsonSchema) => schemaToTs(s, indent)).join(' & ');
  if (Array.isArray(schema.type)) return schema.type.map((t: string) => schemaToTs({ ...schema, type: t }, indent)).join(' | ');
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const item = schemaToTs(schema.items, indent);
      return /[|&]/.test(item) ? `Array<${item}>` : `${item}[]`;
    }
    case 'object':
    case undefined: {
      const props = schema.properties as Record<string, JsonSchema> | undefined;
      if (!props) return schema.additionalProperties ? `Record<string, ${schemaToTs(schema.additionalProperties === true ? {} : schema.additionalProperties, indent)}>` : 'Record<string, unknown>';
      const required = new Set<string>(schema.required ?? []);
      const inner = indent + '  ';
      const lines = Object.entries(props).map(([k, v]) => {
        const doc = v.description ? `${inner}/** ${String(v.description).replace(/\*\//g, '*\\/')} */\n` : '';
        return `${doc}${inner}${key(k)}${required.has(k) ? '' : '?'}: ${schemaToTs(v, inner)};`;
      });
      return `{\n${lines.join('\n')}\n${indent}}`;
    }
    default:
      return 'unknown';
  }
}

export function openApiToTs(doc: JsonSchema): string {
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) throw new Error('Document OpenAPI 3.x attendu');
  const out: string[] = [
    '/* Fichier généré par `go- generate types` — ne pas modifier à la main. */',
    `/* Source : ${doc.info?.title ?? 'API'} ${doc.info?.version ?? ''} */`,
    '',
  ];
  for (const [name, schema] of Object.entries((doc.components?.schemas ?? {}) as Record<string, JsonSchema>)) {
    out.push(`export type ${refName(name)} = ${schemaToTs(schema)};`, '');
  }
  const ops: string[] = [];
  for (const [path, methods] of Object.entries((doc.paths ?? {}) as Record<string, Record<string, JsonSchema>>)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object' || !op.operationId) continue;
      const fields: string[] = [`    method: ${JSON.stringify(method.toUpperCase())};`, `    path: ${JSON.stringify(path)};`];
      for (const location of ['path', 'query'] as const) {
        const params = ((op.parameters ?? []) as JsonSchema[]).filter((p) => p.in === location);
        if (!params.length) continue;
        const lines = params.map((p) => `      ${key(p.name)}${p.required ? '' : '?'}: ${schemaToTs(p.schema, '      ')};`);
        fields.push(`    ${location === 'path' ? 'params' : 'query'}: {\n${lines.join('\n')}\n    };`);
      }
      const body = op.requestBody?.content?.['application/json']?.schema;
      if (body) fields.push(`    body: ${schemaToTs(body, '    ')};`);
      const success = Object.entries((op.responses ?? {}) as Record<string, JsonSchema>).find(([code]) => /^2\d\d$/.test(code));
      fields.push(`    response: ${schemaToTs(success?.[1]?.content?.['application/json']?.schema, '    ')};`);
      ops.push(`  ${key(op.operationId)}: {\n${fields.join('\n')}\n  };`);
    }
  }
  out.push(`export interface Operations {\n${ops.join('\n')}\n}`, '', 'export type OperationName = keyof Operations;', '');
  return out.join('\n');
}
