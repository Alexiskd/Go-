import test from "node:test";
import assert from "node:assert/strict";
import { validateCoordinate, coordinateToCartesian, cartesianToCoordinate, normalizeLongitude } from "../src/coordinates.js";

test("⌖ validates geographic coordinates", () => {
  assert.deepEqual(validateCoordinate({ latitude: 48, longitude: 2 }), { latitude: 48, longitude: 2, altitude: 0 });
  assert.throws(() => validateCoordinate({ latitude: 91, longitude: 0 }), RangeError);
});

test("⇄ converts spherical coordinates to Cartesian and back", () => {
  const source = { latitude: 48.8566, longitude: 2.3522, altitude: 35 };
  const result = cartesianToCoordinate(coordinateToCartesian(source));
  assert.ok(Math.abs(result.latitude - source.latitude) < 1e-9);
  assert.ok(Math.abs(result.longitude - source.longitude) < 1e-9);
  assert.ok(Math.abs(result.altitude - source.altitude) < 1e-6);
});

test("⌖ normalizes longitude", () => {
  assert.equal(normalizeLongitude(190), -170);
});
