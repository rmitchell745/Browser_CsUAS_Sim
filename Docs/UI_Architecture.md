# UI_Architecture.md

# Counter-small UAS Monte Carlo Discrete Event Simulation
## User Interface Architecture

# 1. Purpose

This document defines the user interface architecture for the browser-based C-sUAS Monte Carlo Discrete Event Simulation.

The UI is responsible for:

- Scenario creation
    -Helper functions
- Template editing
- Roster construction
- Mission planning
- Terrain editing
- Network and power configuration
- Simulation execution controls
- Report visualization
- Data import/export

The UI shall not contain core simulation logic. Simulation execution belongs to the Web Worker and system architecture defined in `System_Architecture.md`.

---

# 2. UI Design Philosophy

The UI is a single-page browser application.

The UI should support rapid scenario creation while preserving a clear separation between:

- Templates
- Rosters
- Mission instances
- Simulation outputs

The UI should help users build valid scenarios without requiring them to understand every internal data structure.

The UI should expose advanced configuration options without overwhelming basic users.

---

# 3. Technical Constraints

## Single HTML Application

The application must exist as a standalone browser-executable file.

Requirements:

- Vanilla HTML
- Vanilla CSS
- Vanilla JavaScript
- No external dependencies
- No CDNs
- No npm packages
- Inline CSS and JavaScript

## Offline Operation

The UI must operate without internet access.

The UI shall not depend on:

- External APIs
- Remote files
- Cloud databases
- Remote images
- External fonts
- Package managers

## Local File Handling

The UI shall use browser-native file handling.

Supported mechanisms:

- HTML5 FileReader API for loading files
- Blob-generated downloads for saving files
- Ephemeral anchor tags for file export

The UI should support local files for:

- Scenario JSON
- Terrain JSON
- Platform Template JSON
- Roster JSON
- Mission JSON
- Simulation result CSV
- Report logs

---

# 4. UI Manager / State Machine

Because the application is a single HTML file, navigation should be handled by a `UIManager` or state machine.

The UIManager controls which workstation drawer is visible.

Only one major right-side drawer should be active at a time.

Current prototype drawer states:

- Scenario Editor
- Template Wizard
- Rosters / Networks / Power
- Debrief
- Export

Implementation concept:

```text
UIManager.showScreen(screenId)
```

The UIManager should toggle the active state of the relevant sidebar `<section>` and its matching side-tray button.

---

# 5. Workstation Flow

The current prototype uses a tactical workstation shell rather than a separate main-menu loop.

Primary operator flow:

```text
Template Wizard (Tier 1)
↓
Rosters / Networks / Power (Tier 2)
↓
Scenario Editor (Tier 3)
↓
Run Scenario
↓
Debrief / Export
```

The map remains the dominant surface throughout this flow. Drawers support the task rather than replacing the map.

---

# 6. Scenario Editor Overview

The Scenario Editor is responsible for creating or editing complete simulation scenarios at Tier 3.

Major functions:

- Load Scenario JSON
- Create New Scenario
- Edit terrain/environment metadata
- Build Blue placement
- Build Red threat placement
- Assign logical networks
- Assign power-grid connections
- Save Scenario JSON

The editor should preserve the Three-Tier System:

1. Templates
2. Rosters
3. Mission Instances

The current prototype defaults this workflow to `Blank From Scratch`, while still allowing starter patterns for baseline, lock/refire, and TEWA-priority cases.

---

# 7. Template Wizard UI

Templates define reusable capabilities.

The Template Wizard is the Tier 1 workflow. It should support creation and editing of component-based templates while keeping major capability edits out of the Scenario Editor.

Template categories may include:

- UAS
- C-sUAS
- Sensor
- Effector
- Asset
- Infrastructure
- Decoy
- Clutter Object

The current prototype includes:

- helper-workflow placeholder cards
- a scenario-local template list
- common-field editing
- selected-template JSON editing
- standalone selected-template import/export

The UI should continue allowing templates to be assembled using components rather than forcing a single large form.

