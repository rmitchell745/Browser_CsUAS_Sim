# Browser CsUAS Sim v2.00

This repository currently contains a browser-only component-system Counter-small UAS discrete event simulation prototype with a three-tier authoring workflow and tactical workstation UI.

## Current prototype

- Single-file `index.html`
- Tactical workstation shell centered on the live map
- Local scenario JSON import/export for the current template + instance format
- `Scenario Editor` drawer for terrain/environment, Blue placement, Red threat layout, and spatial assignment
- `Template Wizard` drawer with helper placeholders plus detailed scenario-local template editing and selected-template JSON editing
- `Rosters / Infrastructure` drawer for Tier 2 force-package summary plus read-only hidden per-side network / power status
- `Debrief` drawer with event timeline and top failure-driver surfaces
- `Export` drawer with scenario/report/log/Monte Carlo export previews
- Sample baseline scenario with one Blue site and one Red UAS
- Discrete event queue with movement, sensing, tracking, classification, identification, intent, C2, firing, effect, and damage resolution
- Spawned child interceptor runtime objects for launcher effects
- First-pass terrain polygons with LOS blocking, RF/noise penalties, and collision checks
- Hidden single network and single power grid per side, with Red C2-directed behavior plus autonomous / heuristic fallback
- First-pass EW jamming that degrades RF sensing and hidden network state
- Terminal one-way attack drone impact resolution through `components.payload.impactDamagePoints`
- XY-only TEWA projected-target association with hysteresis-based threat drop
- Stateful classification, identification, and intent refresh with retained assessment snapshots in single-run report JSON
- Ghost-track placeholder spawning and clutter-field placeholder overlays
- Scenario validation grouped into blockers, warnings, and scenario-quality notes with editor jump-links
- Track aging and stale track drop behavior
- Event log, single-run report, worker-backed Monte Carlo aggregation, and flat CSV export with dynamic ammo columns and weighted survival metrics
- Export preview tabs for scenario JSON, single-run report JSON, event log JSON, and Monte Carlo CSV
- Click-to-select and click-to-move geographic editing for placed scenario objects after build/import

## Usage

1. Open `index.html` directly in a browser.
2. Use `Load Scenario JSON` to import a local scenario file, or keep the built-in baseline scenario.
3. Use `Scenario Editor` when you want to create or adjust a runnable scenario without hand-editing JSON.
4. Use `Build Scenario From Editor` before running if the current editor draft differs from the active scenario.
5. Use `Template Wizard` for major capability edits, helper-oriented template work, and selected-template JSON edits.
6. Use `Rosters / Infrastructure` for Tier 2 force-package review plus hidden per-side infrastructure status.
7. Review the validation panel before running to catch blockers, warnings, and quality notes.
8. Use `Run Single Scenario` to execute the detailed vertical slice and animate the resulting frames on the canvas.
9. Use `Run Monte Carlo` to execute repeated seeded runs in an inline Web Worker and populate the aggregate report table.
10. Use `Debrief` to inspect event sequencing, Blue/Red feeds, and failure-driver summaries.
11. Use `Export` to download the current scenario JSON, single-run outputs, Monte Carlo CSV, or event log JSON.
12. Inspect the single-run report JSON when needed to review `assessmentSnapshots` for stateful refresh/skip behavior.

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

Use `Docs/Playtest/PLAYTEST_PLAN.md` as the execution checklist.

## Scope limits

- No reusable template library yet beyond the scenario-local Template Wizard / detailed editor
- Terrain editing is first-pass polygon capture only; there is no rerouting or pathfinding yet
- Network and power are modeled as hidden single infrastructure objects per side, not user-editable topology yet
- OWA payloads are currently authored through scenario/template JSON fields, not through a dedicated common-form payload editor yet
- Template Wizard helper sections are placeholders, not full derived-field calculators yet
- No external libraries, backend, build step, or network calls
- Scenario validation is still lightweight and assumes the current template + instance schema
- Ghost and clutter handling are still placeholders, not full environment modeling
- EW currently covers jamming / network degradation only; spoofing and cyber remain deferred
