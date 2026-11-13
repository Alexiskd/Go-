import test from "node:test";
import assert from "node:assert/strict";
import { createRuntime } from "../src/index.js";

test("runtime initializes and disposes registered modules", () => {
  const runtime = createRuntime();
  let initialized = false;
  let disposed = false;
  runtime.register("fixture", {
    initialize() { initialized = true; },
    dispose() { disposed = true; }
  });
  assert.equal(initialized, true);
  assert.ok(runtime.get("fixture"));
  runtime.dispose();
  assert.equal(disposed, true);
  assert.equal(runtime.disposed, true);
});
