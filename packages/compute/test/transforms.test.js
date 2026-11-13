import test from "node:test";
import assert from "node:assert/strict";
import { identityMatrix, transformPoint, multiplyMatrices } from "../src/transforms.js";

test("⇄ identity leaves a point unchanged", () => {
  assert.deepEqual(transformPoint(identityMatrix(), { x: 2, y: 3, z: 4 }), { x: 2, y: 3, z: 4 });
});

test("⚙ matrix multiplication preserves identity", () => {
  assert.deepEqual(multiplyMatrices(identityMatrix(), identityMatrix()), identityMatrix());
});

test("⇄ rejects malformed matrices", () => {
  assert.throws(() => transformPoint([1, 2], { x: 0, y: 0, z: 0 }), TypeError);
});
