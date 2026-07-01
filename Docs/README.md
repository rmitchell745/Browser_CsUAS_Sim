# C-sUAS Tactical Simulator

This repository currently contains a browser-based component-system Counter-small UAS discrete event simulation prototype with a modular Vite shell, staged scenario editing workflow, tactical workstation UI, and a first-pass multispectrum / EW-cyber modeling slice.

Current review version: `v2.6.5`

The repo also includes a standalone offline environment/scenario extraction utility at `external_util/Environment_Extractor.html`.

## Current prototype

- Editable modular source shell based on:
  - `index_base.html`
  - `screens/*.html`
  - `style.css`
  - `main.js`
- Deployable built artifact at `dist/index.html`
- GitHub Pages deployment via GitHub Actions from the `dist/` artifact
- Dual-navigation tactical shell:
  - top nav: `Demo & Tutorial`, `Template Editor`, `Scenario Editor`, `Run Scenario`, `View Reports`
  - helper nav: `Environment Extractor`, `About`
- Scenario draft vs staged-active workflow:
  - `Scenario Editor` modifies the draft scenario
  - `Stage Current Scenario` replaces the active in-memory scenario used by `Run Scenario`
- Local scenario JSON import/export for the current template + instance format
- `Demo & Tutorial` landing module with quick-start content, demo preview, and JSON-backed demo/scratch loading
- `Scenario Editor` live editor for terrain/environment, group/instance placement, and draft scenario management
- Per-instance heading editing plus full multi-waypoint route editing in the Scenario Editor for placed Blue/Red objects
- `Template Editor` split-pane editor with helper actions, subcomponent editing, advanced JSON, and explicit power/network fields
- `Run Scenario` operations screen with simulation map, playback controls, and event feeds
- `View Reports` analysis screen with aggregate summaries, debrief views, export surfaces, and failure-driver surfaces
- Sample baseline scenario with a Blue FOB defense package versus a Red swarm attack
- Discrete event queue with movement, sensing, tracking, classification, identification, intent, C2, firing, effect, and damage resolution
- Spawned child interceptor runtime objects for launcher effects
- First-pass terrain polygons with LOS blocking, RF/noise penalties, and collision checks
- Hidden single network and single power grid per side, with Red C2-directed behavior plus autonomous / heuristic fallback
- Multispectrum signatures for radar, acoustic, and passive RF sensing
- First-pass jammer, navigation spoofer, and telemetry-cyber effect resolution with hidden network degradation
- Dynamic environment anomaly/clutter scheduling in the runnable kernel
- Same-side-only telemetry spoof impact on track observation, ballistic lead, and C2/effectors
- Endurance depletion and crash behavior for movers with finite `maxEnduranceSec`
- Template common-form editing for vulnerability, payload, and lost-link behavior fields
- Terminal one-way attack drone impact resolution through `components.payload.impactDamagePoints`
- XY-only TEWA projected-target association with hysteresis-based threat drop
- Stateful classification, identification, and intent refresh with retained assessment snapshots in single-run report JSON
- Transitioning environment model: the runnable kernel now uses dynamic anomalies/clutter, while some UI/debug surfaces still preserve placeholder-era labels for compatibility
- Scenario validation grouped into blockers, warnings, and scenario-quality notes with editor jump-links
- Track aging and stale track drop behavior
- Event log, single-run report, worker-backed Monte Carlo aggregation, and flat CSV export with dynamic ammo columns and weighted survival metrics
- Vite single-file build with a native module-worker Monte Carlo path layered over the current shell
- Export preview tabs for scenario JSON, single-run report JSON, event log JSON, and Monte Carlo CSV
- Click-to-select and click-to-move geographic editing for placed scenario objects after build/import
- Imported scenario JSON now replaces both the editor draft and the staged active run scenario when loaded through the primary scenario import flow
- Commented JSONC reference examples under `Docs/sample_data/` for template, instance, terrain, and system-object authoring
- Runtime freeze fixes for dense multisensor scenarios:
  - `sensor.scan` scheduling is per sensor, not self-multiplying per host
  - assessment cycles coalesce while a cycle is already in flight
  - track-age events no longer grow unbounded on repeated track refresh
