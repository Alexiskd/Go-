export class StaticCache {
  #entries = new Map();
  #maxEntries;

  constructor({ maxEntries = 256 } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError("maxEntries must be a positive integer");
    this.#maxEntries = maxEntries;
  }

  get size() { return this.#entries.size; }

  has(key) { return this.#entries.has(key); }

  get(key) {
    if (!this.#entries.has(key)) return undefined;
    const value = this.#entries.get(key);
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key, value) {
    if (key === undefined || key === null) throw new TypeError("Cache key is required");
    this.#entries.delete(key);
    this.#entries.set(key, value);
    while (this.#entries.size > this.#maxEntries) this.#entries.delete(this.#entries.keys().next().value);
    return this;
  }

  delete(key) { return this.#entries.delete(key); }
  clear() { this.#entries.clear(); }
}
