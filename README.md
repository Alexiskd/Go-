# SpacereaNode

**Static-first JavaScript engine for scientific 3D, planetary rendering, geospatial data and LiDAR.**

SpacereaNode is an independent browser runtime. It is inspired by the composability of React, but it is not a UI framework and does not replace React. React (or vanilla JavaScript) can build the interface; SpacereaNode handles static data delivery, spatial streaming, 3D rendering, LiDAR point clouds, compression-aware datasets, shaders and performance budgets.

## Core principles

- Static-first: immutable, versioned assets served by static hosting/CDN.
- Browser computing: workers and GPU perform runtime work when supported.
- Preprocessing pipeline: expensive conversion, indexing and compression happen offline/build-time.
- Progressive rendering: camera-aware culling, LOD and prioritized streaming.
- Scientific traceability: source, licence, CRS, units, epoch and uncertainty travel with data.
- Framework-agnostic: no dependency on React, Next.js or a backend framework in the core.
- Graceful fallback: WebGL2 baseline, WebGPU optional, CPU fallback where practical.

## Planned subsystems

| Subsystem | Purpose |
|---|---|
| Core | lifecycle, modules, events, capabilities |
| Static | manifests, immutable assets, browser cache |
| Compute | worker pool, task graph, transferable buffers |
| Geo | CRS metadata, bounds, transforms |
| Tiles | quadtree, octree, cube-sphere, screen-space LOD |
| Planetary | body metadata, coordinates, imagery/elevation tiles |
| LiDAR | LAS/LAZ/COPC adapters, hierarchy traversal, point rendering |
| Compression | quantization, chunking, codec adapters, integrity |
| Renderer | Three.js adapter, camera, geometry and resource lifecycle |
| Shaders | terrain, hillshade, imagery blend, point classification |
| Performance | frame metrics, memory/network budgets, adaptive quality |
| Science | provenance, uncertainty, measured vs derived vs simulated data |

## Repository layout

```text
packages/
  core/
  static/
  compute/
  geo/
  tiles/
  planetary/
  lidar/
  compression/
  renderer/
  shaders/
  perf/
  science/
tools/
  ingest/
  validate/
docs/
  architecture/
  formats/
  roadmap/
examples/
  static-globe/
  lidar-viewer/
```

## Current status

This repository is the dedicated home of SpacereaNode. Initial commits establish the API and engineering contracts. The complete COPC/LAZ decoder, full 3D renderer, shader suite, worker pipeline and production compression codecs are staged for subsequent implementation; they are not implied to be complete by the initial scaffold.

## Naming and international text

Source files and identifiers use stable ASCII names for tooling compatibility. Documentation and metadata support Unicode, multilingual text, combining marks, symbols, scientific notation and historic/dead-language scripts when encoded in UTF-8. Dataset labels must preserve their original Unicode text; normalization is explicit and must not destroy source spelling.

## Development

Requires Node.js 20+.

```bash
npm test
```

## License

MIT (subject to third-party dataset and codec licences; those remain separate).
