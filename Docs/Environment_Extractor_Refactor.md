# Environment Extractor Refactor

## Current State

- `external_util/Environment_Extractor.html` is now the single authoritative standalone extractor.
- `external_util/Envornment_Extractor_2.html` has been retired and redirected to the canonical extractor.
- The extractor now defaults to generating a simulator-ready scenario JSON that matches the current v2.4 import shape.
- An optional legacy environment-package export is still available for debugging and asset reuse.

## Implemented Hardening

- Unified the working v1 HTML structure with the v2 terrain-vectorization/scenario-generation feature set.
- Moved button wiring and tooltip setup inside `DOMContentLoaded`.
- Added step-by-step logging around:
  - tile fetch
  - crop
  - DEM decode
  - OSM fetch
  - building merge
  - grayscale render
  - vectorization
  - final packaging
- Added contour-tracing safety guards:
  - strict bounds checks
  - 5000-step safety cutoff with warning logs
- Added graceful CORS fallback:
  - DEM pixel read failure now generates flat terrain instead of aborting
  - building pixel read failure now falls back to terrain-only heights
- Added dual download outputs:
  - scenario JSON
  - environment package JSON
- Replaced whole-map average height thresholding with local-relief thresholding:
  - mean local window baseline
  - configurable relief threshold
  - configurable local window size
  - minimum connected-region filtering to suppress noisy micro-polygons

## Main Program Alignment

- Extracted scenarios should import directly into the current simulator with:
  - `metadata`
  - `config`
  - `environment`
  - `terrainObjects`
  - `templates`
  - `instances`
- Generated environments disable runtime anomaly/clutter spawning by default so imported extractor scenarios remain stable during terrain debugging.
- Terrain extraction now favors sharp local anomalies over broad smooth hills so the exported `Block` polygons are more radar-relevant by default.

## Next Follow-On

The next main-program roadmap priority remains **Phase 1 modularization**:

- finish `src/` parity with `index.html`
- replace remaining legacy bridge mismatches
- keep single-file/offline distribution intact through Vite bundling

The next extractor-specific follow-on should be tuning and validation:

- smoke-test the local-relief extractor against flat, urban, and mixed-relief tiles
- decide whether additional contour simplification or morphological cleanup is needed after the new local-relief mask
- keep the extractor standalone even if shared math helpers later migrate into the modular app tree
