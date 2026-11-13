/**
 * Logographic vocabulary for SpacereaNode.
 *
 * Symbols are exposed as string keys rather than JavaScript identifiers:
 * many pictographs and historic-script characters are not valid ECMAScript
 * IdentifierName characters. Use api["☉"] or runtime.symbol("☉").
 */
export const LOGOGRAPHS = Object.freeze({
  "☉": Object.freeze({ id: "SOLAR_BODY", label: "Solar body", domain: "astronomy", aliases: ["sun", "soleil", "太陽"] }),
  "☾": Object.freeze({ id: "LUNAR_BODY", label: "Lunar body", domain: "astronomy", aliases: ["moon", "lune", "月"] }),
  "◎": Object.freeze({ id: "SPHERICAL_BODY", label: "Spherical body", domain: "geometry", aliases: ["sphere", "sphère", "球"] }),
  "⌖": Object.freeze({ id: "COORDINATE", label: "Coordinate", domain: "geo", aliases: ["coordinate", "coordonnée", "坐标"] }),
  "地": Object.freeze({ id: "TERRAIN", label: "Terrain", domain: "geo", aliases: ["terrain", "地形"] }),
  "点": Object.freeze({ id: "POINT_CLOUD", label: "Point cloud", domain: "lidar", aliases: ["point-cloud", "nuage de points", "點雲"] }),
  "▦": Object.freeze({ id: "TILE", label: "Tile", domain: "streaming", aliases: ["tile", "tuile", "瓦片"] }),
  "⇄": Object.freeze({ id: "TRANSFORM", label: "Transform", domain: "compute", aliases: ["transform", "transformation", "变换"] }),
  "∿": Object.freeze({ id: "WAVE", label: "Wave / signal", domain: "science", aliases: ["wave", "onde", "波"] }),
  "◈": Object.freeze({ id: "SHADER", label: "Shader", domain: "rendering", aliases: ["shader", "着色器"] }),
  "⧉": Object.freeze({ id: "CACHE", label: "Cache", domain: "static", aliases: ["cache", "缓存"] }),
  "⇣": Object.freeze({ id: "COMPRESS", label: "Compress", domain: "compression", aliases: ["compress", "compression", "压缩"] }),
  "⚙": Object.freeze({ id: "COMPUTE", label: "Compute", domain: "compute", aliases: ["compute", "calcul", "计算"] }),
  "◉": Object.freeze({ id: "RENDER", label: "Render", domain: "rendering", aliases: ["render", "rendu", "渲染"] }),
  "⏱": Object.freeze({ id: "PERFORMANCE", label: "Performance", domain: "performance", aliases: ["performance", "性能"] })
});

const aliasIndex = new Map();
for (const [symbol, entry] of Object.entries(LOGOGRAPHS)) {
  aliasIndex.set(symbol, entry);
  aliasIndex.set(entry.id.toLowerCase(), entry);
  for (const alias of entry.aliases) aliasIndex.set(alias.toLowerCase(), entry);
}

export function resolveLogograph(value) {
  if (typeof value !== "string") return undefined;
  return aliasIndex.get(value) ?? aliasIndex.get(value.toLowerCase());
}

export function createLogographicAPI(handlers = {}) {
  const api = Object.create(null);
  for (const [symbol, entry] of Object.entries(LOGOGRAPHS)) {
    const handler = handlers[entry.id];
    if (typeof handler === "function") {
      Object.defineProperty(api, symbol, {
        enumerable: true,
        configurable: false,
        writable: false,
        value: handler
      });
    }
  }
  return Object.freeze(api);
}
