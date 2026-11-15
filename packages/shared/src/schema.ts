/**
 * Validation de schémas GO- : une seule définition sert à
 *  - valider à l'exécution (requêtes, réponses, configuration),
 *  - inférer le type TypeScript (`Infer<typeof schema>`),
 *  - produire le JSON Schema utilisé par OpenAPI.
 * Les clés inconnues des objets sont supprimées (jamais transmises).
 */
import type { Result, Simplify } from '@go-/types';

export type Path = ReadonlyArray<string | number>;

export interface Issue {
  readonly path: Path;
  readonly code: string;
  readonly message: string;
}

export type JsonSchema = { [key: string]: unknown };

export class SchemaError extends Error {
  override readonly name = 'SchemaError';
  constructor(readonly issues: readonly Issue[]) {
    super(issues.map((i) => `${i.path.length ? i.path.join('.') : '(racine)'} : ${i.message}`).join('\n'));
  }
}

const INVALID: unique symbol = Symbol('invalid');
type Invalid = typeof INVALID;

interface Ctx {
  issues: Issue[];
}

export type SchemaKind =
  | 'string' | 'number' | 'boolean' | 'literal' | 'enum' | 'array' | 'object' | 'union' | 'unknown';

export abstract class Schema<T> {
  /** Porteur de type uniquement (jamais défini à l'exécution). */
  declare readonly _output: T;
  abstract readonly kind: SchemaKind;
  protected meta: { description?: string; title?: string } = {};

  /** @internal */
  abstract _run(value: unknown, path: Path, ctx: Ctx): T | Invalid;
  protected abstract jsonSchema(): JsonSchema;

  toJSONSchema(): JsonSchema {
    return { ...this.jsonSchema(), ...(this.meta.title && { title: this.meta.title }), ...(this.meta.description && { description: this.meta.description }) };
  }

  safeParse(value: unknown): Result<T, SchemaError> {
    const ctx: Ctx = { issues: [] };
    const out = this._run(value, [], ctx);
    if (out === INVALID || ctx.issues.length) return { ok: false, error: new SchemaError(ctx.issues) };
    return { ok: true, value: out };
  }

  parse(value: unknown): T {
    const r = this.safeParse(value);
    if (!r.ok) throw r.error;
    return r.value;
  }

  is(value: unknown): value is T {
    return this.safeParse(value).ok;
  }

  describe(description: string): this {
    const copy = this.clone();
    copy.meta = { ...this.meta, description };
    return copy;
  }

  title(title: string): this {
    const copy = this.clone();
    copy.meta = { ...this.meta, title };
    return copy;
  }

  optional(): OptionalSchema<T> {
    return new OptionalSchema(this);
  }

  nullable(): NullableSchema<T> {
    return new NullableSchema(this);
  }

  default(value: Exclude<T, undefined>): DefaultSchema<Exclude<T, undefined>> {
    return new DefaultSchema(this as unknown as Schema<Exclude<T, undefined>>, value);
  }

  protected clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
}

export type Infer<S extends Schema<unknown>> = S['_output'];

type Check<T> = { code: string; message: string; test: (v: T) => boolean; json?: JsonSchema };

abstract class CheckedSchema<T> extends Schema<T> {
  protected checks: Check<T>[] = [];
  protected withCheck(check: Check<T>): this {
    const copy = this.clone();
    copy.checks = [...this.checks, check];
    return copy;
  }
  protected runChecks(value: T, path: Path, ctx: Ctx): T | Invalid {
    let valid = true;
    for (const c of this.checks) {
      if (!c.test(value)) {
        ctx.issues.push({ path, code: c.code, message: c.message });
        valid = false;
      }
    }
    return valid ? value : INVALID;
  }
  protected checksJson(): JsonSchema {
    return Object.assign({}, ...this.checks.map((c) => c.json ?? {}));
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class StringSchema extends CheckedSchema<string> {
  readonly kind = 'string';
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (typeof value !== 'string') {
      ctx.issues.push({ path, code: 'invalid_type', message: 'chaîne attendue' });
      return INVALID;
    }
    return this.runChecks(value, path, ctx);
  }
  protected jsonSchema() {
    return { type: 'string', ...this.checksJson() };
  }
  min(n: number, message = `au moins ${n} caractère(s)`) {
    return this.withCheck({ code: 'too_short', message, test: (v) => v.length >= n, json: { minLength: n } });
  }
  max(n: number, message = `au plus ${n} caractère(s)`) {
    return this.withCheck({ code: 'too_long', message, test: (v) => v.length <= n, json: { maxLength: n } });
  }
  nonEmpty() {
    return this.min(1, 'ne doit pas être vide');
  }
  pattern(re: RegExp, message = `doit respecter le motif ${re.source}`) {
    return this.withCheck({ code: 'invalid_format', message, test: (v) => re.test(v), json: { pattern: re.source } });
  }
  email() {
    return this.withCheck({ code: 'invalid_email', message: 'adresse e-mail invalide', test: (v) => EMAIL.test(v), json: { format: 'email' } });
  }
  uuid() {
    return this.withCheck({ code: 'invalid_uuid', message: 'UUID invalide', test: (v) => UUID.test(v), json: { format: 'uuid' } });
  }
  datetime() {
    return this.withCheck({
      code: 'invalid_datetime',
      message: 'date ISO 8601 invalide',
      test: (v) => ISO_DATETIME.test(v) && !Number.isNaN(Date.parse(v)),
      json: { format: 'date-time' },
    });
  }
  url() {
    return this.withCheck({ code: 'invalid_url', message: 'URL invalide', test: (v) => URL.canParse(v), json: { format: 'uri' } });
  }
}

export class NumberSchema extends CheckedSchema<number> {
  readonly kind = 'number';
  private integer = false;
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      ctx.issues.push({ path, code: 'invalid_type', message: 'nombre attendu' });
      return INVALID;
    }
    return this.runChecks(value, path, ctx);
  }
  protected jsonSchema() {
    return { type: this.integer ? 'integer' : 'number', ...this.checksJson() };
  }
  int() {
    const copy = this.withCheck({ code: 'not_integer', message: 'entier attendu', test: Number.isInteger });
    copy.integer = true;
    return copy;
  }
  min(n: number) {
    return this.withCheck({ code: 'too_small', message: `doit être ≥ ${n}`, test: (v) => v >= n, json: { minimum: n } });
  }
  max(n: number) {
    return this.withCheck({ code: 'too_big', message: `doit être ≤ ${n}`, test: (v) => v <= n, json: { maximum: n } });
  }
  positive() {
    return this.withCheck({ code: 'not_positive', message: 'doit être > 0', test: (v) => v > 0, json: { exclusiveMinimum: 0 } });
  }
}

