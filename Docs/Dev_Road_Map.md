C-sUAS Tactical Simulator: Future Development Roadmap
Overview
This document outlines the strategic roadmap for the C-sUAS (Counter-small Unmanned Aerial Systems) Tactical Simulator. The current V2.0+ architecture successfully implements a zero-dependency, browser-based Discrete Event Simulation (DES) utilizing 3D kinematics, dynamic probability of kill ($P_k$), and multi-spectrum Electronic Warfare (EW) logic.

Future phases will transition the codebase to a modular build environment and introduce advanced AI analytics, Graphic Control Measures (GCMs), and high-fidelity environmental physics to further align with JIATF 401 C4 Modeling & Simulation (M&S) requirements.


Phase 1: Architecture Modularization
Objective: Eliminate technical debt by shattering the monolithic HTML file into a scalable ES6 modular architecture, while maintaining the "offline/single-file" distribution constraint.

Vite Build Pipeline Integration: Transition the codebase into a /src directory utilizing vite-plugin-singlefile. This allows developers to work in discrete JavaScript modules (physics.js, c2.js, sensor.js) while the bundler compiles the final product into a secure, air-gap-ready HTML payload.
Native Web Worker Migration: Replace the legacy Blob-string Web Worker instantiation with native ES6 Worker imports, allowing the Monte Carlo execution thread to safely import schemas and math utilities directly.

Current sequencing note:
The standalone environment extractor should remain a separate offline HTML utility under `external_util/`, but its generated scenario schema should stay aligned with the simulator while Phase 1 modularization closes the remaining `index.html` to `src/` drift.

Remaining Phase 1 cutover items:
- Move more runtime authority from legacy `index.html` extraction into `src/`, especially shared kernel/bootstrap/report logic.
- Re-run the focused playtest package against the bundled Vite path and fix any bundle-only drift before declaring `src/` authoritative.
- Define the switchover point where the bundled single-file output replaces direct `index.html` as the ready-to-test artifact.


Phase 2: Advanced Analytics & AI Integration
Objective: Expand the tool's utility from a "Data Generator" to a "Decision Engine" using external data science workflows and localized Edge AI.

External Data Science Pipeline (R / Python):
Develop an accompanying Jupyter Notebook / R-Markdown suite to ingest the flattened _monte_carlo.csv output.
Implement Random Forest Classifiers to determine Feature Importance (e.g., mathematically proving whether Radar Max Range, Jammer Strength, or Ammo Capacity was the highest driver of HQ Survival across 1,000 iterations).
Generate Correlation Matrices to evaluate cost-per-kill metrics based on dynamic template ammo expenditures.
Edge AI Automated Debriefs (SLM Integration):
Integrate a Small Language Model (e.g., Llama-3.2-3B or Qwen-2.5) that runs entirely offline via Transformers.js / WebGPU.
Feed aggregated Monte Carlo metrics to the localized SLM to auto-generate human-readable, tactical After Action Reports (AAR) and doctrine recommendations without compromising Controlled Unclassified Information (CUI).


Phase 3: Operational Fidelity & Spatial UI
Objective: Provide commanders with visual proof of Rules of Engagement (ROE) compliance and operational risks (Fratricide / Collateral Damage).

Impact Heatmaps:
Log the exact X/Y coordinates of all missed kinetic shots and destroyed drone debris.
Update the MapRenderer to draw semi-transparent thermal clusters on the 2D canvas during post-run debriefs to visualize high-risk collateral damage zones.
Graphic Control Measures (GCM) & ROE Enforcement:
Allow users to draw Weapon Engagement Zones (WEZ) and No-Fire Areas (NFA) on the 2D map.
Update C2 System logic to calculate projected intercept coordinates based on Time of Flight (TOF). If the intercept occurs inside a civilian NFA, the C2 Node holds kinetic fire and tasks non-kinetic (Jammer/Cyber) effectors instead.
Synergy: Compare the Impact Heatmaps against the NFA polygons to mathematically grade a Defense Plan's adherence to ROE.


Phase 4: High-Fidelity Physics & Environment
Objective: Deepen the physical realism of the simulation to account for micro-terrain and advanced Electronic Attack (EA) vectors.

3D Heightmap Terrain Integration:
Transition from basic 2D block polygons to grayscale PNG heightmap ingestion.
Update the geospatial.js raycasting logic to sample pixel brightness along the Line-of-Sight, enabling pixel-perfect 3D terrain masking for radars operating in mountainous or dense urban terrain.
Extractor follow-on for terrain authoring:
Replace the standalone extractor's current global average-height terrain segmentation with **local relief thresholding**, so the utility highlights sharp spikes/anomalies that matter to radar masking while ignoring broad smooth terrain that should remain background context.
Advanced Sensor Spoofing (DRFM):
Expand the EW model beyond Telemetry Injection (which deceives the Red Operator) to include Digital Radio Frequency Memory (DRFM) spoofing.
Allow Red targets to project fake radar returns, forcing the Blue Track System to log "Ghost Tracks" at offset coordinates, actively deceiving the Blue C2 Node's kinetic targeting equations.
