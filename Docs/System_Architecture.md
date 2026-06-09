# System_Architecture.md

# Counter-small UAS Monte Carlo Discrete Event Simulation
## System Architecture

# 1. Purpose

This document defines the software systems responsible for processing simulation data.

Data structures are defined in Data_Model.md.

Modeling assumptions are defined in Simulation_Design.md.

This document answers:

- Which systems exist?
- What data do they consume?
- What outputs do they generate?
- What events do they create?
- How do systems interact?

---

# 2. Architectural Philosophy

The simulation uses a Component-System Architecture.

Components contain data.

Systems contain behavior.

Objects do not contain significant business logic.

Benefits:

- Reduced code duplication
- Easier testing
- Easier expansion
- Side-agnostic behavior
- Prevention of God classes

---

# 3. High Level Execution Flow

SimulationManager
    ↓
EventManager
    ↓
System Execution
    ↓
Event Creation
    ↓
Event Queue
    ↓
System Execution

The simulation advances from event to event.

---

# 4. SimulationManager

Purpose:

Coordinates simulation execution.

Responsibilities:

- Load scenario
- Instantiate objects
- Instantiate systems
- Initialize event queue
- Start simulation
- End simulation
- Manage Monte Carlo runs

Inputs:

- Scenario data

Outputs:

- Completed simulation results

The SimulationManager should contain minimal business logic.

---

# 5. EventManager

Purpose:

Maintain deterministic event execution.

Responsibilities:

- Event scheduling
- Event ordering
- Event execution
- Event expiration

Inputs:

- Generated events

Outputs:

- Ordered execution queue

Priority Order:

1. State Changes and Recovery
2. Sensor Actions
3. Track Generation
4. C2 Decisions
5. Movement
6. Effector Actions
7. Effect Resolution
8. Damage Resolution
9. Logging

---

# 6. MovementSystem

Purpose:

Move physical objects.

Consumes:

- Movement Components
- Mission Components

Produces:

- Updated positions
- Updated velocities

Generated Events:

- Waypoint Reached
- Endurance Depleted
- Terminal Dive Started

---

# 7. EnvironmentSystem

Purpose:

Apply environmental effects.

Consumes:

- Terrain
- Weather
- Clutter Fields
- Spectrum Environment

Produces:

- Environmental modifiers
- Ghost track generation requests
- Clutter object spawns

Generated Events:

- Spawn Ghost Track
- Spawn Clutter Object
- Weather Change

---

# 8. SensorSystem

Purpose:

Generate detection candidates.

Consumes:

- Sensor Components
- Physical Objects
- Environment Data

Processes:

- Range checks
- LOS checks
- FOV checks
- Signal calculations
- Noise calculations

Produces:

- Detection Candidates

Generated Events:

- Detection Candidate Created

Important:

SensorSystem does not create Tracks.

---

# 9. TrackSystem

Purpose:

Convert detections into tracks.

Consumes:

- Detection Candidates
- Existing Tracks

Processes:

- Correlation
- Fusion
- De-duplication
- Aging
- Staleness
- Detection-candidate association into existing track state

Produces:

- Tracks

Generated Events:

- Track Created
- Track Updated
- Track Dropped

Implementation notes:

- Detection and track update are intentionally separate concepts. A sensor may generate a detection candidate every scan, while `TrackSystem` decides whether that observation creates a new track or refreshes an existing one.
- `Track Updated` should be treated as a maintained belief refresh, not automatically as a new classification or identification event.
- Future logging refinement should distinguish same-sensor refresh, new-sensor fusion, and major track-state changes for playtest review.

---

# 10. ClassificationSystem

Purpose:

Determine what a track represents.

Consumes:

- Tracks
- Sensor Information

Produces:

- Classification Updates

Generated Events:

- Track Classified

Implementation notes:

- Classification is stateful in the current prototype and should not rerun on every track refresh.
- Refresh gates should include new sensor contribution, detection-confidence or track-quality shifts, and stale timers.
- When classification is retained, the system should preserve the prior belief and record a compact skip reason for debugging.

Examples:

- UAS
- Bird
- Balloon
- Decoy
- Missile

---

# 11. IdentificationSystem

Purpose:

Determine ownership.

Consumes:

- Classified Tracks

Produces:

- Identification Updates

Generated Events:

- Track Identified

Implementation notes:

- Identification is stateful and should refresh only when classification is strong enough and the current ID is stale, weak, or materially changed by new evidence.
- Identification should not be recomputed simply because the track position refreshed.

Examples:

- Friendly
- Hostile
- Neutral
- Unknown
- Suspect

---

# 12. IntentSystem

Purpose:

Estimate behavior.

Consumes:

- Track History
- Motion Data
- Mission Context
- Blue asset locations

Produces:

- Intent Assessments

Generated Events:

- Intent Updated

Examples:

- Transit
- Recon
- Loiter
- Jamming
- Attack Run
- Terminal Dive

Implementation note:

Intent should be inferred from projected motion against defended Blue assets, not from simple radial closure to the observing sensor.

Additional implementation notes:

- The prototype uses XY-only projected-path association for defended-asset threating, while full 3D geometry remains in place for sensing, range, and time-of-flight.
- Intent is stateful and should refresh only on meaningful motion change, projected-asset change, TEWA hysteresis change, or stale timer expiry.
- `Attack Run` should persist through short ambiguity windows using hysteresis rather than collapsing on a single non-closing update.

---

# 13. C2System

Purpose:

Make decisions.

Consumes:

- Tracks
- Classification
- Identification
- Intent Assessments

Processes:

- Track prioritization
- Threat ranking
- Projected impact / defended-asset association
- C2-side payload estimation from observed size and behavior
- Resource allocation
- Engagement decisions

Produces:

- Commands
- Warnings
- Tasking

Generated Events:

- Engagement Ordered
- Warning Sent
- Sensor Tasked
- Effector Tasked

Implementation note:

C2 should rank active hostile tracks using a weighted TEWA score and commit only Idle effectors. Once committed, an effector remains locked until cooldown/reset logic releases it.

Additional implementation notes:

- Projected defended-asset association should use XY pathing only.
- Elevated threat state should use the same hysteresis continuity as intent so TEWA ordering does not collapse on a single noisy update.
- Payload estimation is a C2-side heuristic derived from observable size/signature and behavior, not a scenario-authored Red field.

---

# 14. NetworkSystem

Purpose:

Model communications.

Consumes:

- Network Components
- Spectrum Environment

Processes:

- Connectivity
- Latency
- Jamming
- Spoofing

Produces:

- Network Status Updates

Generated Events:

- Network Jammed
- Network Restored
- Link Lost

---

# 15. PowerSystem

Purpose:

Model power availability.

Consumes:

- Power Producers
- Power Consumers

Processes:

- Power generation
- Power consumption
- Grid connectivity

Produces:

- Power state updates

Generated Events:

- Power Lost
- Power Restored

---

# 16. EffectSystem

Purpose:

Apply non-damage effects.

Consumes:

- Effector Actions

Processes:

- EW
- Spoofing
- Cyber
- Directed Energy Effects
- Kinetic fire scheduling
- Projectile time-of-flight
- Autonomous cooldown fire loops

Produces:

- Effects

Generated Events:

- Track Spoofed
- Track Dropped
- Sensor Degraded
- Sensor Blinded
- Camera Dazzled
- Network Jammed
- Effector Reset

Implementation note:

Effect resolution should calculate time-of-flight from `projectileSpeed_mps`, preserve effector lock state through cooldown, and allow local autonomous refire when the locked target remains valid.

---

# 17. DamageSystem

Purpose:

Resolve damage.

Consumes:

- Damage Effects

Processes:

- Health reduction
- Destruction
- Secondary explosions

Produces:

- Updated object status

Generated Events:

- Object Destroyed
- Secondary Explosion

---

# 18. LoggingSystem

Purpose:

Capture simulation history.

Consumes:

- All events

Produces:

- Event logs
- Timeline records
- Metrics

The current prototype keeps two complementary debug products:

- a user-facing event log intended to stay readable during playtest
- compact periodic `assessmentSnapshots` stored in the report payload so refresh vs skip behavior can still be inspected after stateful assessment gating is added

Logging should never affect outcomes.

---

# 19. MonteCarloManager

Purpose:

Execute multiple simulation runs.

Responsibilities:

- Clone baseline scenario
- Apply variance
- Execute run
- Aggregate outputs

Produces:

- Statistical distributions
- Confidence intervals
- Aggregate metrics

Aggregate metrics should include dynamic per-template ammo expenditure plus weighted survival reporting such as HQ survival, percent survived, and weighted survival score.

---

# 20. System Interaction Sequence

EnvironmentSystem
    ↓
SensorSystem
    ↓
TrackSystem
    ↓
ClassificationSystem
    ↓
IdentificationSystem
    ↓
IntentSystem
    ↓
C2System
    ↓
NetworkSystem
    ↓
EffectSystem
    ↓
DamageSystem
    ↓
LoggingSystem

This represents the primary information flow.

---

# 21. Future Systems

Potential future additions:

- SwarmSystem
- CyberSystem
- HumanOperatorSystem
- LogisticsSystem
- MaintenanceSystem
- LearningAgentSystem

These systems should follow the same component-system architecture principles.
