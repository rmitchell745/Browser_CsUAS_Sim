# TODO.md

# C-sUAS Monte Carlo DES Prototype TODO

This file is a running work tracker for Codex.

Codex must review this file at the start of every work session and update it before ending the session.

---

# Current Build Goal

Verify the refactored browser-only vertical slice after the engagement, TEWA, and reporting pass:

- complete a broader browser verification pass beyond the local headless smoke test
- validate the new XY-only TEWA, hysteresis, and stateful assessment behavior in a fuller interactive browser pass
- tune the first-pass assessment refresh thresholds and snapshot review workflow based on playtest feedback
- decide whether the next step is interceptor-child modeling or deeper environment realism
- keep the prototype explainable and local-only

---

# Current Prototype Scope

The current working prototype now includes:

- Single `index.html` application
- Simplified `UIManager` screen state flow
- 2D canvas map with one Blue site and one Red UAS
- Hardcoded template + instance scenario baseline
- Discrete event queue
- Red UAS waypoint movement
- Detection candidate generation
- Track creation and updates
- Separate classification, identification, and intent stages
- Vector-projection intent assessment
- Weighted TEWA-based C2 engagement decision
- Ghost-track placeholder and clutter overlay placeholders
- Locked-target effector firing with autonomous cooldown fire loop
- Damage resolution using Effective_Pk-style modifiers
- Single-run report
- Monte Carlo execution in an inline Web Worker with fallback
- Results table
- Dynamic CSV export with weighted survival metrics
- Event log panel
- Scenario validation dashboard

---

# Open Tasks

- [ ] Complete a full browser verification pass on a machine where Chromium headless or an interactive browser can run reliably.
- [ ] Review the new stateful assessment thresholds in live playtest and tighten any remaining over-refresh or under-refresh cases.
- [ ] Decide whether assessment snapshots need a dedicated UI/export affordance beyond the current report JSON payload.
- [ ] Differentiate `track update` logging so playtest review can distinguish same-sensor refresh, new-sensor fusion, and major track-state changes.
- [ ] Refactor the `Interceptor Launcher` so it spawns a child interceptor sub-component / active map object, and ensure that interceptor appears in the map state and reporting outputs.
- [ ] Reconcile repo layout with expected `docs/` paths or update the document references consistently.

---

# Completed Tasks

- [x] Architecture documents created.
- [x] Component-based Data Model drafted.
- [x] Simulation Design drafted.
- [x] System Architecture drafted.
- [x] UI Architecture drafted.
- [x] AGENTS.md created.
- [x] TODO.md created.
- [x] Created `index.html`.
- [x] Added basic UI layout.
- [x] Added `UIManager`.
- [x] Added canvas rendering.
- [x] Added sample scenario data.
- [x] Added template + instance component-based object model.
- [x] Added `EventManager`.
- [x] Added `SimulationManager`.
- [x] Added `MovementSystem`.
- [x] Added `SensorSystem`.
- [x] Added `TrackSystem`.
- [x] Added `ClassificationSystem` with simplified identification.
- [x] Added `C2System`.
- [x] Added `EffectSystem`.
- [x] Added `DamageSystem`.
- [x] Added `LoggingSystem`.
- [x] Added single-run simulation button.
- [x] Added Monte Carlo simulation button.
- [x] Added summary metrics table.
- [x] Added flat CSV export.
- [x] Added README usage instructions.
- [x] Added Node-based inline JavaScript syntax validation.
- [x] Split classification, identification, and intent into separate systems.
- [x] Moved Monte Carlo execution into an inline Web Worker with main-thread fallback.
- [x] Added local scenario JSON import/export for the current template + instance baseline format.
- [x] Added track aging, stale track drop behavior, and dropped-track report metrics.
- [x] Updated the UI to a dark theme using neon purple and neon blue as the primary panel and button colors.
- [x] Added ghost-track and clutter placeholders without building the full scenario editor UI.
- [x] Added stronger scenario validation and user-facing import error reporting for malformed JSON inputs.
- [x] Attempted browser-side verification using local headless Chromium invocations in the sandbox.
- [x] Replaced static effector TOF with `projectileSpeed_mps`-based timing.
- [x] Replaced linear range degradation with quadratic decay in kinetic Pk.
- [x] Added effector mission-state locking and autonomous cooldown-based refire logic.
- [x] Replaced closest-first engagement ordering with weighted TEWA based on C2-derived payload estimates and projected asset impact.
- [x] Added HQ survival, percent survived, weighted survival score, and dynamic ammo CSV columns.
- [x] Verified a headless local Playwright smoke run against `index.html` after the refactor.
- [x] Refactored TEWA and intent projected-path calculations to use XY-only asset association.
- [x] Implemented TEWA hysteresis so `Attack Run` / elevated threat status drops after 2 consecutive non-closing or low-speed updates.
- [x] Refactored track assessment into a first-pass stateful model so classification, identification, and intent are refreshed only on meaningful triggers or staleness windows rather than every track update.
- [x] Added compact periodic assessment snapshots to preserve per-cycle debugging and analysis after stateful assessment gating.

---

# Deferred Features

Do not implement until after the first vertical slice works.

