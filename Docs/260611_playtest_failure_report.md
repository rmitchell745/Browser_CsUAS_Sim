# 260611 Playtest Failure Report

## Scope

This report reviews the seeded headless playtest sweep run on June 11, 2026 against the current `master` build after the startup regression fix.

Sweep status:
- Passed: `playtest_01`, `02`, `04`, `06`, `09`, `11`, `13`, `15`
- Failed: `playtest_03`, `05`, `07`, `08`, `10`, `12`, `14`

Method:
- Headless Playwright against `http://127.0.0.1:8000/index.html`
- Scenario loaded through `window.appController`
- Fixed seed `12345`
- Failure review performed against runtime logs, scenario JSON, and the current `index.html` code paths

## Summary

The failures split into two categories:

1. Model / scenario behavior gaps
- `playtest_07`
- `playtest_08`
- `playtest_10`

2. Logging / assertion mismatch rather than core sim failure
- `playtest_03`
- `playtest_05`
- `playtest_12`
- `playtest_14`

## Detailed Review

### `playtest_03_tewa_priority.json`

Classification:
- Logging / assertion mismatch

Observed behavior:
- The first C2 order log message is `Blue TEWA Node 01 ordered engagement against Track-1`.
- In the same run, `Track-1` is the heavy bomber path. The earlier detection / intent logs show `Track-1` attached to `Red Heavy Bomber 01`, and the first intent assessment projects `Blue-HQ-Bunker-01`.

Relevant code:
- TEWA order logging only writes the track ID into the human-readable message: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5653)
- The richer target metadata is present in the log payload, including `targetId` and `projectedAssetId`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5659)
- Scenario targets involved: [playtest_03_tewa_priority.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_03_tewa_priority.json:192), [playtest_03_tewa_priority.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_03_tewa_priority.json:214)

Assessment:
- This does not currently look like a TEWA prioritization bug.
- It looks like the test and debrief expectation want object identity in the readable message, while the code only exposes that identity in `data.targetId`.

Recommended action:
- Update the `ordered engagement` log message to include the target object name, or update the test to inspect `data.targetId` / `data.projectedAssetId` instead of only message text.

### `playtest_05_stateful_assessment.json`

Classification:
- Logging / assertion mismatch

Observed behavior:
- The run produces `assessmentSnapshots`.
- Snapshots do show `classification` and `identification` skip behavior, but the skip data lives under `snapshot.stages`, not at the top level.

Relevant code:
- Snapshots are recorded in `recordAssessmentSnapshot()`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:3503)
- Classification skip decisions are recorded here: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5012)
- Identification skip decisions are recorded here: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5159)
- Scenario intentionally disables firing with `ammoCapacity: 0`: [playtest_05_stateful_assessment.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_05_stateful_assessment.json:82)

Assessment:
- The sim behavior appears consistent with the scenario intent.
- The failure came from checking the wrong snapshot shape. The actual structure is:
  - `snapshot.stages.classification.action`
  - `snapshot.stages.identification.action`
  - `snapshot.stages.intent.action`

Recommended action:
- Treat this as a test-harness fix, not a simulation change.

### `playtest_07_terrain_noise_penalty.json`

Classification:
- Scenario / model semantics mismatch

Observed behavior:
- No detections occur.
- `firstDetectionTimeSec` remains `null`.

Relevant code:
- Scenario uses sensor type `"RF"`, which normalizes to passive RF, not active radar: [playtest_07_terrain_noise_penalty.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_07_terrain_noise_penalty.json:50), [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:2180)
- Passive RF detection returns immediately if the target is `radioSilent`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:3000), [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4723)
- The Red noise-runner template has no capability block asserting RF use and no `rfEmissionDb` signature field in the scenario.

Assessment:
- This failure does not point to a terrain-noise algorithm break first.
- The scenario is currently set up like a passive RF detection test against a target that the model treats as radio-silent.
- If the intended test was active RF / radar clutter, the Blue sensor should be `Radar`, not `RF`/`RF_Passive`.

Recommended action:
- Decide which behavior is intended:
  - If the test is passive RF, add Red RF emissions and `usesRF: true`.
  - If the test is active RF clutter, change the Blue sensor to `Radar`.

### `playtest_08_ew_network_degradation.json`

Classification:
- Model / tuning gap

Observed behavior:
- `ewEvents = 1`
- `networkJamEvents = 0`
- The jammer activates once, but the network jam never lands.

Relevant code:
- Non-kinetic effect probability is heavily reduced by range and resilience: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5748)
- `ewEvents` increments on resolve even when the effect misses: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:6053)
- `networkJamEvents` only increments on a successful hit path: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:6148)
- Success logging for jam only happens after a hit: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:6088), [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:6153)
- The test jammer is `basePe: 0.92`, but the Red target also has `commsResilience: 0.15`: [playtest_08_ew_network_degradation.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_08_ew_network_degradation.json:48), [playtest_08_ew_network_degradation.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_08_ew_network_degradation.json:70)
- Red route-follow currently forces `AutonomousFallback` on waypoint motion: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4350)

Assessment:
- This is a real behavior gap.
- Under the fixed seed, the jammer resolves with low enough effective probability to miss.
- After Red is pushed into route-follow fallback, the RF-emission logic can suppress follow-on passive RF sensing and make repeat jam opportunities weak or nonexistent.

Recommended action:
- Raise deterministic hit likelihood for this scenario, or reduce the passive-RF dependency after the first cue.
- More importantly, stop treating all Red waypoint-following as automatic fallback, because that changes RF emission and control state too early.

