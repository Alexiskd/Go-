import { validateCoordinate } from "../../geo/src/coordinates.js";

export function tileFromCoordinate(coordinate, zoom) {
  const point = validateCoordinate(coordinate);
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 30) throw new RangeError("Zoom must be an integer between 0 and 30");
  const count = 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const x = Math.min(count - 1, Math.floor((point.longitude + 180) / 360 * count));
  const radians = latitude * Math.PI / 180;
  const y = Math.max(0, Math.min(count - 1, Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count)));
  return Object.freeze({ x, y, z: zoom });
}

export function tileBounds(tile) {
  if (!tile || ![tile.x, tile.y, tile.z].every(Number.isInteger) || tile.z < 0 || tile.z > 30) throw new TypeError("Invalid tile address");
  const count = 2 ** tile.z;
  if (tile.x < 0 || tile.y < 0 || tile.x >= count || tile.y >= count) throw new RangeError("Tile address is outside its zoom level");
  const longitude = x => x / count * 360 - 180;
  const latitude = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / count))) * 180 / Math.PI;
  return Object.freeze({
    west: longitude(tile.x),
    east: longitude(tile.x + 1),
    north: latitude(tile.y),
    south: latitude(tile.y + 1)
  });
}
