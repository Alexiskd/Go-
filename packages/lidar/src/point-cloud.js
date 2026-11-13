const finitePoint = point => point && [point.x, point.y, point.z].every(Number.isFinite);

export function inspectPointCloud(points) {
  if (!Array.isArray(points)) throw new TypeError("Point cloud must be an array");
  if (points.length === 0) return Object.freeze({ count: 0, bounds: null });
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  for (const point of points) {
    if (!finitePoint(point)) throw new TypeError("Every point must contain finite x, y and z");
    for (const axis of ["x", "y", "z"]) {
      bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
    }
  }
  return Object.freeze({
    count: points.length,
    bounds: Object.freeze({ min: Object.freeze(bounds.min), max: Object.freeze(bounds.max) })
  });
}

export function quantizePointCloud(points, { scale = 0.01, origin } = {}) {
  if (!Array.isArray(points)) throw new TypeError("Point cloud must be an array");
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Scale must be positive");
  const bounds = inspectPointCloud(points).bounds;
  const base = origin ?? (bounds ? { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z } : { x: 0, y: 0, z: 0 });
  if (!finitePoint(base)) throw new TypeError("Origin must contain finite x, y and z");
  const values = new Int32Array(points.length * 3);
  points.forEach((point, index) => {
    for (const [offset, axis] of ["x", "y", "z"].entries()) {
      const value = Math.round((point[axis] - base[axis]) / scale);
      if (value < -2147483648 || value > 2147483647) throw new RangeError("Quantized coordinate exceeds Int32 range");
      values[index * 3 + offset] = value;
    }
  });
  return Object.freeze({ values, scale, origin: Object.freeze({ ...base }), count: points.length, maxAbsoluteError: scale / 2 });
}