### `playtest_10_red_fallback_behavior.json`

Classification:
- Model behavior bug

Observed behavior:
- Both Red strikers transition into fallback at `t = 0`.
- The autonomy-capable striker immediately goes `HeuristicFallback` rather than first operating in a clean C2-directed state.

Relevant code:
- Red waypoint route-follow forces `AutonomousFallback`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4350)
- Red no-waypoint mission handling falls straight into heuristic targeting and forces `HeuristicFallback`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4378)
- Red C2 target assignment happens later in the C2 system: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:5540)
- The scenario explicitly distinguishes the two striker types by autonomy: [playtest_10_red_fallback_behavior.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_10_red_fallback_behavior.json:120), [playtest_10_red_fallback_behavior.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_10_red_fallback_behavior.json:144)

Assessment:
- This is the clearest real sim bug in the current failure set.
- Movement fallback is running before Red C2 has a chance to establish `C2Directed` control.
- That inverts the intended control hierarchy for Red:
  - expected: `C2Directed` first, fallback only on loss
  - current: fallback first, C2 only opportunistically later

Recommended action:
- Gate Red fallback transitions behind actual C2/network loss.
- For Red strikers with `requiresC2`, do not switch to `AutonomousFallback` or `HeuristicFallback` solely because they currently lack mission waypoints or have not yet been tasked.

### `playtest_12_multispectrum_detection.json`

Classification:
- Logging / debrief mismatch

Observed behavior:
- The model does produce acoustic detections and passive RF detections.
- The passive RF site does not detect `Red Silent 01`, which is the intended behavior.
- The failure comes from the current log shape being too generic to support the documented human-readable assertion.

Relevant code:
- Acoustic and RF passive branches are distinct in sensing logic: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:2983), [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4718)
- The log payload only exposes a generic `sensorMode` of `"em"` for all non-optical sensors: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4766)
- Detection messages use the observer host name, not the sensor name: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4754)
- Scenario sensor names are explicit: [playtest_12_multispectrum_detection.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_12_multispectrum_detection.json:56), [playtest_12_multispectrum_detection.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_12_multispectrum_detection.json:84)
- Scenario RF capabilities also correctly distinguish the emitter from the silent drone: [playtest_12_multispectrum_detection.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_12_multispectrum_detection.json:110), [playtest_12_multispectrum_detection.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_12_multispectrum_detection.json:123)

Assessment:
- The multispectrum model looks mostly correct in this run.
- The problem is observability: the event log does not make acoustic vs passive RF contributions explicit enough for the playtest plan.

Recommended action:
- Add `sensorName` and `sensorType` to detection logs, and consider replacing generic `sensorMode: "em"` with explicit family labels such as `radar`, `rf-passive`, and `acoustic`.

### `playtest_14_spoofer_meaconing.json`

Classification:
- Logging / assertion mismatch, with a secondary control-state concern

Observed behavior:
- The spoofer hit succeeds.
- The event log contains `successfully meaconed`.
- The payload shape is `data.spoofedOffset`, not `data.effect.offset`.

Relevant code:
- Spoofer success payload is logged as `spoofedOffset`: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:6115)
- Spoof clear is logged here: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:3220)
- As in the Red fallback scenarios, the striker can enter fallback before proper C2 direction because movement uses heuristic fallback when no current tasking exists: [index.html](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/index.html:4378)
- Scenario spoofer and target values: [playtest_14_spoofer_meaconing.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_14_spoofer_meaconing.json:45), [playtest_14_spoofer_meaconing.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_14_spoofer_meaconing.json:84), [playtest_14_spoofer_meaconing.json](/C:/Users/ryanm/OneDrive/Documents/CsUAS_MS_2/Docs/Playtest/playtest_14_spoofer_meaconing.json:89)

Assessment:
- The logged spoof event is present, so the core spoofer effect is not missing.
- The current failure is mostly a report/assertion mismatch on payload structure.
- There is also a related model concern: the striker falls into `HeuristicFallback` immediately, which makes the path-deviation test less clean than intended.

Recommended action:
- Update the playtest check to read `data.spoofedOffset`.
- Separately fix Red pre-task fallback behavior so spoof-path analysis starts from a cleaner baseline.

## Priority Order

Recommended implementation order:

1. Fix Red control-state ordering before fallback.
- This addresses the real sim bug behind `playtest_10`.
- It also improves the behavior realism for `playtest_08` and `playtest_14`.

2. Rework `playtest_07` to match the current RF model semantics.
- Decide whether it is an active-radar noise test or a passive-RF emissions test.

3. Tune / harden deterministic jammer success for `playtest_08`.
- Either adjust the scenario values or reduce premature loss of repeat engagement opportunities.

4. Improve log payloads for analyst-facing playtests.
- `ordered engagement` should name the target object, not just the track.
- Detection logs should include `sensorName` and `sensorType`.
- Spoofer logs should either keep `spoofedOffset` and update the plan, or add a stable nested structure and update all non-kinetic effect logs consistently.

5. Fix the test harness expectations for the cases that already behave correctly.
- `playtest_05`
- `playtest_12`
- `playtest_14`

## Bottom Line

Only three of the seven reviewed failures currently look like true simulation or scenario-behavior problems:
- `playtest_07`
- `playtest_08`
- `playtest_10`

The other four are primarily observability or assertion-shape issues:
- `playtest_03`
- `playtest_05`
- `playtest_12`
- `playtest_14`
