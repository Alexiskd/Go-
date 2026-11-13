# SpacereaNode implementation roadmap

## Phase 0 — Repository foundation
- package/workspace structure;
- coding conventions and tests;
- manifest and module API contracts;
- CI and bundle-size reporting.

## Phase 1 — Core and static data
- lifecycle/module registry;
- capability detection;
- event bus and disposal;
- versioned manifest validation;
- static asset resolver;
- Cache Storage / IndexedDB adapter with bounded LRU.

## Phase 2 — Compute and streaming
- priority queue;
- concurrency limiter;
- AbortController cancellation;
- retry/backoff;
- worker pool and transferable buffers;
- task graph and telemetry.

## Phase 3 — Spatial and planetary
- bounds and coordinate contracts;
- CRS adapter interface;
- XYZ/TMS, quadtree and cube-sphere addressing;
- octree traversal;
- screen-space error LOD;
- body-fixed coordinate metadata and orientation adapters.

## Phase 4 — LiDAR
- LAS/LAZ header and metadata inspection;
- COPC hierarchy reader;
- tested decoder adapter (WASM/worker);
- point attribute packing;
- quantization profiles and precision validation;
- camera-driven node selection;
- point budgets and fallback rendering.

## Phase 5 — 3D renderer
- renderer abstraction;
- Three.js adapter;
- GPU buffer pools;
- frustum/horizon culling;
- tile refinement and parent fallback;
- deterministic resource eviction.

## Phase 6 — Shader library
- terrain and hillshade;
- imagery blending and draping;
- LiDAR classification/intensity;
- planetary day/night;
- shader cache and variant limits;
- shader regression scenes.

## Phase 7 — Optimization and validation
- cold/warm cache benchmarks;
- dense LiDAR and high-zoom tests;
- desktop/mobile profiles;
- memory leak and disposal tests;
- adaptive quality controller;
- static deployment and offline behavior.

## Definition of done

A subsystem is complete only when it has documented API, automated tests, real sample data, correctness validation, measured performance on named devices/browsers, licensing review and a migration example. Roadmap entries are not advertised as implemented until those conditions are met.
