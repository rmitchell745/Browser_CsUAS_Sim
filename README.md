# C-sUAS Monte Carlo DES Prototype

This repository currently contains the first browser-only vertical slice for a component-system Counter-small UAS discrete event simulation.

## Current prototype

- Single-file `index.html`
- Hardcoded sample scenario with one Blue site and one Red UAS
- Discrete event queue with movement, sensing, tracking, classification, C2, firing, effect, and damage resolution
- Event log, single-run report, Monte Carlo aggregation, and flat CSV export

## Usage

1. Open `index.html` directly in a browser.
2. Use `Run Single Scenario` to execute the detailed vertical slice and animate the resulting frames on the canvas.
3. Use `Run Monte Carlo` to execute repeated seeded runs and populate the aggregate report table.
4. Use the `Raw Data / Export` screen to export the current single-run CSV, Monte Carlo CSV, or event log JSON.

## Scope limits

- No scenario builder yet
- No terrain editor yet
- No external libraries, backend, build step, or network calls
- Monte Carlo currently runs on the main thread rather than a Web Worker