- Additional performance controls for sensor-heavy runs:
  - per-sensor same-tick scan deduplication
  - cue/busy scan lock so routine sweeps do not continue during sensor slew/cue windows
  - throttled frame capture with guaranteed major-event snapshots
  - faster playback timing at 5 FPS
- First-pass interaction-model additions:
  - authored sensor `slewRateDps` and runtime sensor heading state
  - authored effector heading/FOV/slew fields for future arc-constrained firing work
  - playback overlays for ballistic tracers, directed-energy beams, and EW sector pulses
  - `AnalysisEngine` report helper for centralized derived run/debrief summaries

## Usage

1. Use `npm run dev` for local editing, or `npm run build` then `npm run preview` to review the deployable build.
2. Treat `index_base.html`, `screens/`, `style.css`, and `main.js` as the editable app source.
3. Treat `dist/index.html` as the deployable GitHub Pages artifact generated by the build.
4. Use `Load Scenario JSON` in `Scenario Editor` to import a local scenario file into the draft scenario.
5. Edit terrain, environment, groups, and instances in `Scenario Editor`; these edits modify the draft scenario only.
6. Click `Stage Current Scenario` when you want `Run Scenario` to use the updated draft.
7. Use `Template Editor` for capability edits, helper-oriented template work, and selected-template JSON edits.
8. Review the validation panel before staging/running to catch blockers, warnings, and quality notes.
9. Use `Run Scenario` to execute the currently staged scenario and animate the resulting frames on the canvas.
10. Use `View Reports` to inspect single-run debriefs, aggregate summaries, Monte Carlo results, and export surfaces.
11. Use `Docs/sample_data/` when authoring template or scenario JSON by hand or when prompting external tools/LLMs to generate compatible objects.
12. Use `external_util/Environment_Extractor.html` when generating scenario-ready terrain/background packages outside the main app.

## Playtest package

Upload-ready playtest scenarios live under `Docs/Playtest/`.

Start with:

- `playtest_01_baseline_single_kill_chain.json`
- `playtest_02_lock_and_fire_loop.json`
- `playtest_03_tewa_priority.json`
- `playtest_04_dynamic_csv_multi_effector.json`
- `playtest_05_stateful_assessment.json`
- `playtest_06_terrain_los_block.json`
- `playtest_07_terrain_noise_penalty.json`
- `playtest_08_ew_network_degradation.json`
- `playtest_09_child_interceptor_timeout.json`
- `playtest_10_red_fallback_behavior.json`
- `playtest_11_owa_terminal_impact.json`
- `playtest_12_multispectrum_detection.json`
- `playtest_13_jammer_lost_link_rtb.json`
- `playtest_14_spoofer_meaconing.json`
- `playtest_15_cyber_telemetry_spoof.json`

Use `Docs/Playtest/PLAYTEST_PLAN.md` as the execution checklist.

## Standalone extractor

- `external_util/Environment_Extractor.html` is the authoritative standalone extractor.
- It now defaults to generating simulator-ready scenario JSON and can also export a legacy environment package.
- The older `Envornment_Extractor_2.html` path now redirects to the canonical extractor.

## Scope limits

- No reusable template library yet beyond the scenario-local Template Editor / detailed editor
- Terrain editing is first-pass polygon capture only; there is no rerouting or pathfinding yet
- Network and power are modeled as hidden single infrastructure objects per side, not user-editable topology yet
- There is still no dedicated doctrine or spectrum workflow UI beyond the expanded Template Editor common form and raw JSON editor
- Template Editor helper sections are placeholders, not full derived-field calculators yet
- The app now has a build step and dev tooling, but it is still browser-only with no backend service
- Scenario validation is still lightweight and assumes the current template + instance schema
- The dynamic environment model is first-pass only; richer doctrine-aware weather, clutter classes, and persistent anomaly workflows remain deferred
- EW/cyber is still first-pass: jamming, meaconing, and telemetry injection are modeled, but richer band logic, operator workflows, and full cyber doctrine remain deferred