- [ ] Full scenario builder.
- [ ] Full terrain editor.
- [ ] Full template editor.
- [ ] Full roster builder.
- [ ] Full mission builder.
- [ ] Full power grid editor.
- [ ] Full spectrum environment editor.
- [ ] Full Red doctrine editor.
- [ ] Advanced report playback.
- [ ] Heat map rendering.
- [ ] Complex ghost track UI.
- [ ] Red spoofing workflow UI.
- [ ] Save/load scenario library.
- [ ] Sanitized portfolio export mode.

---

# Known Issues

- [ ] Scenario JSON schema is intentionally deferred until the first prototype stabilizes.
- [ ] UI Architecture is broader than first prototype scope.
- [ ] Docs now live under `Agents/` and `Docs/`, while several instructions still refer to root-level files and lowercase `docs/`.
- [ ] Chromium headless verification is blocked in this sandbox by repeated GPU-process startup failures and hangs, so a full browser pass still needs to be completed elsewhere.
- [ ] Physical-track flow is implemented, but ghost tracks, spoofed tracks, and clutter generation remain placeholder-level only.
- [ ] Need to ensure `roles` remains an array, not an enum, as new import/export paths are added.
- [ ] TEWA payload assessment is still heuristic and intentionally explainable; it is not yet informed by richer size/classification observables or doctrine inputs.
- [ ] Stateful assessment now uses fixed first-pass thresholds; those thresholds still need live browser tuning to avoid edge-case over-refresh or under-refresh behavior.
- [ ] Assessment snapshots are currently available in the single-run report JSON, but not yet through a dedicated UI surface or separate export control.

---

# Architecture Notes

- Use Component-System Architecture.
- Components contain data.
- Systems contain behavior.
- Avoid God classes.
- `roles` is an array.
- Behavior should come from components, not role strings.
- Physical objects and tracks are separate concepts.
- Detection creates detection candidates; `TrackSystem` owns track creation and updates.
- Classification, identification, and intent now run as distinct systems in the event chain.
- Track assessment now uses stateful gating with fixed first-pass refresh thresholds driven by confidence changes, staleness, new sensors, and meaningful motion changes.
- Intent now uses projected track motion against Blue assets rather than radial closure to the observing sensor.
- TEWA and intent now use XY-only projected asset association for threating decisions, while full 3D geometry remains in place for detection, range, and projectile time-of-flight.
- Threat-drop behavior now uses option 2: hysteresis. A hostile loses `Attack Run` / elevated TEWA status only after 2 consecutive updates showing low speed or increasing XY separation from the projected defended asset.
- The simulation now retains compact periodic assessment snapshots in the report payload so debugging and playtest analysis remain explainable even when the event log is quieter.
- Red and Blue use the same object structure and runtime processing rules.
- UI screens are managed by `UIManager`; core simulation logic lives in simulation and system classes.
- Single-run playback reuses recorded snapshots after simulation completion so rendering does not drive outcomes.
- Zero-delay follow-on state changes in the engagement chain enforce a minimum mechanical delay of `0.1` seconds.
- Monte Carlo execution now runs in an inline Blob Web Worker and uses a main-thread fallback only when workers are unavailable.
- C2 now ranks hostile tracks with a weighted TEWA heuristic and commits only Idle effectors.
- Effectors now stay locked through cooldown and can continue firing locally without waiting for a fresh sensor cycle.
- Scenario JSON import/export uses normalization around the current template + instance vertical-slice schema.
- Environment placeholders currently use a minimal `EnvironmentSystem` that can spawn a track-only ghost placeholder and render a clutter overlay without full object generation.
- Scenario validation now gates execution and surfaces blocking errors plus warnings directly in the dashboard UI.
- The current `Interceptor Launcher` is still resolved abstractly; future work should model a spawned interceptor child object as an active entity in the simulation and reports.

---

# Manual Test Checklist

Use this after each major prototype update.

- [x] Inline JavaScript extracted from `index.html` passes `node --check`.
- [x] `index.html` opens in browser.
- [x] No JavaScript syntax errors in browser console.
- [ ] Canvas renders.
- [ ] Blue object renders.
- [ ] Red object renders.
- [ ] Ghost placeholder toggle updates the dashboard and run-time behavior.
- [ ] Clutter placeholder toggle updates the dashboard and map overlay.
- [ ] Red UAS moves.
- [x] Single-run simulation completes.
- [ ] Detection occurs.
- [ ] Track is created.
- [ ] Classification occurs.
- [ ] Identification occurs.
- [ ] Intent assessment occurs.
- [ ] C2 decision occurs.
- [ ] Effector fires.
- [ ] Damage resolves.
- [x] Event log updates.
- [ ] Monte Carlo run completes.
- [ ] Results table updates.
- [ ] CSV export downloads.
- [ ] Scenario validation blocks malformed scenarios with clear feedback.

---

# Next Recommended Prompt

Use this prompt for the next Codex pass:

```text
Read AGENTS.md, TODO.md, README.md, and the root design docs.

Perform a browser verification pass for the current prototype on a machine where Chromium can run reliably, then address any UI or runtime defects found.

If the verification pass is clean, choose the next focused step: improve environment realism beyond placeholders, or refactor the `Interceptor Launcher` into a spawned child interceptor object that appears on the map and in reports.

Keep the app browser-only, vanilla HTML, CSS, and JavaScript only, and do not build the full scenario editor yet.
```
