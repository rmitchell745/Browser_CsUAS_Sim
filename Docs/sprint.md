# Sprint Plan

## Week Of 29 Jun 2026

## Sprint Theme

Stabilize the core author-build-run-review loop in the Vite shell while landing and verifying the first interaction-model slice: sensor slew, route editing, engagement playback visuals, and report-side analysis.

## Primary Objective

By the end of this sprint, the team should be able to:

- edit a draft scenario in `Scenario Editor`
- stage it into the active run scenario
- run it from `Run Scenario` without browser stalls
- review it in `View Reports`
- edit multi-waypoint routes directly in the UI
- see active engagements on playback without relying only on text logs
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

### 3. Orientation / Slew Delivery And Verification

- verify the landed first-pass sensor traverse / slew behavior in browser
- confirm authored `slewRateDps` values are usable for narrow-FOV sensors
- define the follow-on slice for:
  - host-relative sensor mounting
  - effector heading / engagement arc constraints

### 4. Playback And Analysis Clarity

- verify the new playback overlays for:
  - ballistic tracers
  - directed-energy beams
  - EW sector pulses
- confirm the new `AnalysisEngine` is producing the expected report summaries
- move any duplicated report-derived logic behind the new analysis layer where safe

### 5. Build And Deployment Confidence

- verify the GitHub Pages Actions deployment serves the current `dist/index.html`
- verify no bundle-only drift exists between editable source and deployed artifact
- keep `index_base.html`, `screens/`, `style.css`, and `main.js` as the authoritative editable app source

## In Scope

- scenario editor state and run-path fixes
- browser-based verification of the current UI shell
- focused playtest reruns and result notes
- first-pass sensor slew verification and follow-on orientation planning
- multi-waypoint editing verification
- playback visual verification
- report-analysis integration
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

- tune authored sensor slew values and define host-relative mount behavior
- design and scope true effector heading / FOV / slew enforcement
- decide whether deeper effector arc constraints land this sprint or become the next sprint's lead task

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
- tune the first-pass slew / playback / route-edit behavior based on the browser pass
- define the next orientation and effector-arc implementation boundary

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
- route edits survive draft save, stage, run, and export

### Performance And Stability

- no browser freeze in the current dense multisensor test case
- per-sensor same-tick scan dedup is verified in browser traces
- cued sensors do not continue routine scans during their busy window
- throttled playback still shows major events and completes cleanly
- narrow-FOV sensors visibly slew instead of instant-snapping in the authored verification scenario

### Interaction And Debrief Clarity

- waypoint editing supports add / insert / delete / move on map without route corruption
- playback shows engagement state through tracers, beams, or sector pulses
- report summaries remain consistent after the `AnalysisEngine` cutover

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

### Interaction Flow

- author a multi-waypoint Red route in `Scenario Editor`
- author a narrow-FOV sensor with non-default `slewRateDps`
- confirm playback visuals appear during ballistic, DEW, and EW engagements

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
- sensor slew may be stable while effector arc constraints still lag behind, creating mixed orientation behavior during testing
- `src/` review-tree drift can distract from live-shell stabilization if allowed to become a parallel refactor target this week

## Definition Of Done

This sprint is done when:

- the current UI supports reliable scenario authoring, staging, running, and review
- the new route editor and engagement visuals are usable in the browser, not just present in code
- the recent performance controls are confirmed in browser behavior
- first-pass sensor slew is verified and the remaining host-mount / effector-arc follow-up is clearly defined
- the focused playtest subset has been rerun and triaged
- GitHub Pages serves the current verified build
- the next sprint can start from confirmed orientation/slew requirements instead of unresolved shell-state instability
