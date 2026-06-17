# AGENTS.md

# C-sUAS Monte Carlo Discrete Event Simulation
## Agent Instructions for Codex

This file defines how Codex should work on this repository.

The goal is to build a browser-only Counter-small UAS Monte Carlo Discrete Event Simulation using a clean component-system architecture.

---

# 1. Read These Documents First

Before making code changes, read the current project documents in this order:

1. `docs/Simulation_Design.md`
2. `docs/Data_Model.md`
3. `docs/System_Architecture.md`
4. `docs/UI_Architecture.md`
5. `TODO.md`

If any document is missing, create a short note in `TODO.md` and continue with the available documents.

---

# 2. Core Project Goal

Build a standalone browser-based simulation tool for modeling Blue C-sUAS forces, Red UAS threats, environment effects, tracks, classification, identification, C2 decisions, and effects.

The tool should support:

- Course of Action Analysis
- Capability and Resource Allocation Analysis
- Educational and Research Activities
- Monte Carlo simulation
- Explainable event logs
- Local/offline execution

Future features may include:

- Mission Engineering
- Force Design Analysis
- Acquisition Trade Studies
- Sensor Trade Studies
- Effector Trade Studies
- EW Trade Studies

---

# 3. Hard Technical Constraints

The application must be:

- A single browser-executable application.
- Vanilla HTML, CSS, and JavaScript only.
- No npm.
- No external libraries.
- No CDNs.
- No backend.
- No cloud services.
- No build step required.
- No external fonts.
- No external images unless embedded as base64 or loaded locally by the user.

All CSS and JavaScript should be inline or contained within the single app file unless the user explicitly asks to split files during development.

The final working prototype should open directly in a browser from `index.html`.

---

# 4. Local Data and CUI Constraint

The tool is intended for local analysis.

Do not add:

- External API calls
- Telemetry
- Analytics
- Remote storage
- Automatic uploads
- Third-party integrations

Use browser-native mechanisms only:

- HTML5 FileReader for loading files.
- Blob-generated downloads for saving files.
- Local JSON and CSV export.

---

# 5. Architecture Philosophy

Use a Component-System Architecture.

Components contain data.

Systems contain behavior.

Avoid God classes.

Do not put all logic into:

- `SimulationManager`
- `C2System`
- `Scenario`
- `SimObject`
- `App`

The base object should be small.

Behavior should live in systems such as:

- `EventManager`
- `MovementSystem`
- `EnvironmentSystem`
- `SensorSystem`
- `TrackSystem`
- `ClassificationSystem`
- `IdentificationSystem`
- `IntentSystem`
- `C2System`
- `NetworkSystem`
- `PowerSystem`
- `EffectSystem`
- `DamageSystem`
- `LoggingSystem`
- `MonteCarloManager`

---

# 6. Side-Agnostic Design

Blue and Red should use the same architecture.

Do not hard-code Blue as the only side that can:

- Detect
- Classify
- Identify
- Track
- Jam
- Spoof
- Decide
- Engage
- Report

Red may possess:

- Sensors
- Effectors
- C2
- EW
- Decoys
- Interceptors
- UAS

Use `side` and `roles[]` metadata, but behavior should come from components.

Good:

```js
if (object.components.sensors) {
    // process sensors
}
```

Avoid:

```js
if (object.side === "Blue" && object.role === "Sensor") {
    // only Blue sensors work
}
```

---

# 7. Roles Are Arrays

The project uses:

```js
roles: []
```

not:

```js
role: Enum
```

Objects may have multiple roles.

Examples:

```js
["UAS"]
["UAS", "Sensor"]
["UAS", "Sensor", "Effector"]
["Asset", "Power"]
["Asset", "Sensor", "C2"]
["Asset", "Sensor", "Effector", "C2"]
```

Roles are metadata for UI filtering, validation, and reporting.

Actual behavior comes from attached components.

---

# 8. Separate Reality From Perception

Physical objects are not the same thing as tracks.

Physical objects exist in the simulated world.

