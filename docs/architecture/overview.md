# SpacereaNode architecture

## 1. Product definition

SpacereaNode is a composable JavaScript runtime for static scientific web applications. It provides the systems layer beneath an interface: asset manifests, asynchronous work scheduling, spatial indexing, LOD selection, point-cloud decoding adapters, GPU rendering and profiling.

It is intentionally distinct from React. React remains responsible for UI composition and controls. SpacereaNode owns data/render lifecycle and rendering workloads.

## 2. Static-first architecture

**Build time / offline tools**
- inspect source datasets and licences;
- validate CRS, axis order, units, epoch and vertical datum;
- convert/partition data into immutable chunks;
- build octrees, quadtrees or cube-sphere hierarchies;
- quantize and compress with declared error bounds;
- emit versioned manifests, checksums and provenance.

**Static delivery**
- publish HTML, JS, shaders, manifests and data chunks as static assets;
- use immutable content-addressed URLs for binary chunks;
- cache static data through browser cache and CDN;
- keep manifests revalidatable and versioned.

**Browser runtime**
- select visible data from camera/frustum/horizon;
- prioritize visible requests and cancel obsolete work;
- decode/decompress in workers;
- upload typed arrays and textures to GPU;
- render progressively while parent LOD remains visible;
- adapt quality to measured device performance.

A backend is optional, not forbidden. Authentication, private user data, ingestion orchestration and protected credentials must not be moved into public static assets.

## 3. LiDAR pipeline

1. Preserve original LAS/LAZ/COPC input and licence.
2. Inspect LAS version, point format, CRS, scale, offset, dimensions and compression.
3. Validate coordinate and vertical reference systems.
4. Partition spatially and construct COPC/octree hierarchy.
5. Keep point attributes (classification, intensity, returns, RGB and extra dimensions) according to an explicit profile.
6. Quantize only with documented scale, offset and maximum positional error.
7. Encode chunks using a supported interoperable codec or a versioned custom runtime format.
8. Verify round trips, bounds, point counts, checksums and positional error.
9. Publish immutable assets and source provenance.
10. Decode asynchronously in workers; render only camera-relevant nodes.

COPC/LAZ remains the preferred interoperable source format where suitable. Custom chunks are derived display assets, never the only archival copy. Compression and quantization are not synonyms: quantization is lossy unless the original values already lie on the chosen grid.

## 4. 3D and LOD

- frustum and horizon culling before data requests;
- projected screen-space error for refinement;
- point budgets and GPU memory budgets;
- parent fallback to prevent holes during child loading;
- shared buffers/materials and deterministic disposal;
- instancing and draw-call reduction;
- bounded shader variants;
- optional WebGPU adapter after WebGL2 baseline is stable.

## 5. Compute and compression

Heavy parsing, decompression, transforms and decimation should run in Web Workers or WASM workers where practical. Transferable ArrayBuffers avoid unnecessary copies. SharedArrayBuffer is optional and requires cross-origin isolation headers.

Codec adapters should expose capabilities and fallbacks. Candidate formats (for example Brotli/gzip for text, zstd when a browser/WASM implementation is bundled, and domain-specific LAZ decoding) must be benchmarked on target browsers rather than selected by assumption.

## 6. Shader system

Planned shader modules:
- imagery/elevation blending;
- terrain hillshade and normal visualization;
- LiDAR classification/intensity/height styling;
- orthophoto draping;
- point size and density control;
- planetary day/night terminator;
- depth-aware overlays and picking.

A shader that derives relief from image brightness is a visualization estimate, not measured elevation. Synthetic or interpolated detail must be identified separately from observation.

## 7. Performance model

Collect frame time p50/p95, CPU task duration, worker queue delay, network bytes, cache hit ratio, decoded point count, GPU buffer bytes and shader compile time. Adapt LOD, point budget and concurrency only after sustained pressure; avoid arbitrary FPS promises.

## 8. Scientific and language data

All textual metadata is UTF-8. Preserve Unicode code points and original source labels. If normalization is needed, record the chosen normalization form; do not silently transliterate. Historic scripts and dead-language text can be stored as Unicode when supported by the source encoding and font. Scientific units, symbols and mathematical expressions should use explicit machine-readable fields as well as display labels.

## 9. Security

Static files are public. Never place API secrets, private keys, credentials or protected user data in manifests or client bundles. Validate remote manifests, constrain asset origins, apply content security policy and verify checksums where integrity matters.
