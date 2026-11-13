import test from "node:test";
import assert from "node:assert/strict";
import { inspectPointCloud, quantizePointCloud } from "../src/point-cloud.js";

test("点 computes point count and bounds", () => {
  const result = inspectPointCloud([{ x: 1, y: 2, z: 3 }, { x: -1, y: 4, z: 2 }]);
  assert.equal(result.count, 2);
  assert.deepEqual(result.bounds.min, { x: -1, y: 2, z: 2 });
});

test("⇣ quantizes points and declares its maximum rounding error", () => {
  const result = quantizePointCloud([{ x: 10, y: 20, z: 30 }, { x: 10.1, y: 20.2, z: 30.3 }], { scale: 0.1 });
  assert.equal(result.count, 2);
  assert.equal(result.maxAbsoluteError, 0.05);
  assert.deepEqual(Array.from(result.values), [0, 0, 0, 1, 2, 3]);
});

test("点 rejects invalid point coordinates", () => {
  assert.throws(() => inspectPointCloud([{ x: NaN, y: 0, z: 0 }]), TypeError);
});