Tracks are sensor/C2 beliefs.

A track may represent:

- A real object
- A ghost track
- A spoofed track
- A decoy
- Clutter
- A bird
- A balloon

Do not assume every track has a real object.

Do not assume every real object has a track.

---

# 9. Detection Pipeline

Use this conceptual pipeline:

```text
Physical Object / Environment / Spoof Source
        ↓
Detection Candidate
        ↓
Track Correlation
        ↓
Track
        ↓
Classification
        ↓
Identification
        ↓
Intent Assessment
        ↓
C2 Decision
        ↓
Effect
        ↓
Damage / Status Change
        ↓
Log
```

Sensor systems should generate Detection Candidates.

TrackSystem should create or update Tracks.

SensorSystem should not directly create authoritative tracks unless explicitly routed through TrackSystem.

---

# 10. Classification, Identification, and Intent

Keep these separate.

Classification answers:

```text
What is it?
```

Examples:

- UAS
- Bird
- Balloon
- Ground Clutter
- Decoy
- Missile
- Unknown Air Object

Identification answers:

```text
Whose is it?
```

Examples:

- Friendly
- Hostile
- Neutral
- Suspect
- Unknown

Intent answers:

```text
What is it doing?
```

Examples:

- Transit
- Recon
- Loiter
- Jamming
- Attack Run
- Terminal Dive

Intent is a prediction, not a direct observation.

---

# 11. Ghost Tracks, Clutter, and Spoofing

Environment clutter may create:

1. Physical clutter objects
2. Ghost tracks

Physical clutter becomes an object.

Ghost clutter becomes only a track.

Red spoofing should be modeled as intentional track-only clutter generated by Red effects.

Do not make ghost tracks behave like real UAS.

---

# 12. Event-Driven Simulation

Use a Discrete Event Simulation.

Events are timestamped and processed chronologically.

Same-time event priority:

1. State Changes and Recovery
2. Sensor Actions
3. Track Generation
4. C2 Decisions
5. Movement
6. Effector Actions
7. Effect Resolution
8. Damage Resolution
9. Logging

Enforce a minimum mechanical delay of `0.1` seconds for follow-on state-changing events when a user-specified delay is zero.

This prevents infinite loops at the same timestamp.

---

# 13. Required First Vertical Slice

When building the first working prototype, prioritize this vertical slice:

1. `index.html` opens directly in browser.
2. Canvas renders a simple map.
3. One Blue sensor/effector object exists.
4. One Red UAS object exists.
5. Red UAS moves along waypoints.
6. Event queue runs.
7. Blue sensor detects Red UAS using distance and FOV.
8. Detection Candidate is generated.
9. Track is created.
10. Classification occurs.
11. Identification may be simplified at first.
12. C2 decision occurs.
13. Effector fires.
14. Damage resolves using `Effective_Pk`.
15. Single-run report displays.
16. Monte Carlo run button executes N iterations.
17. Summary table updates.
18. Flat CSV export works.

Do not start with the full scenario builder.

---

# 14. Defer These Until After First Vertical Slice

Do not implement these in the first prototype unless explicitly instructed:

- Full scenario editor
- Full terrain editor
- Full spectrum editor
- Full power grid editor
- Full Red doctrine editor
- Polished UI
- Full save/load library
- Complex map editing
- Advanced report playback
- All helper calculators
- Multi-page documentation UI

Create placeholders or TODO entries instead.

---

# 15. Mathematical Model Priorities

Initial prototype should support simple versions of:

- 3D Euclidean distance
- Horizontal and vertical FOV
- Basic line-of-sight placeholder
- Inverse-square signal degradation
- Gaussian noise using Box-Muller
- Effective Probability of Kill
- Effective Probability of Effect placeholder
- Secondary explosion placeholder

Do not overfit to real classified systems.

Use generic, sanitized, fictional values.

---

# 16. Monte Carlo Requirements

Monte Carlo execution should:

1. Clone baseline scenario.
2. Apply randomized variance.
3. Run event queue to completion.
4. Record summary metrics.
5. Repeat for N iterations.
6. Return aggregate results.

CSV export must be flat.

Do not place nested arrays or objects into one CSV cell.

For dynamic effector ammo metrics, create one column per effector template ID.

---

# 17. Logging Requirements

Every important action should be logged.

At minimum log:

- Detection candidates
- Track creation
- Classification
- Identification
- C2 decisions
- Effector actions
- Effect resolution
- Damage resolution
- Object destruction
- Ghost track creation
- Spoofed track creation
- Monte Carlo iteration summaries

Logging must not affect simulation outcomes.

---

# 18. UI Rules

The UI should be controlled by a `UIManager` or equivalent state machine.

Only one major screen should be visible at a time.

Recommended screens:

1. Main Menu
2. Scenario Dashboard
3. Run Scenario
4. Report Viewer
5. Template Library placeholder
6. Mission Builder placeholder
7. Environment Builder placeholder
8. Raw Data / Export
9. Tutorial / Help placeholder

For the first prototype, it is acceptable to use a simplified UI with:

- Canvas
- Run Single Scenario button
- Run Monte Carlo button
- Results table
- CSV export button
- Event log panel

---

# 19. File and Repo Expectations

Expected repo shape:

```text
.
├── AGENTS.md
├── TODO.md
├── README.md
├── index.html
└── docs/
    ├── Simulation_Design.md
    ├── Data_Model.md
    ├── System_Architecture.md
    └── UI_Architecture.md
```

If the repo does not match this exactly, do not reorganize everything without reason.

Work with the existing structure and record recommended restructuring in `TODO.md`.

---

# 20. TODO.md Rules

Codex must review `TODO.md` at the beginning of every work session.

Codex must update `TODO.md` before finishing every work session.

The TODO file should track:

- Current build goal
- Completed tasks
- Open tasks
- Deferred features
- Known bugs
- Architecture concerns
- Next recommended prompt

When a task is completed, move it from `Open Tasks` to `Completed`.

When a new issue is discovered, add it to `Known Issues` or `Open Tasks`.

When a major design decision is made, add it to `Architecture Notes`.

Do not delete historical completed items unless the user asks.

---

# 21. Coding Style

Use plain, readable JavaScript.

Prefer small classes or plain objects.

Avoid overly clever abstractions.

Prefer explicit system methods:

```js
sensorSystem.process(event, worldState)
trackSystem.process(event, worldState)
c2System.process(event, worldState)
```

Keep functions small.

Name things clearly.

Document major assumptions in comments.

---

# 22. Testing and Verification

After changes, verify as much as possible.

For a browser-only prototype:

- Check JavaScript syntax.
- Open `index.html` manually if possible.
- Confirm buttons work.
- Confirm canvas renders.
- Confirm simulation runs.
- Confirm event log updates.
- Confirm Monte Carlo runs.
- Confirm CSV export produces flat CSV.

If automated tests do not exist, record manual test steps in `TODO.md`.

Automatic Testing Requirements

- Never modify index.html to support testing.
- Create Playwright tests under /tests.
- Launch Chromium with:

--no-sandbox
--disable-setuid-sandbox
--disable-dev-shm-usage
--disable-gpu

- Serve the application through a local HTTP server.
- Verify:
  * Application loads
  * No console errors
  * Scenario can be loaded
  * Simulation can execute
  * Report view renders

---

# 23. Do Not Do

Do not:

- Add npm.
- Add React.
- Add Vue.
- Add external libraries.
- Add backend services.
- Add external API calls.
- Add classified or real-world sensitive system data.
- Build a giant God object.
- Hide major assumptions.
- Replace the architecture documents without user approval.
- Overbuild beyond the current TODO scope.

---

# 24. When Unsure

When uncertain, choose:

1. Simpler implementation.
2. Clearer architecture.
3. More explainable behavior.
4. Smaller vertical slice.
5. TODO entry over speculative implementation.

The goal is a working, explainable prototype first.
