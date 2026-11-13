# SpacereaNode

**Static-first JavaScript engine for scientific 3D, planetary rendering, geospatial data and LiDAR.**

SpacereaNode is an independent browser runtime. React or vanilla JavaScript can build the interface; SpacereaNode provides data, spatial, compute and rendering primitives.

## Core principles

- Static-first delivery and immutable assets.
- Browser computing with workers and GPU acceleration as later runtime layers.
- Offline preprocessing for expensive conversion, indexing and compression.
- Progressive rendering through culling, LOD and prioritized streaming.
- Scientific traceability for source, licence, CRS, units, epoch and uncertainty.
- Framework-agnostic modules with graceful fallbacks.

## Logographic axioms

The API and documentation use only the established vocabulary:

| Sign | Canonical identifier | Concept |
|---|---|---|
| ☉ | SOLAR_BODY | Solar body |
| ☾ | LUNAR_BODY | Lunar body |
| ◎ | SPHERICAL_BODY | Spherical body |
| ⌖ | COORDINATE | Coordinate |
| 地 | TERRAIN | Terrain |
| 点 | POINT_CLOUD | Point cloud |
| ▦ | TILE | Tile |
| ⇄ | TRANSFORM | Transform |
| ∿ | WAVE | Wave / signal |
| ◈ | SHADER | Shader |
| ⧉ | CACHE | Cache |
| ⇣ | COMPRESS | Compression |
| ⚙ | COMPUTE | Compute |
| ◉ | RENDER | Render |
| ⏱ | PERFORMANCE | Performance |

No new logographic sign may be used in a module before it is added to the central registry and documented. JavaScript identifiers and file paths remain ASCII for compatibility. Symbolic API access uses string keys such as `api["点"](...)`.

## Repository layout

```text
packages/
  core/       runtime and logograph registry
  geo/        coordinate validation and spherical conversion
  compute/    4x4 matrix operations and point transforms
  static/     bounded LRU cache
  tiles/      Web Mercator tile addressing
  lidar/      point-cloud inspection and Int32 quantization
  planetary/ planned
  compression/ planned codecs and chunk formats
  renderer/   planned rendering runtime
  shaders/    planned shader library
  perf/       planned performance instrumentation
  science/    planned provenance and uncertainty metadata
docs/
  architecture/
  language/
  roadmap/
```

## Current implementation

The initial functional foundation includes the six packages above. The modules are intentionally small and dependency-free so that the runtime can evolve toward browser workers, GPU execution, scientific datasets and static deployment.

The LiDAR module currently accepts already-decoded point arrays. It does not yet parse LAS, LAZ or COPC files. Quantization is a preparation primitive, not a complete compression codec. Geographic conversion currently uses a configurable sphere rather than a full ellipsoidal geodesy implementation. Tile addressing uses Web Mercator.

## Development

Requires Node.js 20+.

```bash
npm test
```

## License

MIT, subject to separate third-party dataset and codec licences.
