import React, { createContext, createElement, useContext, useMemo } from "react";
import { createRuntime } from "../../core/src/runtime.js";
import { createLogographicAPI, LOGOGRAPHS } from "../../core/src/logographs.js";

const RuntimeContext = createContext(null);

/**
 * Provides one SpacereaNode runtime to a React subtree.
 * Pass an existing runtime to share it with non-React code.
 */
export function SpacereaProvider({ children, runtime: suppliedRuntime, options }) {
  const runtime = useMemo(
    () => suppliedRuntime ?? createRuntime(options),
    [suppliedRuntime]
  );

  return createElement(RuntimeContext.Provider, { value: runtime }, children);
}

/** Returns the current runtime or throws when used outside SpacereaProvider. */
export function useSpacerea() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("useSpacerea must be used inside SpacereaProvider");
  }
  return runtime;
}

/** Returns a registered module by its stable ASCII package/module name. */
export function useSpacereaModule(name) {
  const runtime = useSpacerea();
  return runtime.get(name);
}

/**
 * Builds a frozen symbolic facade from handlers whose keys are canonical
 * registry identifiers. Unknown identifiers are ignored by the core factory.
 */
export function useLogographicAPI(handlers) {
  useSpacerea();
  return useMemo(() => createLogographicAPI(handlers), [handlers]);
}

/** Exposes the immutable central vocabulary to UI and tooling. */
export function useLogographs() {
  useSpacerea();
  return LOGOGRAPHS;
}
