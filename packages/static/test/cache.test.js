import test from "node:test";
import assert from "node:assert/strict";
import { StaticCache } from "../src/cache.js";

test("⧉ evicts the least recently used entry", () => {
  const cache = new StaticCache({ maxEntries: 2 });
  cache.set("a", 1).set("b", 2);
  cache.get("a");
  cache.set("c", 3);
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.get("c"), 3);
});

test("⧉ rejects an invalid capacity", () => {
  assert.throws(() => new StaticCache({ maxEntries: 0 }), RangeError);
});
