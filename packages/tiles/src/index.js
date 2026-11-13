import { createLogographicAPI } from "../../core/src/logographs.js";
import { tileFromCoordinate, tileBounds } from "./tile-grid.js";
export { tileFromCoordinate, tileBounds } from "./tile-grid.js";
export const tiles = createLogographicAPI({ TILE: tileFromCoordinate, COORDINATE: tileBounds });
