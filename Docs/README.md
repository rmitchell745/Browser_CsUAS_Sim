# C-sUAS Monte Carlo DES Prototype

This repository currently contains the first browser-only vertical slice for a component-system Counter-small UAS discrete event simulation.

## Current prototype

- Single-file `index.html`
- Dark UI theme with neon purple and neon blue panel / button styling
- Local scenario JSON import/export for the current template + instance format
- Sample baseline scenario with one Blue site and one Red UAS
- Discrete event queue with movement, sensing, tracking, classification, identification, intent, C2, firing, effect, and damage resolution
- Ghost-track placeholder spawning and clutter-field placeholder overlays
- Scenario validation summary plus malformed JSON import feedback
- Track aging and stale track drop behavior
- Event log, single-run report, worker-backed Monte Carlo aggregation, and flat CSV export

## Usage

1. Open `index.html` directly in a browser.
2. Use `Load Scenario JSON` to import a local scenario file, or keep the built-in baseline scenario.
3. Use the dashboard toggles to enable or disable the ghost-track and clutter placeholders for the active scenario.
4. Review the `Scenario Validation` panel before running to catch blocking errors and warnings.
5. Use `Run Single Scenario` to execute the detailed vertical slice and animate the resulting frames on the canvas.
6. Use `Run Monte Carlo` to execute repeated seeded runs in an inline Web Worker and populate the aggregate report table.
7. Use the `Raw Data / Export` screen to export the current scenario JSON, single-run CSV, Monte Carlo CSV, or event log JSON.

## Scope limits

- No scenario builder yet
- No terrain editor yet
- No external libraries, backend, build step, or network calls
- Scenario validation is still lightweight and assumes the current template + instance schema
- Ghost and clutter handling are placeholders, not full environment modeling
