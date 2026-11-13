import { createLogographicAPI } from "../../core/src/logographs.js";
import { StaticCache } from "./cache.js";
export { StaticCache } from "./cache.js";
export const staticAPI = createLogographicAPI({ CACHE: options => new StaticCache(options) });
