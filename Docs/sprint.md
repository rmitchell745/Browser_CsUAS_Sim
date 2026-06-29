# Sprint Plan

## Week Of 29 Jun 2026

## Sprint Theme

Stabilize the core author-build-run-review loop in the Vite shell so scenarios can be created, staged, run, and reviewed reliably before deeper physics and modularization work continues.

## Primary Objective

By the end of this sprint, the team should be able to:

- edit a draft scenario in `Scenario Editor`
- stage it into the active run scenario
- run it from `Run Scenario` without browser stalls
- review it in `View Reports`
- verify the same flow in the built GitHub Pages artifact

## Sprint Goals

### 1. Scenario Authoring And Run Stability

- confirm the draft-to-staged workflow is reliable for:
  - demo scenario
  - imported scenario JSON
  - hand-built scenario edits
- verify live edits do not silently overwrite the active run scenario before `Stage Current Scenario`
- verify the staged scenario is always the one used by `Run Scenario`
- close any remaining browser-freeze or runaway-event issues in dense sensor runs

### 2. Browser Verification And Playtest Reconciliation

- run a focused browser verification pass against the built Vite artifact
- confirm the recent sensor dedup / cue-lock / frame-throttle changes behave correctly
- rerun the highest-value playtests and record outcomes
- identify whether each remaining playtest issue is:
  - kernel behavior
  - authored scenario geometry/tuning
  - expected-result drift

### 3. Orientation / Slew Modeling Preparation

- define the first implementation slice for:
  - sensor traverse / slew behavior
  - host-relative sensor mounting
  - effector heading / engagement arc constraints
- if time allows, implement the first narrow slice for sensors before effectors

### 4. Build And Deployment Confidence

- verify the GitHub Pages Actions deployment serves the current `dist/index.html`
- verify no bundle-only drift exists between editable source and deployed artifact
- keep `index_base.html`, `screens/`, `style.css`, and `main.js` as the authoritative editable app source

## In Scope

- scenario editor state and run-path fixes
- browser-based verification of the current UI shell
- focused playtest reruns and result notes
- first-pass sensor/effector orientation planning or implementation
- docs updates needed to keep README, TODO, and report expectations current

## Out Of Scope

- major new doctrine systems
- advanced EW band modeling
- deep `src/` cutover beyond what is needed to prevent drift
- major extractor rewrites beyond smoke verification
- new report/analytics feature families

## Priority Backlog

### P0

- verify and stabilize the draft -> stage -> run workflow end to end
- verify the browser no longer freezes in dense multisensor scenarios
- verify the built app on GitHub Pages matches the local build

### P1

- rerun focused playtests:
  - `playtest_03`
  - `playtest_05`
  - `playtest_07`
  - `playtest_08`
  - `playtest_10`
  - `playtest_12`
  - `playtest_14`
- verify Red fallback, interceptor guidance split, telemetry spoof behavior, and environment anomalies in browser
- verify the throttled playback still preserves major events clearly

### P2

- design and scope true sensor slew/traverse behavior
- design and scope true effector heading / FOV / slew behavior
- decide whether the first implementation slice lands this sprint or becomes the next sprint's lead task

## Planned Work Sequence

### Monday

- review current TODO and known issue list
- smoke the editable dev build and the built artifact
- verify draft staging, import flow, and run flow with:
  - demo scenario
  - `New_Test_scenario.json`

### Tuesday

- reproduce and close any remaining authoring/run-loop defects
- inspect DOM and in-memory state during:
  - scenario import
  - scenario staging
  - run launch
  - report handoff

### Wednesday

- rerun the focused playtest subset in browser
- classify failures into:
  - kernel behavior
  - scenario tuning
  - expectation drift
- update playtest notes as evidence accumulates

### Thursday

- tackle the top confirmed behavior gap from Wednesday
- define the orientation/slew implementation boundary
- if feasible, implement the first sensor-side orientation slice

### Friday

- run final browser verification
- verify GitHub Pages deployment output
- update README, TODO, and any playtest documentation touched during the sprint
- prepare the next sprint handoff

## Acceptance Criteria

### Scenario Workflow

- importing a scenario updates the draft scenario immediately
- `Stage Current Scenario` replaces the active run scenario
- `Run Scenario` uses the staged scenario, not stale demo state
- report views reflect the most recent completed run

### Performance And Stability

- no browser freeze in the current dense multisensor test case
- per-sensor same-tick scan dedup is verified in browser traces
- cued sensors do not continue routine scans during their busy window
- throttled playback still shows major events and completes cleanly

### Playtests

- the focused playtest subset is rerun
- each failure has a documented disposition:
  - code fix required
  - scenario fix required
  - expected result update required

### Deployment

- `npm run build` succeeds
- GitHub Pages serves the latest `dist/index.html`
- deployed artifact matches the verified local built artifact closely enough for hands-on test use

## Test Matrix

### Core UI Flow

- load demo scenario
- edit draft scenario
- stage current scenario
- run single scenario
- review reports

### Import Flow

- import `Docs/PlaytestResults/260623/New_Test_scenario.json`
- confirm draft metadata updates
- confirm staged active scenario updates after staging
- confirm the run uses the imported scenario

### Performance Flow

- run dense sensor scenario with playback enabled
- run dense sensor scenario with frame capture disabled where relevant
- inspect event-feed and frame-count behavior

### Focused Playtests

- `playtest_03_tewa_priority`
- `playtest_05_stateful_assessment`
- `playtest_07_terrain_noise_penalty`
- `playtest_08_ew_network_degradation`
- `playtest_10_red_fallback_behavior`
- `playtest_12_multispectrum_detection`
- `playtest_14_spoofer_meaconing`

## Risks

- browser-only issues may still differ between local preview and GitHub Pages
- orientation/slew work can expand quickly if sensor and effector behavior are tackled together
- `src/` review-tree drift can distract from live-shell stabilization if allowed to become a parallel refactor target this week

## Definition Of Done

This sprint is done when:

- the current UI supports reliable scenario authoring, staging, running, and review
- the recent performance controls are confirmed in browser behavior
- the focused playtest subset has been rerun and triaged
- GitHub Pages serves the current verified build
- the next sprint can start from confirmed orientation/slew requirements instead of unresolved shell-state instability
