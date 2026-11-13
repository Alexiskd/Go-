import { createLogographicAPI } from "../../core/src/logographs.js";
import { inspectPointCloud, quantizePointCloud } from "./point-cloud.js";
export { inspectPointCloud, quantizePointCloud } from "./point-cloud.js";
export const lidar = createLogographicAPI({
  POINT_CLOUD: inspectPointCloud,
  COMPRESS: quantizePointCloud
});