Example components:

- Health
- Resistance
- Capability
- Signature
- Movement
- Control
- Mission
- Network
- Power Producer
- Power Consumer
- Sensor
- Effector
- C2
- Explosive

---

# 8. Component Editor Pattern

To avoid overwhelming the user, each component should be edited in its own collapsible panel.

Example:

```text
Template Name
Default Roles
Icon

[Health Component]
[Movement Component]
[Sensor Components]
[Effector Components]
[Network Component]
[C2 Component]
[Power Component]
[Advanced Fields]
```

The UI should support:

- Add Component
- Remove Component
- Duplicate Component
- Reset Component Defaults
- Expand / Collapse Component Panels

Objects may have multiple sensor or effector components.

---

# 9. Helper Functions

The UI should include helper functions for values that are difficult for users to estimate manually.

## General Helpers

- Abstract scoring and health defaults
- Asset value defaults
- Payload yield calculator
- Explosive yield presets
- Power generation presets
- Power consumption presets

## Sensor Helpers

- Watts to dBW converter
- Detection range estimator
- txPower_dB estimator
- rxThreshold_dB estimator
- Sensor baseline auto-fill

Sensor baseline defaults may include:

- EO / IR
- Radar
- RF Passive
- Acoustic
- FPV

## UAS Helpers

- UAS class profile auto-fill
- Signature defaults
- Acceleration defaults
- Turn rate defaults
- Endurance defaults
- Link resilience calculator
- Lost link behavior defaults

## Effector Helpers

- Effector baseline auto-fill
- BasePk defaults
- BasePe defaults
- Directed energy dwell time defaults
- Interceptor movement defaults

## C2 Helpers

- C2 latency estimator
- Rules of engagement presets
- Track capacity presets

---

# 10. Roster / Network / Power UI

Rosters define force composition.

The Tier 2 drawer should allow users to:

- Select templates from the scenario library
- Assign quantities
- Assign side
- Add to Blue roster
- Add to Red roster
- Add neutral or civilian objects if supported

Roster entries should reference Template IDs rather than duplicating full template data.

Example workflow:

```text
Select Template
↓
Set Quantity
↓
Assign Side
↓
Add to Roster
```

The current prototype also hosts first-pass C2 network and power-grid editors in this drawer so scenario authors can manage logical assignment without leaving the workstation shell.

---

# 11. Map-Centric Scenario Editing UI

Tier 3 mission instances are laid out through the Scenario Editor and live map.

The map-centric editor should provide a 2D canvas for placement and mission planning.

Major functions:

- Load terrain background
- Click to place roster items onto the map
- Assign starting position
- Assign altitude
- Assign waypoints
- Assign routes
- Assign sectors
- Assign fields of view
- Assign fields of fire
- Assign objectives
- Assign C2 network subscriptions
- Assign power grid connections

The current prototype supports click-to-select and click-to-move for built/imported scenario objects, plus click-to-place flows for Blue placement and Red route endpoint authoring in the editor draft.

---

# 12. Terrain Editing UI

The Terrain Editor supports creation and editing of terrain objects.

Functions:

- Load terrain JSON
- Load map image
- Save map image as base64 inline data if needed
- Draw terrain polygons on canvas
- Assign terrain object parameters
- Save terrain object JSON

Terrain object parameters:

- Interference type
- Clutter penalty
- Height
- Name / label
- Notes

Interference types:

- Block
- Noise
- No Effect

The Terrain Editor should include a Terrain Material Profiler.

Example material presets:

- Open ground
- Building
- Tree line
- Dense foliage
- Light urban clutter
- Heavy urban clutter
- Weather cell

---

# 13. Environment Builder UI

The Environment Builder defines non-object environmental factors.

This includes:

- Weather
- Clutter fields
- Spectrum environment

## Clutter Field Editor

The Clutter Field Editor should allow users to create areas that may spawn physical clutter or ghost tracks.

Clutter types:

