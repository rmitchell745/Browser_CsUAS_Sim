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

Produces:

- Tracks

Generated Events:

- Track Created
- Track Updated
- Track Dropped

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

Produces:

- Effects

Generated Events:

- Track Spoofed
- Track Dropped
- Sensor Degraded
- Sensor Blinded
- Camera Dazzled
- Network Jammed

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
