# Simulation_Design.md

# Counter-small UAS Monte Carlo Discrete Event Simulation

## To Add
- Formal equations section (all equations in one place with variable definitions).
- Assumptions and limitations section (what is intentionally abstracted).
- Validation benchmark scenarios (single drone, swarm attack, EW attack, power-grid attack, etc.).
- Sequence diagrams for Detect → Track → Classify → Identify → Engage and EW/Spoofing workflows.
- Define detection != track, detection becomes a detection canidate then track classification, then track
- classification != identification
- Intent is an predection not an objective observation
- expand red doctrine to include more mission parameters and objectives. 
    - Target prioritization
    - UAS allocation
    - Decoy allocation
    - EW allocation
    - Risk tolerance
    - Swarm coordination
- Add environment is an active participant, it genarates objects, noise, and clutter
- Add Monte Carlo variation sources
- Add success criteria
    - Results are repeatable with fixed seeds.
    - Results are explainable through event logs.
    - Small parameter changes produce reasonable outcome changes.
    - Subject matter experts recognize behaviors as plausible.
    - Monte Carlo distributions converge with sufficient iterations.
## Simulation Design Document

# 1. Purpose

This simulation models the interaction between Blue C-sUAS forces, Red UAS threats, the environment, and the information systems that connect them.

The purpose of the simulation is to support:

-Primary Features 
    - Course of Action Analysis
    - Capability and Resource Allocation Analysis
    - Educational and Research Activities
- Future and Expanded Features
    - Mission Engineering
    -Force Design Analysis
    - Acquisition Trade Studies
    - Sensor Trade Studies
    - Effector Trade Studies
    - EW Trade Studies

The simulation prioritizes explainability and local execution over maximum fidelity.

Every outcome should be traceable to:
- Events
- Tracks
- Decisions
- Effects

# 2. Design Objectives

Primary Objectives:

1. Rapid scenario generation
2. Browser-only execution
3. Offline operation
4. Monte Carlo analysis
5. Explainable outcomes
6. Side-agnostic architecture

Secondary Objectives:

1. Educational use
2. Research support
3. Concept exploration
4. Force structure experimentation

# 3. System Constraints

## Browser Execution

The simulation shall execute entirely within a web browser.

Requirements:

- Single page application
- No backend dependency
- No external databases
- No cloud services
- No required installation

## Data Storage

Scenario files are stored locally.

Supported mechanisms:

- FileReader API
- JSON files
- Blob downloads

## Headless Execution

Simulation execution is separated from rendering.

Web Workers perform:

- Event processing
- Monte Carlo execution
- Statistical aggregation

Rendering shall not affect outcomes.

# 4. Modeling Philosophy

## Discrete Event Simulation

The simulation uses a Discrete Event Simulation (DES) architecture.

Objects do not update continuously.

Instead:

1. Objects schedule future actions.
2. Actions generate events.
3. Events enter the event queue.
4. Events execute chronologically.

Simulation time advances from event to event.

Advantages:

- Computational efficiency
- Large Monte Carlo batches
- Deterministic ordering
- Reduced idle processing

## Side Agnostic Design

Blue and Red use the same architectural framework.

Both sides may possess:

- Sensors
- Effectors
- C2
- EW
- Decoys
- Interceptors
- UAS

No side receives privileged information.

## Separation of Reality and Perception

The simulation separates:

Physical Reality

from

Observed Reality

A track is not proof that an object exists.

This distinction enables:

- False alarms
- Ghost tracks
- Spoofing
- Misidentification
- Fratricide

# 5. Simulation Layers

Physical Layer
↓
Detection Layer
↓
Track Layer
↓
Classification Layer
↓
Identification Layer
↓
Intent Layer
↓
C2 Layer
↓
Effects Layer
↓
Damage Layer
↓
Reporting Layer

# 6. Kill Chain Philosophy

The simulation models the modern sensor-to-shooter chain.

1. Detect
2. Track
3. Classify
4. Identify
5. Determine Intent
6. Decide
7. Engage
8. Assess

Each stage introduces:

- Latency
- Capacity limits
- Uncertainty

Failure at any stage may prevent engagement.

# 7. Fog of War Philosophy

The simulation intentionally models uncertainty.

Sources include:

- Detection failures
- Classification failures
- Identification failures
- Intent errors
- Ghost tracks
- Spoofed tracks
- Human latency
- Sensor saturation
- Track capacity limits
- Communication latency

Perfect information is prohibited.

# 8. Detection Modeling

Detection is probabilistic.

Detection depends upon:

- Range
- Signature
- Sensor characteristics
- Terrain
- Weather
- Clutter
- Noise
- Electronic attack

## Distance

Three dimensional distance:

d = sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2)

## Field of View

Targets must fall within:

- Horizontal FOV
- Vertical FOV

to be detectable.

## Line of Sight

Terrain may:

- Block
- Degrade
- Ignore

signals depending on sensor type.

