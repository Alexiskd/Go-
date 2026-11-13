import test from "node:test";
import assert from "node:assert/strict";
import { tileFromCoordinate, tileBounds } from "../src/tile-grid.js";

test("▦ assigns a coordinate to a tile", () => {
  assert.deepEqual(tileFromCoordinate({ latitude: 0, longitude: 0 }, 1), { x: 1, y: 1, z: 1 });
});

test("▦ returns tile bounds containing the source coordinate", () => {
  const tile = tileFromCoordinate({ latitude: 48.85, longitude: 2.35 }, 10);
  const bounds = tileBounds(tile);
  assert.ok(48.85 >= bounds.south && 48.85 <= bounds.north);
  assert.ok(2.35 >= bounds.west && 2.35 <= bounds.east);
});