- Birds
- Balloons
- Weather
- Urban RF
- Foliage
- Ground Traffic
- Thermal Noise

Editor functions:

- Draw area polygon
- Set altitude band
- Set density
- Set spawn rate
- Allow physical object spawning
- Allow ghost track spawning
- Set classification confusion modifier
- Set identification confusion modifier

## Spectrum Environment Editor

The Spectrum Environment Editor defines RF conditions.

Fields may include:

- Base noise
- Congestion
- Blue jamming power
- Red jamming power
- GPS denied
- Communications denied
- Spoofing active
- Affected bands

---

# 14. Network and Power UI

The UI should allow users to create and assign logical networks and power grids.

## C2 Network UI

Functions:

- Create C2 Network
- Name C2 Network
- Set network type
- Set transmission latency
- Set track capacity
- Set jamming / spoofing vulnerability
- Assign objects to network

Network types may include:

- RF
- Hardwired
- SATCOM
- Local Swarm
- Autonomous

## Power Grid UI

Functions:

- Create Power Grid
- Name Power Grid
- Set grid type
- Assign producers
- Assign consumers
- View estimated load
- View estimated capacity

Grid types may include:

- Shore
- Tactical
- Mobile
- Battery

When placing a physical instance, the object properties panel should provide dropdowns for available networks and power grids.

---

# 15. Red Force Planning UI

Red Force planning should use the same UI concepts as Blue Force planning.

Red planning should support:

- UAS placement
- Launch areas
- Approach routes
- Waypoints
- Target priorities
- Red doctrine selection
- EW missions
- Spoofing missions
- Decoy missions
- Terminal attack missions

Red doctrine presets may include:

- Saturation Attack
- Local Saturation
- Distributed Saturation
- Recon Then Strike
- Decoy First
- Sensor Suppression
- HQ Attack
- Power Attack

Doctrine should influence target selection, timing, coordination, and risk tolerance.

---

# 16. Run Scenario UI

The Run Scenario UI controls execution.

Current prototype functions:

- Load Scenario
- Review validation and summary state
- Set number of Monte Carlo iterations
- Execute single scenario
- Execute Monte Carlo
- Toggle ghost and clutter placeholders
- Review validation status
- Download raw outputs
- Keep Blue and Red feeds visible alongside the map

Not yet implemented in the current prototype:

- Noise variance controls
- Weather variance controls
- Clutter density variance controls
- Classification accuracy variance controls
- Identification accuracy variance controls
- EW effectiveness variance controls
- Human latency variance controls
- Cancel execution

The Run Scenario UI sends a compiled Scenario JSON to the Web Worker.

The UI does not run the simulation directly.

---

# 17. Web Worker Interaction

The main UI thread is responsible for:

- Compiling scenario data
- Creating the inline Blob Web Worker
- Sending execution parameters
- Receiving results
- Updating progress
- Displaying final reports

The Web Worker is responsible for:

- Cloning baseline scenarios
- Applying Monte Carlo variance
- Running event queues
- Returning summary statistics
- Returning selected detailed logs

The UI should support progress updates when feasible.

---

# 18. Debrief UI

The Debrief drawer visualizes completed runs.

Current prototype views:

- single-run summary metrics
- single-run detail list
- split Blue / Red operational feeds
- event timeline
- top failure-driver summary
- replay frames on the canvas
- Monte Carlo aggregate table

The debrief surface should replay stored logs rather than rerunning the simulation.

Assessment snapshots currently live in the single-run report JSON payload and are not yet exposed as a dedicated UI panel.

Raw data preview and download workflows belong to the separate `Export` drawer.

---

# 19. Playback UI

Playback should use returned world frames to drive visualization, not rerun the simulation.

Controls:

- Play
- Pause

Future controls not yet implemented:

- Step Forward
- Step Backward
- Jump to Event
- Change Playback Speed
- Filter Event Types

Visualization layers:

