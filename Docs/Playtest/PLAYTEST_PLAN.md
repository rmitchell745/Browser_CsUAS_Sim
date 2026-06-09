# C-sUAS Refactor Playtest Plan

This package is designed for the current `index.html` prototype.

Use these files with `Load Scenario JSON`, then run:

1. `Run Scenario`
2. `Run Single Scenario`
3. Review `Run Scenario`, `Single Run Report`, and `Event Log`
4. Run `Monte Carlo` with the suggested count for that scenario
5. Export CSV when noted

## Recommended Order

1. `playtest_01_baseline_single_kill_chain.json`
2. `playtest_02_lock_and_fire_loop.json`
3. `playtest_03_tewa_priority.json`
4. `playtest_04_dynamic_csv_multi_effector.json`
5. `playtest_05_stateful_assessment.json`

## Scenario 1: Baseline Single Kill Chain

File:
`playtest_01_baseline_single_kill_chain.json`

Purpose:
- Confirm the basic detect -> track -> classify -> identify -> intent -> engage -> damage path still works.
- Confirm weighted survival metrics appear in the single-run report and CSV.

Single-run expectations:
- Detection occurs.
- A track is created and identified as hostile.
- Intent resolves to `Attack Run` or `Transit`, depending on timing.
- The Blue site fires and destroys the Red UAS.
- `HQ Survived` is `Yes`.
- `Weighted survival score` remains `1`.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- No console/runtime errors.
- Single-run finishes cleanly.
- CSV row contains `HQ_Survived`, `Percent_Survived`, and `Weighted_Survival_Score`.

## Scenario 2: Target Lock And Autonomous Fire Loop

File:
`playtest_02_lock_and_fire_loop.json`

Purpose:
- Verify one effector does not engage multiple targets simultaneously.
- Verify the effector stays committed through cooldown and refires locally without waiting for a fresh sensor cycle.

Single-run expectations:
- Two Red UAS enter the defended area.
- The Blue site commits to one target first.
- The event log shows repeated `fired` entries against the same locked target before the second threat is serviced.
- `Shots fired` is greater than `1`.
- The second target is not engaged until the first lock breaks or the first target is destroyed.

Monte Carlo suggestion:
- 15 iterations

Pass criteria:
- No alternating fire between both Red tracks while one lock is active.
- Repeated shots occur with approximately cooldown spacing.

## Scenario 3: TEWA Priority Check

File:
`playtest_03_tewa_priority.json`

Purpose:
- Verify TEWA prefers the heavier, faster HQ-directed threat over the lower-value water-tank threat.

Single-run expectations:
- Both Red tracks are detected and identified before either enters weapon range.
- The first `ordered engagement` log entry should target the heavy bomber track, not the ISR track.
- The log entry should include `threatScore`, `estimatedPayloadScore`, and `projectedAssetId`.
- The projected target for the heavy bomber should be the HQ bunker.

Monte Carlo suggestion:
- 20 iterations

Pass criteria:
- First engagement order is against the HQ-directed bomber.
- The report completes without C2 state or effector-lock anomalies.

## Scenario 4: Dynamic Ammo CSV

File:
`playtest_04_dynamic_csv_multi_effector.json`

Purpose:
- Verify Monte Carlo CSV export creates one ammo column per firing Blue template instead of a hardcoded single-template field.

Single-run expectations:
- North site engages the north threat.
- South site engages the south threat.
- Both Blue templates expend ammo.

Monte Carlo suggestion:
- 10 iterations

Export check:
- Export Monte Carlo CSV.
- Confirm columns include:
  - `Template_Blue_Kinetic_North_Ammo_Expended`
  - `Template_Blue_Kinetic_South_Ammo_Expended`

Pass criteria:
- Both ammo columns are present.
- Values are numeric and non-empty for runs where each site fires.

## Scenario 5: Stateful Assessment Hold

File:
`playtest_05_stateful_assessment.json`

Purpose:
- Verify classification, identification, and intent no longer rerun on every scan during a stable single-track hold.
- Verify compact assessment snapshots preserve per-cycle refresh/skip visibility for debugging.

Single-run expectations:
- The Red UAS remains continuously tracked.
- Event log still shows the initial detect -> classify -> identify -> intent chain, but it should be less chatty afterward.
- The Blue site does not fire because the effector ammo is intentionally `0`.
- The single-run report JSON should include `assessmentSnapshots`.
- Within those snapshots, classification and identification should show a mix of `refreshed` then `skipped` actions.
- Intent should hold steady as `Attack Run` between refreshes until a stale refresh or a meaningful motion/threat change occurs.

Monte Carlo suggestion:
- Skip Monte Carlo for this scenario unless you are specifically checking for deterministic gating behavior across seeds.

Pass criteria:
- Track maintenance continues while at least some classification, identification, and intent cycles are marked `skipped`.
- No runtime errors occur when `assessmentSnapshots` grows during the run.
- The retained intent does not prevent TEWA or C2 from keeping current threat geometry in the report data.

## Notes For Review

- The TEWA payload estimate is heuristic by design. Review it from the event log, not as ground truth.
- `Ghost` and `Clutter` placeholders are not part of this playtest set because the current work focused on engagement, prioritization, and reporting.
- If a scenario behaves unexpectedly, export the event log JSON immediately after the run so the exact event ordering is preserved.
- The event log is now intentionally quieter than the raw assessment cadence. Use the report JSON `assessmentSnapshots` payload when you need the retained per-cycle refresh/skip picture.
