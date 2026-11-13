import { createLogographicAPI } from "../../core/src/logographs.js";
import { transformPoint, multiplyMatrices, identityMatrix } from "./transforms.js";
export { transformPoint, multiplyMatrices, identityMatrix } from "./transforms.js";
export const compute = createLogographicAPI({
  TRANSFORM: transformPoint,
  COMPUTE: multiplyMatrices
});
export const matrices = Object.freeze({ identity: identityMatrix });
