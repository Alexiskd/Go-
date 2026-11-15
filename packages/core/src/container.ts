/** Jeton d'injection typé : `const DB = token<Database>('db')`. */
export interface Token<T> {
  readonly id: symbol;
  readonly name: string;
  /** Porteur de type uniquement. */
  readonly __type?: T;
}

export const token = <T>(name: string): Token<T> => ({ id: Symbol(name), name });

type Factory<T> = (c: Container) => T;
type Provider<T> =
  | { kind: 'value'; value: T }
  | { kind: 'factory'; factory: Factory<T>; singleton: boolean; instance?: T; created: boolean };

/**
 * Conteneur d'injection de dépendances minimal et explicite :
 * pas de décorateurs, pas de réflexion, détection des cycles.
 */
export class Container {
  private readonly providers = new Map<symbol, Provider<unknown>>();
  private readonly resolving: Token<unknown>[] = [];

  constructor(private readonly parent?: Container) {}

  value<T>(t: Token<T>, value: T): this {
    this.assertFree(t);
    this.providers.set(t.id, { kind: 'value', value });
    return this;
  }

  factory<T>(t: Token<T>, factory: Factory<T>, options: { singleton?: boolean } = {}): this {
    this.assertFree(t);
    this.providers.set(t.id, { kind: 'factory', factory, singleton: options.singleton ?? true, created: false });
    return this;
  }

  has(t: Token<unknown>): boolean {
    return this.providers.has(t.id) || (this.parent?.has(t) ?? false);
  }

  resolve<T>(t: Token<T>): T {
    const provider = this.providers.get(t.id) as Provider<T> | undefined;
    if (!provider) {
      if (this.parent) return this.parent.resolve(t);
      throw new Error(`Aucun fournisseur enregistré pour « ${t.name} »`);
    }
    if (provider.kind === 'value') return provider.value;
    if (provider.singleton && provider.created) return provider.instance as T;
    if (this.resolving.includes(t as Token<unknown>)) {
      const cycle = [...this.resolving, t].map((x) => x.name).join(' → ');
      throw new Error(`Dépendance circulaire : ${cycle}`);
    }
    this.resolving.push(t as Token<unknown>);
    try {
      const instance = provider.factory(this);
      if (provider.singleton) {
        provider.instance = instance;
        provider.created = true;
      }
      return instance;
    } finally {
      this.resolving.pop();
    }
  }

  /** Conteneur enfant : hérite des fournisseurs, peut en ajouter (portée requête, tests). */
  createChild(): Container {
    return new Container(this);
  }

  private assertFree(t: Token<unknown>) {
    if (this.providers.has(t.id)) throw new Error(`« ${t.name} » est déjà enregistré`);
  }
}
