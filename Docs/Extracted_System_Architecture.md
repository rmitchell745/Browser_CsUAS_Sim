# Extracted System Architecture

This document tracks the current code split for the v2.4 refactor state. `index.html` remains the runnable shell for now; `src/` is the extracted review tree and Vite-review target.

## Working Refactor Tree

```text
src/
  util/
    math/
      physics.js
      vector3D.js
      geospatial.js
      random.js
    schema/
      normalizer.js
      validator.js
    export/
      README.md

  kernel/
    event_manager.js
    world_state.js
    world_mutators.js
    simulation_manager.js
    systems/
      movement.js
      sensor.js
      track.js
      cognitive.js
      c2.js
      network.js
      effect.js
      damage.js

  report/
    logger.js
    metrics_engine.js
    csv_builder.js
    monte_carlo.js
    heatMapBuilder.js
    insightEngine.js

  ui/
    htmlGen.js
    workerClient.js
    mapRenderer.js
    uiManager.js
    appController.js
    dataBinder.js
    tutorial.js

  scenario/
    demo.json
    scratch.json
```

## File To Function Map

### `src/util/math/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `physics.js` | `clamp`, `round`, `deepClone`, `ensureArray`, `angleDeg`, `smallestAngleDifference` | General data handling, bounds, and angle helpers. |
| `vector3D.js` | `distance3D`, `distance2D`, `subtractVectors`, `addVectors`, `scaleVector`, `dotProduct`, `magnitude3D`, `magnitude2D`, `normalizeVector`, `normalizeVector2D`, `dotProduct2D` | Core linear algebra for movement, raycasting, and kinematics. |
| `geospatial.js` | `getActiveTerrainObjects`, `pointInPolygon`, `orientation2D`, `onSegment2D`, `segmentsIntersect2D`, `segmentIntersectsPolygon2D`, `getTerrainCentroid`, `getTerrainIntersection`, `getTerrainNoisePenalty` | Terrain geometry, LOS masking, and clutter/noise checks. |
| `random.js` | `class SeededRNG` | Mulberry32 RNG and normal-distribution sampling. |

### `src/util/schema/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `normalizer.js` | `normalizeRoles`, `normalizeMissionProfile`, `normalizeLostLinkBehavior`, `normalizePayload`, `normalizeResistance`, `normalizeSignature`, `normalizeVulnerability`, `normalizeCapability`, `normalizeSensorType`, `normalizeSensor`, `normalizeEffectorType`, `normalizeDeliveryModel`, `normalizeEffector`, `normalizeScenario` | Populate safe defaults and keep scenario payloads structurally stable. |
| `validator.js` | `createValidationIssue`, `validateScenario` | Logical validation and human-readable issues. |

### `src/kernel/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `event_manager.js` | `EVENT_PRIORITIES`, `MIN_STATE_DELAY_SEC`, `THREAT_SPEED_THRESHOLD_MPS`, `THREAT_DISTANCE_EPSILON_M`, `CLASSIFICATION_STALE_SEC`, `IDENTIFICATION_STALE_SEC`, `INTENT_STALE_SEC`, `CLASSIFICATION_CONFIDENCE_DELTA`, `IDENTIFICATION_CONFIDENCE_DELTA`, `TRACK_QUALITY_DELTA`, `INTENT_SPEED_DELTA_MPS`, `INTENT_HEADING_DELTA_DEG`, `class EventManager` | Discrete-event queue and event ordering. |
| `world_state.js` | `getObject`, `getTrack`, `getTracksForSide`, `getAllTracks`, `getTracksForObject`, `getSensor`, `getSensorRuntimeState`, `getOpposingSide`, `getObjectsForSide`, `getSideAssets`, `getEffectorRuntimeState`, `getObjectSideById`, `inferLogSide` | Read-only world queries. |
| `world_mutators.js` | `syncFpvSensorHeading`, `clearEffectorAssignment`, `markObjectDestroyed`, `applyDamageEvent`, `removeRuntimeObject`, `setObjectControlMode`, `restoreObjectControlMode`, `clearExpiredRuntimeEffects`, `buildRandomOffset` | Safe state writers and runtime effect cleanup. |
| `simulation_manager.js` | `buildBaselineScenario`, `buildDemoScenario`, `buildScratchScenario`, `class SimulationManager` | Scenario factories and simulation orchestration. |
| `simulation_manager.js` | `createRuntimeWorld` | Runtime object instantiation, hidden infrastructure setup, and active environment-state initialization. |

