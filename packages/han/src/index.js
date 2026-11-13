import { createLogographicAPI } from "../../core/src/logographs.js";
import { parseUnihanLine, parseCJKVIIDSLine, isIdeographicDescriptionOperator } from "./parsers.js";
export { parseUnihanLine, parseCJKVIIDSLine, isIdeographicDescriptionOperator } from "./parsers.js";
export const han = createLogographicAPI({
  POINT_CLOUD: parseCJKVIIDSLine,
  COORDINATE: parseUnihanLine
});
