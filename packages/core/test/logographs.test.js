import test from "node:test";
import assert from "node:assert/strict";
import { LOGOGRAPHS, resolveLogograph, createLogographicAPI } from "../src/logographs.js";

test("logographs resolve by symbol, canonical id and multilingual alias", () => {
  assert.equal(resolveLogograph("点").id, "POINT_CLOUD");
  assert.equal(resolveLogograph("nuage de points").id, "POINT_CLOUD");
  assert.equal(resolveLogograph("SHADER").id, "SHADER");
  assert.equal(resolveLogograph("unknown"), undefined);
});

test("symbol API dispatches handlers with bracket notation", () => {
  const api = createLogographicAPI({
    POINT_CLOUD: value => value + 1,
    SHADER: () => "compiled"
  });
  assert.equal(api["点"](4), 5);
  assert.equal(api["◈"](), "compiled");
  assert.equal(Object.isFrozen(api), true);
  assert.ok(Object.keys(LOGOGRAPHS).length > 0);
});