export class BooleanSchema extends Schema<boolean> {
  readonly kind = 'boolean';
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (typeof value !== 'boolean') {
      ctx.issues.push({ path, code: 'invalid_type', message: 'booléen attendu' });
      return INVALID;
    }
    return value;
  }
  protected jsonSchema() {
    return { type: 'boolean' };
  }
}

export class UnknownSchema extends Schema<unknown> {
  readonly kind = 'unknown';
  _run(value: unknown) {
    return value;
  }
  protected jsonSchema() {
    return {};
  }
}

type Primitive = string | number | boolean | null;

export class LiteralSchema<T extends Primitive> extends Schema<T> {
  readonly kind = 'literal';
  constructor(readonly value: T) {
    super();
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (value !== this.value) {
      ctx.issues.push({ path, code: 'invalid_literal', message: `valeur attendue : ${JSON.stringify(this.value)}` });
      return INVALID;
    }
    return this.value;
  }
  protected jsonSchema() {
    return { const: this.value };
  }
}

export class EnumSchema<T extends string> extends Schema<T> {
  readonly kind = 'enum';
  constructor(readonly values: readonly T[]) {
    super();
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (typeof value !== 'string' || !(this.values as readonly string[]).includes(value)) {
      ctx.issues.push({ path, code: 'invalid_enum', message: `valeurs possibles : ${this.values.join(', ')}` });
      return INVALID;
    }
    return value as T;
  }
  protected jsonSchema() {
    return { type: 'string', enum: [...this.values] };
  }
}

export class ArraySchema<T> extends CheckedSchema<T[]> {
  readonly kind = 'array';
  constructor(readonly item: Schema<T>) {
    super();
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (!Array.isArray(value)) {
      ctx.issues.push({ path, code: 'invalid_type', message: 'tableau attendu' });
      return INVALID;
    }
    const out: T[] = [];
    let valid = true;
    value.forEach((v, i) => {
      const r = this.item._run(v, [...path, i], ctx);
      if (r === INVALID) valid = false;
      else out.push(r);
    });
    return valid ? this.runChecks(out, path, ctx) : INVALID;
  }
  protected jsonSchema() {
    return { type: 'array', items: this.item.toJSONSchema(), ...this.checksJson() };
  }
  min(n: number) {
    return this.withCheck({ code: 'too_short', message: `au moins ${n} élément(s)`, test: (v) => v.length >= n, json: { minItems: n } });
  }
  max(n: number) {
    return this.withCheck({ code: 'too_long', message: `au plus ${n} élément(s)`, test: (v) => v.length <= n, json: { maxItems: n } });
  }
}

export class OptionalSchema<T> extends Schema<T | undefined> {
  readonly kind: SchemaKind;
  constructor(readonly inner: Schema<T>) {
    super();
    this.kind = inner.kind;
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    return value === undefined ? undefined : this.inner._run(value, path, ctx);
  }
  protected jsonSchema() {
    return this.inner.toJSONSchema();
  }
}

export class NullableSchema<T> extends Schema<T | null> {
  readonly kind: SchemaKind;
  constructor(readonly inner: Schema<T>) {
    super();
    this.kind = inner.kind;
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    return value === null ? null : this.inner._run(value, path, ctx);
  }
  protected jsonSchema() {
    const inner = this.inner.toJSONSchema();
    return typeof inner.type === 'string' ? { ...inner, type: [inner.type, 'null'] } : { anyOf: [inner, { type: 'null' }] };
  }
}