## Signal Propagation

Inverse square approximation:

Signal_Strength ∝ 1 / d^2

## Detection Threshold

Detection occurs when:

Signal_Strength > Noise_Floor + Threshold

# 9. Classification Modeling

Classification answers:

"What is it?"

Examples:

- UAS
- Bird
- Balloon
- Missile
- Ground Clutter
- Decoy

Classification produces:

- Result
- Confidence

Classification may generate:

- False Positives
- False Negatives

# 10. Identification Modeling

Identification answers:

"Whose is it?"

Possible states:

- Friendly
- Hostile
- Neutral
- Unknown
- Suspect

Identification occurs after classification.

# 11. Intent Assessment

Intent answers:

"What is it doing?"

Possible intents:

- Transit
- Recon
- Loiter
- Jamming
- Attack Run
- Terminal Dive

Intent is inferred from behavior.

Intent is never directly known.

# 12. Ghost Tracks and False Alarms

Ghost tracks are tracks without physical objects.

Sources:

- Weather
- RF noise
- Sensor artifacts
- Terrain effects
- EW effects

Ghost tracks consume:

- Sensor resources
- C2 capacity
- Operator attention

# 13. Electronic Warfare Modeling

Supported effects include:

- Noise Jamming
- Deception Jamming
- GPS Denial
- GPS Spoofing
- Network Disruption
- Camera Dazzling
- Sensor Degradation
- Track Injection

## Effective Probability of Effect

Effective_Pe =
BaseEffectiveness
× RangeFactor
× EnvironmentFactor
× TargetResistanceFactor

Possible outcomes:

- No Effect
- Track Drop
- Track Spoof
- Sensor Degraded
- Sensor Blinded
- Camera Dazzled
- Network Jammed
- Network Severed

# 14. Red Force Philosophy

Red forces are modeled identically to Blue.

Red may:

- Detect Blue
- Classify Blue
- Identify Blue
- Jam Blue
- Spoof Blue
- Attack Blue

Red may employ doctrine such as:

- Saturation Attack
    - Local Saturation (Mass)
    - Distributed Saturation (Economy of Force)
- Recon Then Strike
- Decoy First
- Sensor Suppression
- HQ Attack
- Power Attack

# 15. Environment Modeling

Environment is an active participant.

Components:

- Terrain
- Weather
- Spectrum Environment
- Clutter Fields

## Clutter Types

- Birds
- Balloons
- Weather
- Urban RF
- Foliage
- Ground Traffic
- Thermal Noise

Clutter may generate:

- Physical Objects
- Ghost Tracks

# 16. Spectrum Environment

The RF environment is modeled globally.

Variables:

- Base Noise
- Congestion
- Blue Jamming
- Red Jamming
- GPS Availability
- Communications Availability

The spectrum environment affects:

- Sensors
- C2
- FPV Links
- EW Systems

# 17. Mathematical Foundations

## Gaussian Noise

The simulation uses Gaussian noise.

## Box-Muller Transform

Uniform random numbers are converted into normally distributed values.

z = sqrt(-2 ln(U1)) × cos(2πU2)

Used for:

- Detection variation
- Classification variation
- EW variation
- Human latency variation

## Effective Probability of Kill

Effective_Pk =
BasePk
× RangeFactor
× LOSFactor
× EnvironmentFactor
× TargetModifier

## Secondary Explosions

Destroyed systems may generate area effects.

Secondary effects may:

- Damage nearby systems
- Destroy nearby systems
- Trigger additional explosions

# 18. Event Processing Philosophy

Events execute chronologically.

Same-time events follow priority order:

1. State Changes and Recovery
2. Sensor Actions
3. Track Generation
4. C2 Decisions
5. Movement
6. Effector Actions
7. Effect Resolution
8. Damage Resolution
9. Logging

This ensures deterministic outcomes.

# 19. Monte Carlo Methodology

Each iteration:

1. Clone baseline scenario
2. Apply variance
3. Execute simulation
4. Record results

Variance may affect:

- Weather
- Noise
- Clutter density
- Classification accuracy
- Identification accuracy
- EW effectiveness
- Human latency

Outputs become distributions rather than single outcomes.

# 20. Reporting Philosophy

The purpose of the simulation is insight generation.

Metrics include:

- Mission Success
- Asset Survivability
- Detection Rate
- Classification Accuracy
- Identification Accuracy
- Engagement Success
- Fratricide Events
- Ghost Tracks
- Spoofed Tracks
- EW Effectiveness
- Sensor Utilization
- C2 Workload

# 21. Validation Philosophy

Validation occurs at multiple levels.

Unit Validation:
- Individual formulas

System Validation:
- Detection
- Tracking
- Engagement

Scenario Validation:
- Expected tactical outcomes

Explainability Requirement:

Every major outcome must be reconstructable from:

- Event logs
- Track history
- Decision history
- Effect history

The simulation prioritizes explainable behavior over black-box behavior.
