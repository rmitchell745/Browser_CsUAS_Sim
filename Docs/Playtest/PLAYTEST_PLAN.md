# C-sUAS Refactor Playtest Plan

This package is designed for the current `index.html` prototype.

Use these files with `Load Scenario JSON`, then run:

1. `Run Scenario`
2. `Run Single Scenario`
3. Review `Run Scenario`, `Single Run Report`, and `Event Log`
4. Run `Monte Carlo` where noted
5. Export CSV when noted

## Recommended Order

1. `playtest_01_baseline_single_kill_chain.json`
2. `playtest_02_lock_and_fire_loop.json`
3. `playtest_03_tewa_priority.json`
4. `playtest_04_dynamic_csv_multi_effector.json`
5. `playtest_05_stateful_assessment.json`
6. `playtest_06_terrain_los_block.json`
7. `playtest_07_terrain_noise_penalty.json`
8. `playtest_08_ew_network_degradation.json`
9. `playtest_09_child_interceptor_timeout.json`
10. `playtest_10_red_fallback_behavior.json`
11. `playtest_11_owa_terminal_impact.json`

## Scenario 1: Baseline Single Kill Chain

File:
`playtest_01_baseline_single_kill_chain.json`

Purpose:
- Confirm the basic detect -> track -> classify -> identify -> intent -> engage -> child-interceptor kill path.
- Confirm weighted survival metrics appear in the single-run report and CSV.

Single-run expectations:
- Detection occurs.
- A track is created and identified as hostile.
- The event log shows hostile intent assessment before engagement.
- The Blue site fires and destroys the Red UAS.
- `HQ Survived` is `Yes`.
- `Weighted survival score` remains `1`.
- The final report intent may settle back to `Loiter` after the threat is neutralized; review pre-kill intent from the log if needed.

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
- The event log shows repeated child-interceptor launches against the same locked target before the second threat is serviced.
- `Shots fired` is greater than `1`.
- The second target is not engaged until the first target is destroyed or the first lock breaks.

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
- Confirm columns include `Template_Blue_Kinetic_North_Ammo_Expended` and `Template_Blue_Kinetic_South_Ammo_Expended`.

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
- The single-run report JSON includes `assessmentSnapshots`.
- Classification and identification snapshots show a mix of `refreshed` then `skipped` actions.

Monte Carlo suggestion:
- Skip Monte Carlo unless you are specifically checking deterministic gating behavior across seeds.

Pass criteria:
- Track maintenance continues while at least some classification, identification, and intent cycles are marked `skipped`.
- No runtime errors occur when `assessmentSnapshots` grows during the run.

## Scenario 6: Terrain LOS Block

File:
`playtest_06_terrain_los_block.json`

Purpose:
- Verify a blocking terrain polygon masks LOS without forcing route collision.
- Verify detection and engagement are delayed until the threat clears the ridge line.

Single-run expectations:
- No detection occurs while the Red UAS is masked behind the ridge.
- First detection is delayed well past the scenario start.
- No terrain collision is recorded.
- The Blue site eventually engages and destroys the Red UAS once LOS opens.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `firstDetectionTimeSec` is materially delayed from time `0`.
- `terrainCollisions` remains `0`.
- Engagement occurs only after the target clears the blocking terrain.

## Scenario 7: Terrain Noise Penalty

File:
`playtest_07_terrain_noise_penalty.json`

Purpose:
- Verify a `Noise` terrain polygon can suppress or delay RF detection without blocking geometry outright.

Single-run expectations:
- The Blue RF site eventually detects the Red UAS.
- Detection is materially delayed by the clutter field.
- Detection log entries show `sensorMode = "em"`.
- No engagement occurs in this stripped-down sensing scenario.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `firstDetectionTimeSec` is significantly later than an equivalent clear-air RF case.
- The event log shows RF detection only after geometry improves through the clutter field.

## Scenario 8: EW Network Degradation

File:
`playtest_08_ew_network_degradation.json`

Purpose:
- Verify EW effectors can degrade the hidden side-level network and generate visible jam/restore events.

Single-run expectations:
- The Blue EW site detects and tracks the Red target.
- The jammer activates at least once.
- The event log shows `Red network jammed by EW`.
- The event log later shows `Red network restored`.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `ewEvents` is greater than `0`.
- `networkJamEvents` is greater than `0`.
- No kinetic child-interceptor activity is required for success in this scenario.

## Scenario 9: Child Interceptor Timeout

File:
`playtest_09_child_interceptor_timeout.json`

Purpose:
- Verify child interceptors are spawned runtime objects and can abort on timeout instead of resolving as direct-fire hits.

Single-run expectations:
- Detection, track creation, and engagement occur.
- A child interceptor launches.
- The interceptor times out before intercept.
- The Red UAS survives.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `interceptorLaunches` is greater than `0`.
- `interceptorAborts` is greater than `0`.
- The event log includes a timeout message rather than a direct hit resolution.

## Scenario 10: Red Fallback Behavior

File:
`playtest_10_red_fallback_behavior.json`

Purpose:
- Verify Red can operate through C2-directed behavior, then transition into explicit fallback modes when EW jams the hidden Red network.

Single-run expectations:
- The Red C2 node detects Blue assets and briefly directs both Red strikers.
- Blue EW jamming degrades the Red network.
- The autonomy-capable Red striker transitions to `AutonomousFallback`.
- The non-autonomous Red striker transitions to `HeuristicFallback`.
- Once the Red network restores, Red C2 can resume direction.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `networkJamEvents` is greater than `0`.
- `fallbackTransitions` is greater than `0`.
- The event log contains both `AutonomousFallback` and `HeuristicFallback` transition entries driven by `network-jammed`.

## Scenario 11: OWA Terminal Impact

File:
`playtest_11_owa_terminal_impact.json`

Purpose:
- Verify a Red one-way attack drone can complete an attack run, damage a Blue asset on impact, and expend itself on strike.

Single-run expectations:
- Blue detects and tracks the Red OWA drone but has no effector to defeat it.
- The Red OWA drone reaches the Blue HQ and executes terminal impact.
- The event log shows `executed terminal impact`, `impacted`, and `was expended on impact`.
- The Blue HQ is destroyed.
- `HQ Survived` becomes `No`.
- `Successful strikes` is greater than `0`.

Monte Carlo suggestion:
- 10 iterations

Pass criteria:
- `successfulStrikes` is greater than `0`.
- `blueAssetsDestroyed` is greater than `0`.
- `weightedSurvivalScore` drops below `1`.
- The event log shows `sourceMode = "owa-impact"` on the Blue asset destruction record.

## Notes For Review

- The TEWA payload estimate remains heuristic. Review it from the event log, not as ground truth.
- Terrain authoring is still first-pass polygon capture only; there is no rerouting or pathfinding.
- OWA payloads are currently authored through JSON fields on `components.payload`, not through a dedicated UI form.
- The event log is quieter than raw assessment cadence. Use report JSON `assessmentSnapshots` when you need retained per-cycle refresh/skip detail.
- If a scenario behaves unexpectedly, export the event log JSON immediately after the run so the exact event ordering is preserved.
