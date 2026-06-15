# TODO.md

# C-sUAS Monte Carlo DES Prototype TODO

This file is a running work tracker for Codex.

Codex must review this file at the start of every work session and update it before ending the session.

---

# Current Build Goal

Implement the V2.2 refactor request set with the lowest-risk order: tracker updates first, then kernel sided-track / fallback / logging fixes, then UI terminology cleanup, roster instance control, and the new FOB swarm baseline.

- update the work tracker before and after each refactor tranche so the next pass stays decision-complete
- split Red/Blue cognitive tracks and fix Red fallback hierarchy so Red only falls back when control is actually lost
- improve log observability for TEWA, detection, and spoofer runs so playtests 03 / 12 / 14 stop depending on payload internals
- add interceptor guidance typing and retasking so command-guided launchers stay locked while autonomous missiles can release immediately
- rename the UI terminology to `C-sUAS Tactical Simulator`, `Scenario Wizard`, `Template Editor`, `Report Viewer`, and `Raw Data / Export`
- consolidate roster editing into instance-level control inside the Scenario Wizard
- replace the baseline scenario with the FOB defense swarm-attack layout requested in `Docs/ReFactorReq/260611.md`

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
- [ ] Finish the sided-track / Red telemetry refactor and confirm Blue systems only read `blueTracks` while Red telemetry populates `redTracks`.
- [ ] Review the extracted `src/` tree and wire module imports only after the split is approved; keep `index.html` as the runnable shell for now.
- [ ] Verify Red fallback hierarchy in-browser so `Networked` stays primary, `Loiter` is allowed when untasked, and fallback only appears after jam or C2 destruction.
- [ ] Verify interceptor guidance split in-browser so command-guided launchers stay locked and autonomous launchers release cleanly.
- [ ] Add true effector heading, FOV, and slew modeling so weapon orientation can constrain engagement arcs instead of using only cooldown and range.
- [ ] Finish the UI terminology cleanup across the shell, drawers, hero copy, and scenario naming.
- [ ] Convert the roster screen into an instance manager in the Scenario Wizard and verify single-instance map placement.
- [ ] Replace the baseline scenario with the FOB defense swarm-attack layout and verify terrain/placement load cleanly.
- [ ] Review the new stateful assessment thresholds in live playtest and tighten any remaining over-refresh or under-refresh cases.
- [ ] Verify the expanded template common form in-browser for signatures, vulnerabilities, payload fields, and lost-link behavior persistence.
- [ ] Tune the first-pass Blue sensor-cueing loop so ISR tasking closes assessment gaps without repeatedly cueing the same track.
- [ ] Tune first-pass jammer, spoofer, and cyber strengths / durations so network degradation and deception are visible but not overwhelming in baseline playtests.
- [ ] Run the focused playtest package `playtest_03`, `05`, `07`, `08`, `10`, `12`, and `14` after the refactor and capture the new expected-result notes.
- [ ] Reconcile the failing playtests against the current kernel: decide per scenario whether to tune physics/doctrine in `index.html` or update the playtest geometry/expectations in `Docs/Playtest/PLAYTEST_PLAN.md` for `playtest_01`, `05`, `06`, `07`, `08`, `09`, `10`, `12`, `13`, `14`, and `15`.
- [ ] Keep `playtest_07` on the radar-based noise path, not passive RF, so it stays aligned with the intended terrain-noise regression.
- [ ] Recheck `playtest_13` lost-link RTB under the current kinematics if it remains slow or non-terminating in the browser pass.
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
- [x] Added a scenario-local Template Editor UI for editing embedded templates without switching to full raw scenario JSON.
- [x] Added a Scenario Wizard with starter patterns for baseline, lock/refire, and TEWA-priority quick-build scenarios.
- [x] Refactored the Scenario Wizard so Red threats can be authored as multiple threat groups with separate template profiles, counts, and routes.
- [x] Upgraded validation into grouped blockers, warnings, and scenario-quality notes with recommended fixes and editor jump-links.
- [x] Improved JSON import/export usability with preview tabs, pretty-print toggle, copy-to-clipboard, and normalized-vs-original scenario export selection.
- [x] Reserved a Timeline / Analysis screen so the next UX tranche can land without refactoring the screen manager again.
- [x] Refactored optical sensors (`EO_IR`, `FPV`) so they use LOS + range with quadratic confidence decay instead of radar-style dB logic.
- [x] Added dynamic FPV heading alignment to platform movement updates.
- [x] Expanded classification / identification so opposite-side Blue assets can be treated as hostile ground targets when confidence supports it.
- [x] Added a first-pass Blue ISR sensor-cueing loop for classification / identification gaps.
- [x] Added authored Red `missionProfile` support with `Geographic`, `SpecificAsset`, and `MaxDamage` behaviors.
- [x] Added pursuit / attack-run movement overrides so locked or heuristic-targeted movers can leave static waypoint behavior.
- [x] Added side-aware event logging and split Blue / Red operational feeds.
- [x] Replaced the old screen stack with a tactical workstation shell centered on the live map.
- [x] Moved scenario, template, report, analysis, and export workflows into right-side drawer panels.
- [x] Added map background upload, map-width scaling, and zoom / pan controls.
- [x] Added Event Timeline and Top Failure Drivers analysis surfaces.
- [x] Added canvas overlays for effector coverage / fields of view and UAS intent headings.
- [x] Differentiated `track update` logging so playtest review can distinguish same-sensor refresh, new-sensor fusion, and major track-state changes.
- [x] Added standalone selected-template import / export inside the template workflow.
- [x] Refined the workstation into a clearer three-tier flow with `Scenario Wizard`, `Template Editor`, and `Instance Manager`.
- [x] Removed the old rotating side-panel labels and widened / increased transparency of the right-side drawers.
- [x] Added click-to-select quick object editing for geographic placement plus network / power assignment from the Scenario Wizard.
- [x] Refactored the `Interceptor Launcher` so it spawns a child interceptor runtime object that appears on the map and in reports.
- [x] Added first-pass terrain objects with map drawing, terrain rendering, LOS blocking, noise penalties, and route/interceptor collision behavior.
- [x] Hid explicit network / power editing and replaced it with implicit per-side runtime C2 network and power-grid models.
- [x] Added first-pass EW / jammer effect resolution that degrades per-side hidden network state and RF sensing conditions.
- [x] Added Red C2-directed strike assignment with autonomous and heuristic fallback states when linkage is lost or unavailable.
- [x] Fixed deterministic `playtest_01_baseline_single_kill_chain` so the fixed-seed baseline kill chain completes again with child interceptors.
- [x] Fixed deterministic `playtest_02_lock_and_fire_loop` so a single effector stays committed through cooldown instead of alternating targets mid-lock.
- [x] Added focused feature playtests for terrain LOS, terrain noise, EW network degradation, child-interceptor timeout, and Red fallback behavior.
- [x] Added OWA terminal impact resolution with payload-driven Blue asset damage and attacker self-expending behavior.
- [x] Added a focused OWA playtest scenario plus report fields for successful strikes and Blue asset damage.
- [x] Updated the browser smoke checks for the current tactical workstation shell and validated app load + single-run completion with a direct Playwright script.
- [x] Expanded template normalization and common-form editing for acoustic / passive RF signatures, distinct EW-cyber vulnerabilities, payload impact, and lost-link behavior.
- [x] Implemented multispectrum sensing plus first-pass jammer, meaconing, and telemetry-cyber runtime effects.
- [x] Added focused playtests for multispectrum detection, jammer-driven RTB fallback, navigation spoofing, and telemetry injection.

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
- [ ] Assessment snapshots remain available through single-run report JSON, but still need a dedicated debrief surface.
- [ ] The current Template Editor exposes helper placeholders plus common fields and selected-template JSON, but it does not yet provide a reusable local template library workflow.
- [ ] The new Blue sensor-cueing behavior is first-pass only and still needs live-playtest tuning for over-cue / under-cue edge cases.
- [ ] Red mission-profile attack-run behavior is still simple and now mixes C2-directed, autonomous, and heuristic fallback states without doctrine-rich terminal tactics yet.
- [ ] Hidden side-level network / power behavior is now modeled in runtime, but it is still single-network / single-grid per side with no user-facing topology editing.
- [ ] Terrain authoring is first-pass polygon capture only; there is still no rerouting, pathfinding, or richer terrain library workflow.
- [ ] EW/cyber now covers first-pass jamming, navigation spoofing, and telemetry injection, but richer band modeling, operator workflows, and doctrine-aware cyber effects remain deferred.
- [ ] The projectile model still lacks explicit lead-prediction / intercept-point solving, and target UAS do not yet perform evasive velocity changes that can force true misses or near-misses.
- [ ] Effectors still do not have a true orientation/FOV model; `slewRateSec` is only a delay today, not turret traverse or aim-cone behavior.
- [ ] The new focused playtests for multispectrum / spoofing / cyber have been authored, but they still need a full interactive expected-results pass.
- [x] A deterministic playtest sweep with seed `12345` now passes the key checks for `playtest_01` through `playtest_11`.

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
- UI now uses a tactical workstation shell with drawer-based `Scenario Wizard`, `Template Editor`, `Instance Manager`, `Debrief`, and `Raw Data / Export` panels while core simulation logic still lives in simulation and system classes.
- Single-run playback reuses recorded snapshots after simulation completion so rendering does not drive outcomes.
- Zero-delay follow-on state changes in the engagement chain enforce a minimum mechanical delay of `0.1` seconds.
- Monte Carlo execution now runs in an inline Blob Web Worker and uses a main-thread fallback only when workers are unavailable.
- C2 now ranks hostile tracks with a weighted TEWA heuristic and commits only Idle effectors.
- Effectors now stay locked through cooldown and can continue firing locally without waiting for a fresh sensor cycle.
- Scenario JSON import/export uses normalization around the current template + instance schema.
- Environment placeholders currently use a minimal `EnvironmentSystem` that can spawn a track-only ghost placeholder and render a clutter overlay without full object generation.
- Scenario validation now gates execution and surfaces blocking errors plus warnings directly in the dashboard UI.
- Kinetic interceptor launchers now spawn child runtime objects that pursue targets on the map and resolve or abort through their own movement lifecycle.
- Terrain now uses first-pass polygon objects for LOS blocking, RF/noise penalties, and route/interceptor collision checks.
- Network and power are now modeled as hidden single infrastructure objects per side rather than editable scenario topology.
- Optical sensors now use LOS + range-only confidence decay, while radar, acoustic, and passive RF sensors use distinct first-pass signal branches.
- EW/cyber currently applies jammer-driven network degradation, meaconing offsets, and telemetry deception through the `EffectSystem`.
- Blue C2 can now cue idle Blue sensors toward tracks with unresolved classification / identification gaps before effector assignment.
- Red mission profiles can now transition a mover among C2-directed, autonomous-fallback, and heuristic-fallback behavior depending on linkage and local conditions.

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

If the verification pass is clean, choose the next focused step: tune terrain / EW / Red fallback behavior in playtest, or deepen the hidden infrastructure model beyond one network and one power grid per side.

Keep the app browser-only, vanilla HTML, CSS, and JavaScript only, and do not build the full scenario editor yet.
```
