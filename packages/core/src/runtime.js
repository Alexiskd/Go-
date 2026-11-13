export class Runtime {
  #modules = new Map();
  #events = new Map();
  #disposed = false;

  constructor(options = {}) {
    this.options = Object.freeze({
      maxConcurrentTasks: options.maxConcurrentTasks ?? 6,
      memoryBudgetBytes: options.memoryBudgetBytes ?? 512 * 1024 * 1024,
      ...options
    });
  }

  get disposed() { return this.#disposed; }

  register(name, module) {
    this.#assertActive();
    if (typeof name !== "string" || !name || this.#modules.has(name)) {
      throw new Error(`Invalid or duplicate module: ${name}`);
    }
    if (!module || typeof module !== "object") throw new TypeError("Module must be an object");
    this.#modules.set(name, module);
    module.initialize?.(this);
    this.emit("module:registered", { name });
    return () => this.unregister(name);
  }

  get(name) { return this.#modules.get(name); }

  unregister(name) {
    const module = this.#modules.get(name);
    if (!module) return false;
    this.#modules.delete(name);
    module.dispose?.();
    this.emit("module:unregistered", { name });
    return true;
  }

  on(type, callback) {
    this.#assertActive();
    const listeners = this.#events.get(type) ?? new Set();
    listeners.add(callback);
    this.#events.set(type, listeners);
    return () => listeners.delete(callback);
  }

  emit(type, payload) {
    for (const callback of this.#events.get(type) ?? []) callback(payload);
  }

  #assertActive() {
    if (this.#disposed) throw new Error("Runtime is disposed");
  }

  dispose() {
    if (this.#disposed) return;
    for (const name of [...this.#modules.keys()].reverse()) this.unregister(name);
    this.#events.clear();
    this.#disposed = true;
  }
}

export function createRuntime(options) {
  return new Runtime(options);
}
