# C-sUAS Monte Carlo DES Prototype

This repository currently contains the first browser-only vertical slice for a component-system Counter-small UAS discrete event simulation.

## Current prototype

- Single-file `index.html`
- Dark UI theme with neon purple and neon blue panel / button styling
- Local scenario JSON import/export for the current template + instance format
- Sample baseline scenario with one Blue site and one Red UAS
- Discrete event queue with movement, sensing, tracking, classification, identification, intent, C2, firing, effect, and damage resolution
- XY-only TEWA projected-target association with hysteresis-based threat drop
- Stateful classification, identification, and intent refresh with retained assessment snapshots in single-run report JSON
- Ghost-track placeholder spawning and clutter-field placeholder overlays
- Scenario validation summary plus malformed JSON import feedback
- Track aging and stale track drop behavior
- Event log, single-run report, worker-backed Monte Carlo aggregation, and flat CSV export with dynamic ammo columns and weighted survival metrics

## Usage

1. Open `index.html` directly in a browser.
2. Use `Load Scenario JSON` to import a local scenario file, or keep the built-in baseline scenario.
3. Use the dashboard toggles to enable or disable the ghost-track and clutter placeholders for the active scenario.
4. Review the `Scenario Validation` panel before running to catch blocking errors and warnings.
5. Use `Run Single Scenario` to execute the detailed vertical slice and animate the resulting frames on the canvas.
6. Use `Run Monte Carlo` to execute repeated seeded runs in an inline Web Worker and populate the aggregate report table.
7. Use the `Raw Data / Export` screen to export the current scenario JSON, single-run CSV, Monte Carlo CSV, or event log JSON.
8. Inspect the single-run report JSON when needed to review `assessmentSnapshots` for stateful refresh/skip behavior.

## Playtest package

Upload-ready playtest scenarios live under `Docs/Playtest/`.

Start with:

- `playtest_01_baseline_single_kill_chain.json`
- `playtest_02_lock_and_fire_loop.json`
- `playtest_03_tewa_priority.json`
- `playtest_04_dynamic_csv_multi_effector.json`
- `playtest_05_stateful_assessment.json`

Use `Docs/Playtest/PLAYTEST_PLAN.md` as the execution checklist.

## Scope limits

- No scenario builder yet
- No terrain editor yet
- No external libraries, backend, build step, or network calls
- Scenario validation is still lightweight and assumes the current template + instance schema
- Ghost and clutter handling are placeholders, not full environment modeling