- Physical objects
- Tracks
- Ghost tracks
- Spoofed tracks
- Engagements
- Effects
- Damage
- Sensor FOV
- Effector range
- Terrain
- Clutter fields

---

# 20. Reporting Outputs

The UI should support CSV export.

CSV output should be flat and tabular.

Do not place arrays or objects inside a single CSV cell.

Minimum outputs may include:

- Iteration_ID
- Blue_Assets_Survived
- Threats_Destroyed
- HQ_Survived
- Percent_Survived
- Weighted_Survival_Score
- Average_First_Detection_Range_m
- Average_First_Detection_Time_s
- Win_Loss
- Applied_Noise_Variance_dB
- Ghost_Tracks_Generated
- Spoofed_Tracks_Generated
- False_Positives
- False_Negatives
- Misidentifications
- Fratricide_Events
- Blue_C2_Jammed_Time_sec
- Blue_Track_Drops
- Red_Jam_Attempts
- Red_Jam_Successes

Current prototype outputs also include:

- `HQ_Survived`
- `Percent_Survived`
- `Weighted_Survival_Score`
- one ammo expenditure column per Blue effector template present in the run
- single-run report JSON with `logs`, `frames`, `tracks`, and `assessmentSnapshots`

For every unique effector template in the roster, generate a dedicated ammo expenditure column.

Example:

```text
Template_Kinetic_Ammo_Expended
Template_Laser_Ammo_Expended
Template_Jammer_Ammo_Expended
```

---

# 21. Validation and Error Handling UI

The UI should validate scenarios before execution.

Current prototype validation checks focus on:

- malformed JSON imports
- missing or invalid scenario sections
- template-instance mismatches
- basic object placement and component consistency

Broader power, terrain, and network validation remains future work.
- C2 networks with no subscribed systems
- Red force with no mission
- Blue force with no defended assets
- Invalid numerical ranges
- Duplicate IDs

Errors should be shown clearly with suggested fixes.

Warnings should allow continuation when appropriate.

---

# 22. Advanced Mode

The UI should provide two levels of control.

## Basic Mode

Basic Mode exposes:

- Template presets
- Scenario templates
- Common fields
- Helper functions

## Advanced Mode

Advanced Mode exposes:

- All component fields
- Manual numerical entry
- Monte Carlo variance fields
- Debug logs
- Raw JSON view

Advanced Mode should never be required for normal use.

---

# 23. Data Separation Rules

The UI must preserve separation between:

- Template data
- Roster data
- Mission instance data
- Execution results
- Report logs

The UI should not mutate Tier 1 templates during simulation execution.

Monte Carlo execution should clone runtime state for each iteration.

---

# 24. Recommended Workstation Surfaces

Current major workstation surfaces:

1. Live Map / Canvas
2. Scenario Editor
3. Template Wizard
4. Rosters / Networks / Power
5. Debrief
6. Export

Likely future additions:

7. Dedicated terrain/environment editor
8. Dedicated helper-calculator panels inside Template Wizard
9. Dedicated assessment snapshot viewer
10. Advanced playback controls

---

# 25. Future UI Enhancements

Potential future additions:

- Scenario comparison dashboard
- Heat map overlays
- Monte Carlo distribution charts
- Drag-and-drop doctrine builder
- Sensor coverage preview
- Effector range preview
- C2 workload dashboard
- Track confidence timeline
- Red/Blue plan comparison
- Scenario validation checklist
- Sanitized portfolio export mode

---

# 26. UI Non-Goals

The UI should not:

- Run core simulation logic on the main thread
- Contain mathematical model logic
- Mutate simulation outputs
- Require internet access
- Require external libraries
- Hide simulation assumptions from users
- Store CUI externally

---

# 27. Relationship to Other Documents

`Simulation_Design.md` defines the modeling philosophy.

`Data_Model.md` defines data structures.

`System_Architecture.md` defines processing systems.

`UI_Architecture.md` defines user workflows and interface responsibilities.

`Scenario_Schema.md` will eventually define the final saved scenario object after implementation stabilizes.
