# 260615 Playtest Fix Recommendations

## Summary

The current playtest failures are not schema migration problems. All 15 playtest JSON files still normalize under the current engine.

The failures split into two buckets:
- kernel/doctrine regressions introduced by the current physics and EW model
- playtest expectation or geometry mismatches that should be updated to reflect the new runtime behavior

The recommended path is to fix the kernel where the intended behavior is clearly missing, and update playtest geometry or assertions where the scenario is now too strict, too short, or checking stale details.

## Issue Review

| Playtest | Diagnosis | Recommended Fix |
| --- | --- | --- |
| `playtest_01_baseline_single_kill_chain` | Kernel issue | Tune the baseline kill chain under the new kinematic model. The Blue effector is firing, but the target is surviving. Recheck ballistic lead, interceptor lethality, and baseline geometry so the core kill-chain still closes. |
| `playtest_05_stateful_assessment` | Playtest expectation issue | Keep the kernel as-is and update the playtest expectations. This scenario intentionally has zero ammo, so “no fire” is correct. The assertions should focus on assessment snapshot cadence, not weapon use. |
| `playtest_06_terrain_los_block` | Mixed, mostly scenario tuning | Terrain LOS masking is working, but the run ends before a kill. Either extend the scenario duration or move the threat/defense geometry so the threat can be destroyed after LOS opens. |
| `playtest_07_terrain_noise_penalty` | Kernel issue | The RF noise penalty is suppressing detection too hard. Reduce the effective clutter penalty or loosen the RF detection branch so the scenario shows a delayed detection rather than no detection. |
| `playtest_08_ew_network_degradation` | Kernel + scenario tuning | Jam/restore behavior is not materializing reliably. Recheck jammer activation, C2/network degradation propagation, and scenario range/placement so the jammer actually fires and the network status visibly changes. |
| `playtest_09_child_interceptor_timeout` | Kernel issue | The child-interceptor lifecycle needs a tighter timeout/abort path under current kinematics. Ensure timeouts still resolve as aborts, and verify the scenario is long enough to demonstrate the timeout cleanly. |
| `playtest_10_red_fallback_behavior` | Kernel issue | Red fallback transitions are not occurring as intended. Force `Jammed/Severed` to drive `AutonomousFallback` / `HeuristicFallback` for C2-dependent strikers, and verify the jammer scenario actually breaks Red C2 control. |
| `playtest_12_multispectrum_detection` | Kernel + scenario tuning | Multispectrum detections are too weak or too far. Recheck radar/acoustic/passive-RF branches and, if needed, move the sensors/targets closer or loosen thresholds so all three branches are exercised. |
| `playtest_13_jammer_lost_link_rtb` | Kernel issue | Lost-link RTB is not being triggered from jamming. Ensure the jammer pushes the Red striker into a jammed control mode that the movement system interprets as RTB. |
| `playtest_14_spoofer_meaconing` | Kernel issue | Spoofed navigation offsets are not affecting path enough. Make spoof effects persist through the effect duration and confirm movement consumes the spoofed offset while active. |
| `playtest_15_cyber_telemetry_spoof` | Kernel issue | Telemetry spoof is not materially shifting the track or operator nav path. Apply the telemetry offset to the movement/observed-position path for the effect duration and verify it feeds both Red navigation and Blue track perception. |

## Recommended Fix Order

1. Restore the baseline kill chain in `playtest_01` so the core weapon model remains credible.
2. Fix Red fallback / jammer-driven control transitions in `playtest_08`, `10`, and `13`.
3. Restore spoofing and cyber persistence in `playtest_14` and `15`.
4. Rebalance terrain noise and multispectrum sensing in `playtest_07` and `12`.
5. Tighten the child-interceptor timeout case in `playtest_09`.
6. Update scenario duration or geometry where the behavior is otherwise correct but not yet observable, especially `playtest_05` and `06`.

## Bottom Line

- No playtest JSON schema migration is required.
- Most failures are kernel behavior gaps.
- A smaller subset are playtest expectation or geometry issues that should be updated after the kernel behavior is stabilized.
