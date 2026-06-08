# TODO.md

# C-sUAS Monte Carlo DES Prototype TODO

This file is a running work tracker for Codex.

Codex must review this file at the start of every work session and update it before ending the session.

---

# Current Build Goal

Stabilize the first working browser-only vertical slice and prepare the next expansion pass:

- split simplified perception logic into explicit systems
- keep Monte Carlo explainable and deterministic
- prepare local scenario I/O without starting the full scenario builder

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
- Simple classification with simplified identification
- Simple C2 engagement decision
- Effector firing
- Damage resolution using Effective_Pk-style modifiers
- Single-run report
- Monte Carlo execution
- Results table
- Flat CSV export
- Event log panel

---

# Open Tasks

- [ ] Split simplified identification logic out of `ClassificationSystem` into a dedicated `IdentificationSystem`.
- [ ] Add a simple `IntentSystem` for behavior assessment from track history.
- [ ] Move Monte Carlo execution into an inline Web Worker to keep the UI responsive at higher iteration counts.
- [ ] Add local scenario JSON import/export for the current template + instance baseline format.
- [ ] Add track aging, stale track drop behavior, and report metrics for dropped tracks.
- [ ] Add ghost-track and clutter placeholders without building the full scenario editor UI.
- [ ] Manually open `index.html` in a browser and complete the browser-side checklist below.
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
- [ ] Current prototype folds identification into `ClassificationSystem`; a dedicated `IdentificationSystem` is still pending.
- [ ] Current prototype does not yet implement a dedicated `IntentSystem`.
- [ ] Monte Carlo currently runs on the main thread instead of an inline Web Worker.
- [ ] Docs currently live at the repo root, and `Simulation_Design_Expanded.md` is being used in place of `docs/Simulation_Design.md`.
- [ ] Physical-track flow is implemented, but ghost tracks, spoofed tracks, and clutter generation are still deferred.
- [ ] Manual browser validation checklist still needs to be completed in an actual browser session.
- [ ] Need to ensure `roles` remains an array, not an enum, as new import/export paths are added.

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
- Classification, identification, and intent remain logically separate even though identification is temporarily simplified in the current code.
- Red and Blue use the same object structure and runtime processing rules.
- UI screens are managed by `UIManager`; core simulation logic lives in simulation and system classes.
- Single-run playback reuses recorded snapshots after simulation completion so rendering does not drive outcomes.
- Zero-delay follow-on state changes in the engagement chain enforce a minimum mechanical delay of `0.1` seconds.

---

# Manual Test Checklist

Use this after each major prototype update.

- [x] Inline JavaScript extracted from `index.html` passes `node --check`.
- [ ] `index.html` opens in browser.
- [ ] No JavaScript syntax errors in browser console.
- [ ] Canvas renders.
- [ ] Blue object renders.
- [ ] Red object renders.
- [ ] Red UAS moves.
- [ ] Single-run simulation completes.
- [ ] Detection occurs.
- [ ] Track is created.
- [ ] Classification occurs.
- [ ] C2 decision occurs.
- [ ] Effector fires.
- [ ] Damage resolves.
- [ ] Event log updates.
- [ ] Monte Carlo run completes.
- [ ] Results table updates.
- [ ] CSV export downloads.

---

# Next Recommended Prompt

Use this prompt for the next Codex pass:

```text
Read AGENTS.md, TODO.md, README.md, and the root design docs.

Refactor the current vertical-slice prototype so classification, identification, and intent are separate systems.

Move Monte Carlo execution into an inline Web Worker, add local scenario JSON import/export for the current template + instance format, and add track aging / drop behavior.

Keep the app browser-only, vanilla HTML, CSS, and JavaScript only, and do not build the full scenario editor yet.
```