export class DefaultSchema<T> extends Schema<T> {
  readonly kind: SchemaKind;
  constructor(readonly inner: Schema<T>, readonly defaultValue: T) {
    super();
    this.kind = inner.kind;
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    return this.inner._run(value === undefined ? structuredClone(this.defaultValue) : value, path, ctx);
  }
  protected jsonSchema() {
    return { ...this.inner.toJSONSchema(), default: this.defaultValue };
  }
}

export type Shape = { [key: string]: Schema<any> };
type OptionalKeys<S extends Shape> = { [K in keyof S]: undefined extends Infer<S[K]> ? K : never }[keyof S];
type RequiredKeys<S extends Shape> = Exclude<keyof S, OptionalKeys<S>>;
export type InferShape<S extends Shape> = Simplify<
  { [K in RequiredKeys<S>]: Infer<S[K]> } & { [K in OptionalKeys<S>]?: Infer<S[K]> }
>;

export class ObjectSchema<S extends Shape> extends Schema<InferShape<S>> {
  readonly kind = 'object';
  constructor(readonly shape: S) {
    super();
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      ctx.issues.push({ path, code: 'invalid_type', message: 'objet attendu' });
      return INVALID;
    }
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let valid = true;
    for (const [key, schema] of Object.entries(this.shape)) {
      const r = schema._run(input[key], [...path, key], ctx);
      if (r === INVALID) valid = false;
      else if (r !== undefined) out[key] = r;
    }
    return valid ? (out as InferShape<S>) : INVALID;
  }
  protected jsonSchema() {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, schema] of Object.entries(this.shape)) {
      properties[key] = schema.toJSONSchema();
      if (!(schema instanceof OptionalSchema) && !(schema instanceof DefaultSchema)) required.push(key);
    }
    return { type: 'object', properties, ...(required.length && { required }), additionalProperties: false };
  }
  extend<E extends Shape>(extra: E): ObjectSchema<Simplify<Omit<S, keyof E> & E>> {
    return new ObjectSchema({ ...this.shape, ...extra } as Simplify<Omit<S, keyof E> & E>);
  }
  pick<K extends keyof S & string>(...keys: K[]): ObjectSchema<Pick<S, K>> {
    const shape = {} as Pick<S, K>;
    for (const k of keys) shape[k] = this.shape[k];
    return new ObjectSchema(shape);
  }
  omit<K extends keyof S & string>(...keys: K[]): ObjectSchema<Omit<S, K>> {
    const shape = { ...this.shape };
    for (const k of keys) delete shape[k];
    return new ObjectSchema(shape as Omit<S, K>);
  }
  partial(): ObjectSchema<{ [K in keyof S]: OptionalSchema<Infer<S[K]>> }> {
    const shape: Record<string, Schema<unknown>> = {};
    for (const [k, v] of Object.entries(this.shape)) shape[k] = v instanceof OptionalSchema ? v : v.optional();
    return new ObjectSchema(shape as { [K in keyof S]: OptionalSchema<Infer<S[K]>> });
  }
}

export class UnionSchema<T extends readonly Schema<any>[]> extends Schema<Infer<T[number]>> {
  readonly kind = 'union';
  constructor(readonly options: T) {
    super();
  }
  _run(value: unknown, path: Path, ctx: Ctx) {
    for (const option of this.options) {
      const sub: Ctx = { issues: [] };
      const r = option._run(value, path, sub);
      if (r !== INVALID && !sub.issues.length) return r;
    }
    ctx.issues.push({ path, code: 'invalid_union', message: 'ne correspond à aucune variante autorisée' });
    return INVALID;
  }
  protected jsonSchema() {
    return { anyOf: this.options.map((o) => o.toJSONSchema()) };
  }
}

/** Fabrique de schémas : `s.object({ email: s.string().email() })`. */
export const s = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  unknown: () => new UnknownSchema(),
  literal: <T extends Primitive>(value: T) => new LiteralSchema(value),
  enum: <const T extends string>(values: readonly T[]) => new EnumSchema<T>(values),
  array: <T>(item: Schema<T>) => new ArraySchema(item),
  object: <S extends Shape>(shape: S) => new ObjectSchema(shape),
  union: <const T extends readonly Schema<any>[]>(...options: T) => new UnionSchema(options),
};

/** Retire les enveloppes optional / nullable / default pour obtenir le schéma porteur du type. */
export function innerSchema(schema: Schema<unknown>): Schema<unknown> {
  return schema instanceof OptionalSchema || schema instanceof NullableSchema || schema instanceof DefaultSchema
    ? innerSchema(schema.inner as Schema<unknown>)
    : schema;
}

/**
 * Convertit une valeur texte (variable d'environnement, paramètre d'URL) selon le type attendu.
 * Une valeur non convertible est renvoyée telle quelle : la validation produira l'erreur.
 */
export function coerceFromString(raw: string, schema: Schema<unknown>): unknown {
  const inner = innerSchema(schema);
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
