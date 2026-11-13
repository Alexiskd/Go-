import { createLogographicAPI } from "../../core/src/logographs.js";
import * as coordinates from "./coordinates.js";
export { validateCoordinate, normalizeLongitude, coordinateToCartesian, cartesianToCoordinate } from "./coordinates.js";
export const geo = createLogographicAPI({
  COORDINATE: coordinates.validateCoordinate,
  SPHERICAL_BODY: coordinates.cartesianToCoordinate,
  TRANSFORM: coordinates.coordinateToCartesian
});
