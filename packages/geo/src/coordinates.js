const finite = value => typeof value === "number" && Number.isFinite(value);

export function validateCoordinate(value) {
  if (!value || typeof value !== "object") throw new TypeError("Coordinate must be an object");
  const { latitude, longitude, altitude = 0 } = value;
  if (![latitude, longitude, altitude].every(finite)) throw new TypeError("Coordinate values must be finite numbers");
  if (latitude < -90 || latitude > 90) throw new RangeError("Latitude must be between -90 and 90 degrees");
  if (longitude < -180 || longitude > 180) throw new RangeError("Longitude must be between -180 and 180 degrees");
  return Object.freeze({ latitude, longitude, altitude });
}

export function normalizeLongitude(longitude) {
  if (!finite(longitude)) throw new TypeError("Longitude must be finite");
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

export function coordinateToCartesian(coordinate, radius = 6371008.8) {
  const point = validateCoordinate(coordinate);
  if (!finite(radius) || radius <= 0) throw new RangeError("Radius must be positive");
  const lat = point.latitude * Math.PI / 180;
  const lon = point.longitude * Math.PI / 180;
  const r = radius + point.altitude;
  return Object.freeze({
    x: r * Math.cos(lat) * Math.cos(lon),
    y: r * Math.cos(lat) * Math.sin(lon),
    z: r * Math.sin(lat)
  });
}

export function cartesianToCoordinate(vector, radius = 6371008.8) {
  if (!vector || ![vector.x, vector.y, vector.z].every(finite)) throw new TypeError("Cartesian vector must contain finite x, y and z");
  if (!finite(radius) || radius <= 0) throw new RangeError("Radius must be positive");
  const distance = Math.hypot(vector.x, vector.y, vector.z);
  if (distance === 0) throw new RangeError("Zero vector has no spherical coordinate");
  return Object.freeze({
    latitude: Math.asin(vector.z / distance) * 180 / Math.PI,
    longitude: Math.atan2(vector.y, vector.x) * 180 / Math.PI,
    altitude: distance - radius
  });
}

export function createGeoAPI() {
  return Object.freeze({
    "⌖": validateCoordinate,
    "地": coordinateToCartesian,
    "◎": cartesianToCoordinate
  });
}