### `src/kernel/systems/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `movement.js` | `class MovementSystem` | Waypoints, pursuit, kinematics, endurance depletion, and terrain collisions. |
| `sensor.js` | `class SensorSystem` | Detection, LOS, sensor-domain SNR checks, and anomaly observations. |
| `track.js` | `class TrackSystem` | Real/anomaly track creation, aging, and fusion. |
| `cognitive.js` | `class ClassificationSystem`, `class IdentificationSystem`, `class IntentSystem`, `getVelocityVector`, `estimateTrackPayloadScore`, `findMissionHeuristicTarget`, `resolveProjectedAsset`, `updateTrackThreatAssessment`, `createAssessmentStageState`, `startAssessmentCycle`, `recordAssessmentDecision` | Track assessment and intent reasoning. |
| `c2.js` | `class C2System` | TEWA and effector tasking. |
| `network.js` | `class NetworkSystem` | Hidden infrastructure, comms, power, and EW degradation. |
| `effect.js` | `class EffectSystem` | Fire resolution, child interceptors, ballistic lead, telemetry-spoof penalties, DEW dwell penalties, and EW effects. |
| `damage.js` | `class DamageSystem` | HP reduction, destroy state, and secondary effects. |

### `src/report/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `logger.js` | `class LoggingSystem` | World log formatting and event text. |
| `metrics_engine.js` | `snapshotWorld`, `recordAssessmentSnapshot`, `finalizeReport` | Final report payload assembly. |
| `csv_builder.js` | `createCsvRow`, `rowsToCsv` | CSV flattening for downstream analysis. |
| `monte_carlo.js` | `class MonteCarloManager` | Multi-run aggregation. |
| `heatMapBuilder.js` | Placeholder | Reserved for future report visuals. |
| `insightEngine.js` | Placeholder | Reserved for future automated insight summaries. |

### `src/ui/`
| Target file | Functions / classes | Responsibility |
|---|---|---|
| `htmlGen.js` | `escapeHtml` | UI string sanitization. |
| `workerClient.js` | `createMonteCarloWorker` | Browser-thread worker bootstrap. |
| `mapRenderer.js` | `class MapRenderer` | Canvas render and selection overlay logic. |
| `uiManager.js` | `class UIManager` | Screen and tray visibility management. |
| `appController.js` | `class AppController` | Browser event binding and scenario-wizard orchestration. |
| `dataBinder.js` | Placeholder | Reserved for future explicit UI binding separation. |
| `tutorial.js` | Placeholder | Reserved for tutorial/help flow extraction. |

### `src/scenario/`
| File | Responsibility |
|---|---|
| `demo.json` | Reference placeholder for the demo FOB-defense scenario. |
| `scratch.json` | Reference placeholder for the blank scratch scenario. |

## Missing Or Newly Explicit Runtime Fields

These fields were not called out clearly in the original table and are now part of the extracted design:

### World-level fields
| Field | Purpose |
|---|---|
| `world.scenario` | Active normalized scenario data. |
| `world.config` | Runtime configuration copied from the scenario. |
| `world.metrics` | Run counters and score bookkeeping. |
| `world.infrastructure` | Hidden per-side network/power state. |
| `world.blueTracks`, `world.redTracks` | Split track stores by side. |
| `world.objectIds` | Stable iteration order for world objects. |
| `world.logs` | Runtime log stream. |
| `world.environment.activeAnomalies` | Temporary environment-driven false-detection sources. |
| `world.environment.activeClutter` | Temporary clutter/noise objects used in LOS/noise checks and frame output. |
| `world.seededRng` | Deterministic run RNG. |

### Object runtime fields
| Field | Purpose |
|---|---|
| `runtime.currentSpeedMps` | Kinematic integration state. |
| `runtime.currentHeadingDeg` | Kinematic heading state. |
| `runtime.controlMode` | C2-directed, autonomous, or fallback control mode. |
| `runtime.c2AssignedTargetId` | Current C2 tasking target. |
| `runtime.jammedUntilSec` | EW jam timeout. |
| `runtime.spoofedOffset` | Navigation corruption offset. |
| `runtime.telemetrySpoofed` | Track/telemetry corruption flag. |
| `runtime.telemetryOffsetXY` | Red/Blue telemetry displacement. |
| `runtime.spawnTimeSec` | Endurance and child-object lifecycle anchor. |
| `runtime.spoofRestored` | State transition marker. |
| `runtime.telemetryRestored` | State transition marker. |
| `runtime.interceptorChild` | Guided munition child state. |

## Notes For The Next Split Pass

- `index.html` remains the ready-to-test build.
- `src/` is a review tree and Vite-review target, not yet the runtime source of truth.
- The placeholder files exist to keep the architecture stable while the remaining browser-thread and analytics helpers are separated in a later pass.
- The June 15 v2.4 pass added dynamic environment scheduling, same-side telemetry spoof handling, endurance depletion, ballistic spoof penalties, and command-guided effector cleanup; those seams should stay visible when the monolith is finally decomposed.
