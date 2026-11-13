import { createLogographicAPI } from "../../core/src/logographs.js";
export { validateCoordinate, normalizeLongitude, coordinateToCartesian, cartesianToCoordinate, createGeoAPI } from "./coordinates.js";
import * as coordinates from "./coordinates.js";
export const geo = createLogographicAPI({
  COORDINATE: coordinates.validateCoordinate,
  TERRAIN: coordinates.coordinateToCartesian,
  SPHERICAL_BODY: coordinates.cartesianToCoordinate
});
