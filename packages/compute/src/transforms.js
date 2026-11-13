const validMatrix = matrix => Array.isArray(matrix) && matrix.length === 16 && matrix.every(Number.isFinite);

export function identityMatrix() {
  return Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function transformPoint(matrix, point) {
  if (!validMatrix(matrix)) throw new TypeError("Matrix must contain 16 finite values");
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) throw new TypeError("Point must contain finite x, y and z");
  const [x, y, z] = [point.x, point.y, point.z];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (w === 0) throw new RangeError("Transformation produced a zero homogeneous coordinate");
  return Object.freeze({
    x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
  });
}

export function multiplyMatrices(a, b) {
  if (!validMatrix(a) || !validMatrix(b)) throw new TypeError("Both matrices must contain 16 finite values");
  const result = new Array(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return Object.freeze(result);
}
