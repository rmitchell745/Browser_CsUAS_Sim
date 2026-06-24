# C-sUAS Tactical Simulator

This repository currently contains a browser-only component-system Counter-small UAS discrete event simulation prototype with a three-tier authoring workflow, tactical workstation UI, and a first-pass multispectrum / EW-cyber modeling slice.

Current review version: `v2.6.2`

The repo also includes a standalone offline environment/scenario extraction utility at `external_util/Environment_Extractor.html`.

## Current prototype

- Single-file `index.html`
- 6-module top-navigation shell for demo/tutorial, template building, environment workflow handoff, scenario building, single-run ops, and Monte Carlo review
- Local scenario JSON import/export for the current template + instance format
- `Demo & Tutorial` landing module with read-only scenario preview and fast demo/scratch loading
- `Scenario Builder` live editor for terrain/environment, instance placement, and optional generator-draft review
- Per-instance heading editing in the Scenario Builder for placed Blue/Red objects
- `Template Builder` split-pane editor with helper actions, subcomponent editing, advanced JSON, and explicit power/network fields
- `Monte Carlo Run` analysis screen with event timeline, aggregate summaries, and failure-driver surfaces
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
- Vite single-file bridge with a native module-worker Monte Carlo path layered over the legacy shell
- Export preview tabs for scenario JSON, single-run report JSON, event log JSON, and Monte Carlo CSV
- Click-to-select and click-to-move geographic editing for placed scenario objects after build/import
- Imported scenario JSON now replaces both the editor draft and the staged active run scenario when loaded through the primary scenario import flow
- Commented JSONC reference examples under `Docs/sample_data/` for template, instance, terrain, and system-object authoring

## Usage

1. Open `index.html` directly in a browser.
2. Use `Load Scenario JSON` to import a local scenario file, or keep the built-in baseline scenario.
3. Use `Scenario Builder` when you want to edit the live scenario directly without hand-editing JSON.
4. Use `Generate From Wizard` only when you want the generator draft to replace the live scenario.
5. Use `Template Builder` for major capability edits, helper-oriented template work, and selected-template JSON edits.
6. Use the `Instance Manager` inside the Scenario Builder for per-instance placement and review plus hidden per-side infrastructure status.
7. Review the validation panel before running to catch blockers, warnings, and quality notes.
8. Use `Run Single Scenario` to execute the current scenario and animate the resulting frames on the canvas.
9. Use `Run Monte Carlo` to execute repeated seeded runs in an inline Web Worker and populate the aggregate report table.
10. Use `Run (Monte Carlo)` to inspect event sequencing, single-run details, aggregate summaries, and failure-driver surfaces.
11. Use the export surfaces inside the analysis modules to download the current scenario JSON, single-run outputs, Monte Carlo CSV, or event log JSON.
12. Inspect the single-run report JSON when needed to review `assessmentSnapshots` for stateful refresh/skip behavior.
13. Use the Vite path when reviewing the modularization effort; it now runs Monte Carlo through a native module worker, while `index.html` remains the direct ready-to-test reference build.
14. Use `Docs/sample_data/` when authoring template or scenario JSON by hand or when prompting external tools/LLMs to generate compatible objects.

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
- No external libraries, backend, build step, or network calls
- Scenario validation is still lightweight and assumes the current template + instance schema
- The dynamic environment model is first-pass only; richer doctrine-aware weather, clutter classes, and persistent anomaly workflows remain deferred
- EW/cyber is still first-pass: jamming, meaconing, and telemetry injection are modeled, but richer band logic, operator workflows, and full cyber doctrine remain deferred
