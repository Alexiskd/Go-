import { ConfigError } from '@go-/core';
import {
  DefaultSchema, NullableSchema, ObjectSchema, OptionalSchema, constantCase, deepFreeze, type Infer, type Schema, type Shape,
} from '@go-/shared';
import { isEnvironment, type Environment } from '@go-/types';

export interface LoadConfigOptions {
  /** Variables d'environnement à lire (défaut : process.env). */
  env?: Record<string, string | undefined>;
  /** Préfixe des variables : `{ prefix: 'APP' }` lit `APP_DATABASE_URL` pour `databaseUrl`. */
  prefix?: string;
  /** Valeurs explicites, prioritaires sur l'environnement (tests, CLI). */
  overrides?: Record<string, unknown>;
}

export interface ConfigDefinition<S extends Shape> {
  readonly schema: ObjectSchema<S>;
  /** Clés dont la valeur ne doit jamais apparaître dans les logs. */
  readonly secrets: ReadonlyArray<keyof S & string>;
  load(options?: LoadConfigOptions): Readonly<Infer<ObjectSchema<S>>>;
  /** Nom de variable d'environnement associé à chaque clé. */
  envKeys(prefix?: string): Record<keyof S & string, string>;
}

const unwrap = (schema: Schema<unknown>): Schema<unknown> =>
  schema instanceof OptionalSchema || schema instanceof NullableSchema || schema instanceof DefaultSchema
    ? unwrap(schema.inner as Schema<unknown>)
    : schema;

/** Convertit une variable texte selon le type attendu par le schéma. */
function coerce(raw: string, schema: Schema<unknown>): unknown {
  const inner = unwrap(schema);
  switch (inner.kind) {
    case 'number': {
      const n = Number(raw);
      return raw.trim() === '' || Number.isNaN(n) ? raw : n;
    }
    case 'boolean':
      if (/^(true|1|yes|on)$/i.test(raw)) return true;
      if (/^(false|0|no|off)$/i.test(raw)) return false;
      return raw;
    case 'array':
      return raw.split(',').map((x) => x.trim()).filter(Boolean);
    case 'object':
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

/**
 * Déclare la configuration d'une application. Exemple :
 * ```ts
 * const config = defineConfig({ port: s.number().int().default(3000), jwtSecret: s.string().min(32) }, { secrets: ['jwtSecret'] });
 * const values = config.load({ prefix: 'API' }); // lit API_PORT, API_JWT_SECRET
 * ```
 */
export function defineConfig<S extends Shape>(shape: S, options: { secrets?: ReadonlyArray<keyof S & string> } = {}): ConfigDefinition<S> {
  const schema = new ObjectSchema(shape);
  const envKeys = (prefix?: string) =>
    Object.fromEntries(Object.keys(shape).map((k) => [k, (prefix ? `${constantCase(prefix)}_` : '') + constantCase(k)])) as Record<keyof S & string, string>;

  return {
    schema,
    secrets: options.secrets ?? [],
    envKeys,
    load(loadOptions = {}) {
      const env = loadOptions.env ?? process.env;
      const keys = envKeys(loadOptions.prefix);
      const input: Record<string, unknown> = {};
      for (const [key, sub] of Object.entries(shape)) {
        const raw = env[keys[key as keyof S & string]];
        if (raw !== undefined) input[key] = coerce(raw, sub);
      }
      Object.assign(input, loadOptions.overrides);
      const result = schema.safeParse(input);
      if (!result.ok) {
        const lines = result.error.issues.map((i) => {
          const key = String(i.path[0] ?? '');
          return `  - ${keys[key as keyof S & string] ?? key} : ${i.message}`;
        });
        throw new ConfigError(`Configuration invalide :\n${lines.join('\n')}`, { details: { issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
      }
      return deepFreeze(result.value);
    },
  };
}

/** Copie de la configuration où les secrets sont masqués, pour l'afficher sans risque. */
export function redactConfig<T extends Record<string, unknown>>(config: T, secrets: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const key of secrets) if (out[key] !== undefined) out[key] = '[REDACTED]';
  return out;
}

/** Détermine l'environnement à partir de NODE_ENV (défaut : development). */
export function resolveEnvironment(value: string | undefined = process.env.NODE_ENV): Environment {
  if (value === undefined || value === '') return 'development';
  if (!isEnvironment(value)) throw new ConfigError(`NODE_ENV invalide : « ${value} » (attendu : development, test ou production)`);
  return value;
}
