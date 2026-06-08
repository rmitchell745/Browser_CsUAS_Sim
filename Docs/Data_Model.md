# Data_Model.md

# Component-Based Data Model for C-sUAS Discrete Event Simulation

## 1. Purpose

This document defines the simulation data model for the C-sUAS discrete event simulation.

The model uses composition instead of deep inheritance. Objects are built by attaching reusable capability components to lightweight templates and instances.

allows Blue, Red, Neutral, UAS, Sensors, Effectors, Infrastructure, Clutter, Decoys, and Interceptors to share common logic.

The model supports:

- Side-agnostic Blue and Red simulation
- Physical objects and non-physical tracks
- Detection, classification, identification, and intent modeling
- Jamming, spoofing, dazzling, degradation, and kinetic effects
- Environment clutter such as birds, balloons, RF noise, and ghost tracks
- Monte Carlo execution using lightweight scenario JSON

---

## 2. Core Design Rules

### 2.1 Composition Over Inheritance

Objects should not be modeled as large inheritance trees such as:

```text
BlueAsset -> BlueCUAS -> BlueRadar -> BlueRadarWithJammer
```

Instead, objects are constructed from reusable components:

```text
ObjectTemplate
    + HealthComponent
    + MovementComponent
    + SensorComponent[]
    + EffectorComponent[]
    + NetworkComponent
    + PowerConsumerComponent
```

### 2.2 Templates Are Static

Templates define what an object can do.

Templates do not store changing runtime state such as current health, current ammo, position, current track status, or current effects.

### 2.3 Instances Are Dynamic

Instances define where an object is and what state it is currently in during a simulation run.

Instances reference templates by `templateId`.

### 2.4 Tracks Are Separate From Physical Objects

A track is a sensor or C2 belief that something exists.

A track may represent:

- A real physical object
- A ghost track
- A spoofed track
- A decoy
- Clutter
- A bird or balloon

This separation is required to model false alarms, spoofing, fratricide risk, and classification/identification failure.

### 2.5 Effects Are Generic

Effects are not limited to damage.

An effect may destroy a target, but it may also jam, spoof, degrade, blind, suppress, delay, or sever a system.

---

## 3. Three-Tier System

The scenario model uses three tiers.

```text
Tier 1: Templates
    Static capabilities and hardware characteristics.

Tier 2: Rosters
    Force packages / order of battle.

Tier 3: Mission Plans and Instances
    Runtime placement, behavior, and dynamic state.
```

---

## 4. Tier 1: Object Templates

Templates define object capabilities.

They are stored in the scenario library and reused across many scenarios.

```json
{
  "id": "Template-Generic-FPV-UAS",
  "name": "Generic FPV UAS",
  "category": "UAS",
  "defaultRoles": ["UAS", "Sensor", "Effector"],
  "icon": "base64-inline-icon",
  "components": {}
}
```

### 4.1 Template Fields

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique template identifier. |
| `name` | String | Human-readable name. |
| `category` | String | Broad template category. |
| `defaultRoles` | Array[String] | Default object roles when instantiated. |
| `icon` | String | Base64 inline icon. |
| `components` | Object | Dictionary of attached components. |

### 4.2 Category Examples

```text
UAS
CUAS
Sensor
Effector
Asset
Infrastructure
Clutter
Decoy
Interceptor
```

---

## 5. Tier 2: Rosters

Rosters define how many of each template are available to a side.

```json
{
  "id": "Roster-Red-Swarm-Alpha",
  "side": "Red",
  "items": [
    {
      "templateId": "Template-Generic-FPV-UAS",
      "quantity": 8
    }
  ]
}
```

### 5.1 Roster Fields

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique roster identifier. |
| `side` | Enum | Blue, Red, Civillian, Environment, or Neutral. |
| `items` | Array | Template references and quantities. |

---

## 6. Tier 3: Instance State

Instances are created from templates during mission planning or simulation initialization.

Instances are dynamic and reset for each Monte Carlo iteration.

```json
{
  "id": "Inst-Red-UAS-01",
  "templateId": "Template-Generic-FPV-UAS",
  "side": "Red",
  "roles": ["UAS", "Sensor", "Effector"],
  "posX": 1000,
  "posY": 500,
  "posZ": 120,
  "velocity": {
    "vx": 12,
    "vy": 0,
    "vz": 0
  },
  "operationalStatus": "Active",
  "currentEffects": []
}
```

### 6.1 Instance Fields

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique instance identifier. |
| `templateId` | String | Reference to Tier 1 template. |
| `side` | Enum | Blue, Red, or Neutral. |
| `roles` | Array[String] | Roles this instance performs. |
| `posX` | Float | X coordinate in meters. |
| `posY` | Float | Y coordinate in meters. |
| `posZ` | Float | Z coordinate in meters. |
| `velocity` | Vector3 | Current velocity vector. |
| `operationalStatus` | Enum | Current operational state. |
| `currentEffects` | Array[String] | Active effect IDs applied to this instance. |

### 6.2 Side Enum

```text
Blue
Red
Neutral
```

### 6.3 Role Array

```text
Sensor
Effector
UAS
Asset
Power
C2
Decoy
Clutter
Interceptor
```

### 6.4 Operational Status Enum

```text
Active
Idle
Degraded
Suppressed
Offline
Destroyed
```

### 6.5 State Kept Out of the Base Instance

The base instance should remain small.

Do not put these fields directly on every instance:

| Field | Correct Location |
|---|---|
| `currentHealth` | Runtime state derived from Health Component |
| `ammoRemaining` | Runtime state derived from Effector Component |
| `activeWaypoints` | Mission Component |
| `missionState` | Mission Component |
| `controlMode` | Control Component |
| `networkStatus` | Network Component |
| `connectedPowerGrid` | Power Consumer Component |
| `isPowered` | Power System runtime calculation |
| `isNetworked` | Network System runtime calculation |

---

# 7. Component Definitions

Components define capabilities.

Systems process components.

An object may contain any combination of components.

---

## 7.1 Health Component

Defines survivability and value.

```json
{
  "health": {
    "maxHealth": 100,
    "armorLevel": 1,
    "assetValue_pts": 50
  }
}
```

| Field | Type | Description |
|---|---|---|
| `maxHealth` | Integer | Starting hit points. |
| `armorLevel` | Integer | Damage reduction or armor abstraction. |
| `assetValue_pts` | Integer | Weighted score value for survival analysis. |

---

## 7.2 Resistance Component

Defines resistance to physical and non-physical effects.

```json
{
  "resistance": {
    "kineticResistance": 0.1,
    "ewResistance": 0.3,
    "cyberResistance": 0.2,
    "opticalResistance": 0.1,
    "acousticResistance": 0.0,
    "gpsResistance": 0.2,
    "networkResistance": 0.3,
    "redundancy": 0.1
  }
}
```

All resistance values use:

```text
0.0 = no resistance
1.0 = maximum modeled resistance
```

| Field | Type | Description |
|---|---|---|
| `kineticResistance` | Float | Resistance to kinetic damage. |
| `ewResistance` | Float | Resistance to EW/jamming effects. |
| `cyberResistance` | Float | Resistance to cyber/network attack. |
| `opticalResistance` | Float | Resistance to dazzling/blinding. |
| `acousticResistance` | Float | Resistance to acoustic detection/effects. |
| `gpsResistance` | Float | Resistance to GPS denial/spoofing. |
| `networkResistance` | Float | Resistance to network disruption. |
| `redundancy` | Float | Ability to continue operating after degradation. |

---

## 7.3 Capability Component

Defines dependencies and general operating requirements.

```json
{
  "capability": {
    "usesGPS": true,
    "usesNetwork": true,
    "usesRF": true,
    "requiresPower": true,
    "requiresC2": false,
    "canOperateAutonomously": true
  }
}
```

| Field | Type | Description |
|---|---|---|
| `usesGPS` | Boolean | Uses GPS/PNT. |
| `usesNetwork` | Boolean | Uses a C2 or data network. |
| `usesRF` | Boolean | Emits or receives RF. |
| `requiresPower` | Boolean | Requires external/grid power. |
| `requiresC2` | Boolean | Requires C2 to function. |
| `canOperateAutonomously` | Boolean | Can continue without active C2. |

---

## 7.4 Signature Component

Defines detectability by different sensor types.

```json
{
  "signature": {
    "radarSignature_dB": -20,
    "thermalSignature_dB": -15,
    "acousticSignature_dB": -10,
    "rfSignature_dB": -5
  }
}
```

| Field | Type | Description |
|---|---|---|
| `radarSignature_dB` | Float | Radar/RCS-like signature. |
| `thermalSignature_dB` | Float | IR/thermal signature. |
| `acousticSignature_dB` | Float | Acoustic signature. |
| `rfSignature_dB` | Float | RF emission signature. |

---

## 7.5 Movement Component

Defines mobility and endurance.

```json
{
  "movement": {
    "isMobileXY": true,
    "isMobileZ": true,
    "maxSpeed_mps": 35,
    "maxAccel": 8,
    "turnRate_dps": 90,
    "maxEndurance_sec": 900
  }
}
```

| Field | Type | Description |
|---|---|---|
| `isMobileXY` | Boolean | Can move in the horizontal plane. |
| `isMobileZ` | Boolean | Can change altitude. |
| `maxSpeed_mps` | Float | Maximum speed in meters per second. |
| `maxAccel` | Float | Maximum acceleration. |
| `turnRate_dps` | Float | Maximum turn rate in degrees per second. |
| `maxEndurance_sec` | Float | Maximum operating time. |

---

## 7.6 Control Component

Defines command, autonomy, and lost-link behavior.

```json
{
  "control": {
    "controlMode": "Networked",
    "linkResilience": 0.6,
    "autonomyLogic": "Waypoints",
    "lostLinkBehavior": "ExecuteTerminalDive"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `controlMode` | Enum | Networked, Autonomous, Jammed, or Severed. |
| `linkResilience` | Float | Resistance of command link to disruption. |
| `autonomyLogic` | Enum | Local behavior model. |
| `lostLinkBehavior` | Enum | Behavior if control link is lost. |

### Control Mode Enum

```text
Networked
Autonomous
Jammed
Severed
```

### Autonomy Logic Enum

```text
Waypoints
RF-Homing
Optical
Loiter
ManualFPV
```

### Lost Link Behavior Enum

```text
ContinueDeadReckoning
RTB
Hover
Loiter
ExecuteTerminalDive
```

---

## 7.7 Mission Component

Defines mission execution state.

```json
{
  "mission": {
    "missionState": "EnRoute",
    "activeWaypoints": [
      { "x": 1000, "y": 500, "z": 120 },
      { "x": 600, "y": 400, "z": 80 }
    ],
    "assignedTargetId": null,
    "assignedTrackId": null
  }
}
```

| Field | Type | Description |
|---|---|---|
| `missionState` | Enum | Current mission state. |
| `activeWaypoints` | Array[Vector3] | Remaining waypoints. |
| `assignedTargetId` | String/null | Assigned physical target. |
| `assignedTrackId` | String/null | Assigned track target. |

### Mission State Enum

```text
Idle
EnRoute
Loiter
Engaging
TerminalDive
RTB
```

---

## 7.8 Power Producer Component

Defines power generation.

```json
{
  "powerProducer": {
    "powerProduced_kW": 30
  }
}
```

| Field | Type | Description |
|---|---|---|
| `powerProduced_kW` | Float | Power provided to a grid. |

---

## 7.9 Power Consumer Component

Defines power consumption.

```json
{
  "powerConsumer": {
    "powerConsumed_kW": 5,
    "connectedPowerGridId": "Grid-Tactical-Alpha"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `powerConsumed_kW` | Float | Required power draw. |
| `connectedPowerGridId` | String | Linked power grid. |

---

## 7.10 Network Component

Defines network participation.

```json
{
  "network": {
    "networkIds": ["Blue-C2-Net-01"],
    "networkStatus": "Connected"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `networkIds` | Array[String] | Networks this object publishes to or subscribes to. |
| `networkStatus` | Enum | Current network state. |

### Network Status Enum

```text
Connected
Latent
Intermittent
Jammed
Severed
Spoofed
```

---

## 7.11 C2 Component

Defines C2 decision capability.

```json
{
  "c2": {
    "networkId": "Blue-C2-Net-01",
    "processingLatency_sec": 0.5,
    "maxTracks": 20,
    "rulesOfEngagement": "WeaponsTight",
    "doctrine": "DefendHQ"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `networkId` | String | C2 network controlled by this node. |
| `processingLatency_sec` | Float | Decision processing delay. |
| `maxTracks` | Integer | Maximum simultaneous tracks. |
| `rulesOfEngagement` | Enum | Engagement permission model. |
| `doctrine` | Enum/String | Side-specific behavior or tactic. |

### Rules of Engagement Enum

```text
WeaponsFree
WeaponsTight
ManInLoop
```

### Example Doctrine Values

```text
DefendHQ
DefendAssets
SuppressSensors
AttackHQ
AttackPower
DecoyFirst
ReconThenStrike
Saturate
```

---

## 7.12 Explosive Component

Defines payload damage and secondary explosion behavior.

```json
{
  "explosive": {
    "payloadYield": 50,
    "explosiveYield": "Low"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `payloadYield` | Integer | Direct damage potential. |
| `explosiveYield` | Enum | Secondary explosion potential. |

### Explosive Yield Enum

```text
High
Medium
Low
Min
No
```

---

# 8. Sensor Components

Objects may contain zero or more sensors.

```json
{
  "sensors": []
}
```

Sensors support detection, classification, and identification.

A Red UAS, Blue radar, EO/IR tower, passive RF detector, acoustic array, or FPV camera can all use the same Sensor Component schema.

---

## 8.1 Sensor Component

```json
{
  "type": "FPV",
  "maxRange_m": 1200,
  "fov_azimuth_deg": 90,
  "fov_elevation_deg": 60,
  "txPower_dB": 0,
  "rxThreshold_dB": -80,
  "sweepRate_sec": 1,
  "susceptibleToSpoofing": true,
  "susceptibleToClutter": true,
  "classification": {
    "canClassify": true,
    "classificationLatency_sec": 1.0,
    "classificationAccuracyBase": 0.7
  },
  "identification": {
    "canIdentify": true,
    "identificationLatency_sec": 1.5,
    "identificationAccuracyBase": 0.6
  },
  "fpv": {
    "fpvLatency_sec": 0.15,
    "fpvLinkQuality": 0.8,
    "operatorReactionLatency_sec": 1.0,
    "cameraStatus": "Nominal"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `type` | Enum | Sensor modality. |
| `maxRange_m` | Float | Maximum theoretical detection range. |
| `fov_azimuth_deg` | Float | Horizontal field of view. |
| `fov_elevation_deg` | Float | Vertical field of view. |
| `txPower_dB` | Float | Transmit power, 0 for passive. |
| `rxThreshold_dB` | Float | Detection threshold. |
| `sweepRate_sec` | Float | Time between detection checks. |
| `susceptibleToSpoofing` | Boolean | Whether spoof effects can generate false tracks. |
| `susceptibleToClutter` | Boolean | Whether clutter affects this sensor. |
| `classification` | Object | Classification capability. |
| `identification` | Object | Identification capability. |
| `fpv` | Object/null | FPV-specific extension. |

### Sensor Type Enum

```text
Radar
EO
IR
EO_IR
RF_Passive
Acoustic
FPV
```

---

## 8.2 Classification Capability

Classification answers: "What is it?"

```json
{
  "canClassify": true,
  "classificationLatency_sec": 1.0,
  "classificationAccuracyBase": 0.75
}
```

| Field | Type | Description |
|---|---|---|
| `canClassify` | Boolean | Sensor can classify object type. |
| `classificationLatency_sec` | Float | Time required to classify. |
| `classificationAccuracyBase` | Float | Baseline accuracy from 0.0 to 1.0. |

---

## 8.3 Identification Capability

Identification answers: "Whose is it?"

```json
{
  "canIdentify": true,
  "identificationLatency_sec": 1.5,
  "identificationAccuracyBase": 0.65
}
```

| Field | Type | Description |
|---|---|---|
| `canIdentify` | Boolean | Sensor can identify ownership/affiliation. |
| `identificationLatency_sec` | Float | Time required to identify. |
| `identificationAccuracyBase` | Float | Baseline accuracy from 0.0 to 1.0. |

---

## 8.4 FPV Sensor Extension

Used for operator-controlled UAS cameras.

```json
{
  "fpvLatency_sec": 0.15,
  "fpvLinkQuality": 0.8,
  "operatorReactionLatency_sec": 1.0,
  "cameraStatus": "Nominal"
}
```

| Field | Type | Description |
|---|---|---|
| `fpvLatency_sec` | Float | Video/control feed latency. |
| `fpvLinkQuality` | Float | Link quality from 0.0 to 1.0. |
| `operatorReactionLatency_sec` | Float | Human operator reaction delay. |
| `cameraStatus` | Enum | Camera condition. |

### Camera Status Enum

```text
Nominal
Degraded
Dazzled
Blinded
Offline
```

---

# 9. Effector Components

Objects may contain zero or more effectors.

Effectors generate physical or non-physical effects.

```json
{
  "effectors": []
}
```

---

## 9.1 Effector Component

```json
{
  "type": "Jammer",
  "maxRange_m": 1500,
  "basePk": 0,
  "basePe": 0.7,
  "cooldown_sec": 2,
  "effectDuration_sec": 10,
  "effectRadius_m": 200,
  "ammoCapacity": 999,
  "localAutonomousROE": "HoldFire"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | Enum | Effector type. |
| `maxRange_m` | Float | Maximum range. |
| `basePk` | Float | Baseline probability of kill. |
| `basePe` | Float | Baseline probability of non-kinetic effect. |
| `cooldown_sec` | Float | Time between uses. |
| `effectDuration_sec` | Float | Duration of effect. |
| `effectRadius_m` | Float | Area effect radius. |
| `ammoCapacity` | Integer | Initial ammo or 999 for effectively unlimited systems. |
| `localAutonomousROE` | Enum | Local autonomous fire/effect rule. |

### Effector Type Enum

```text
Kinetic
Jammer
DirectedEnergy
Interceptor
Spoofing
Cyber
TerminalAttack
DecoyDeployment
```

### Local Autonomous ROE Enum

```text
HoldFire
AutoEngageLocalTracks
AutoSuppressEmitters
```

---

## 9.2 Kinetic Extension

```json
{
  "kinetic": {
    "projectileSpeed_mps": 900
  }
}
```

| Field | Type | Description |
|---|---|---|
| `projectileSpeed_mps` | Float | Projectile speed used for time-of-flight. |

---

## 9.3 Directed Energy Extension

```json
{
  "directedEnergy": {
    "dwellTime_sec": 2.0,
    "effectorMaxTargetSpeed_mps": 25
  }
}
```

| Field | Type | Description |
|---|---|---|
| `dwellTime_sec` | Float | Required dwell time. |
| `effectorMaxTargetSpeed_mps` | Float | Target speed above which effectiveness degrades. |

---

## 9.4 Interceptor Extension

Interceptors are modeled as physical objects using:

```text
Movement Component
Sensor Component
Explosive Component
Effector Component
```

Interceptor kinematics should come from the Movement Component, not from a nested interceptor-only schema.

---

# 10. Track Architecture

Tracks represent sensor/C2 beliefs.

Tracks are not the same as physical objects.

A track may point to a real object using `objectId`, or it may have `objectId: null` for ghost and spoofed tracks.

---

## 10.1 Track Schema

```json
{
  "trackId": "Track-001",
  "objectId": "Inst-Red-UAS-01",
  "trackType": "Real",
  "owningSide": "Blue",
  "perceivedSide": "Unknown",
  "sourceSensorIds": ["Inst-Blue-Radar-01"],
  "detectionConfidence": 0.8,
  "classificationStatus": "Unknown",
  "classificationConfidence": 0.0,
  "identificationStatus": "Unknown",
  "identificationConfidence": 0.0,
  "intentStatus": "Unknown",
  "intentConfidence": 0.0,
  "trackQuality": 0.75,
  "isGhost": false,
  "isSpoofed": false,
  "lastUpdateTime": 12.5,
  "staleAfter_sec": 5.0
}
```

| Field | Type | Description |
|---|---|---|
| `trackId` | String | Unique track identifier. |
| `objectId` | String/null | Physical object represented by track, if any. |
| `trackType` | Enum | Real, Ghost, Spoof, Decoy, or Clutter. |
| `owningSide` | Enum | Side that owns the track. |
| `perceivedSide` | Enum | Current perceived affiliation. |
| `sourceSensorIds` | Array[String] | Sensors contributing to track. |
| `detectionConfidence` | Float | Confidence something exists. |
| `classificationStatus` | Enum | What the object is believed to be. |
| `classificationConfidence` | Float | Confidence in classification. |
| `identificationStatus` | Enum | Whose object it is believed to be. |
| `identificationConfidence` | Float | Confidence in identification. |
| `intentStatus` | Enum | What the object is believed to be doing. |
| `intentConfidence` | Float | Confidence in intent. |
| `trackQuality` | Float | Overall track quality. |
| `isGhost` | Boolean | Track has no physical object. |
| `isSpoofed` | Boolean | Track was intentionally spoofed. |
| `lastUpdateTime` | Float | Last update time in seconds. |
| `staleAfter_sec` | Float | Time until the track is stale. |

### Track Type Enum

```text
Real
Ghost
Spoof
Decoy
Clutter
```

### Classification Status Enum

```text
Unknown
UAS
Bird
Balloon
GroundClutter
Decoy
Missile
UnknownAirObject
```

### Identification Status Enum

```text
Unknown
Friendly
Hostile
Neutral
Suspect
```

### Intent Status Enum

```text
Unknown
Transit
Loiter
Recon
Jamming
AttackRun
TerminalDive
```

---

# 11. Effect Architecture

Effects are generated by effectors, environment conditions, damage, cyber actions, or state changes.

Effects may be temporary or permanent.

---

## 11.1 Effect Result Schema

```json
{
  "effectId": "Effect-001",
  "sourceId": "Inst-Red-Jammer-01",
  "sourceSide": "Red",
  "targetId": "Blue-C2-Net-01",
  "effectType": "NetworkJammed",
  "startTime": 20.0,
  "duration_sec": 10.0,
  "magnitude": 0.6,
  "success": true,
  "recoveryRule": "ExpireAfterDuration"
}
```

| Field | Type | Description |
|---|---|---|
| `effectId` | String | Unique effect identifier. |
| `sourceId` | String | Source object, system, or environment. |
| `sourceSide` | Enum | Blue, Red, Neutral, or Environment. |
| `targetId` | String | Target object, network, track, or area. |
| `effectType` | Enum | Type of effect. |
| `startTime` | Float | Effect start time in seconds. |
| `duration_sec` | Float | Effect duration. |
| `magnitude` | Float | Effect strength. |
| `success` | Boolean | Whether effect succeeded. |
| `recoveryRule` | Enum/String | How the effect ends or recovers. |

### Effect Type Enum

```text
TrackSpoof
TrackDrop
LatencyIncrease
ClassificationConfidenceReduced
IdentificationConfidenceReduced
SensorDegraded
SensorBlinded
CameraDazzled
NetworkJammed
NetworkSevered
GPSDenied
GPSSpoofed
Suppressed
Offline
Destroyed
```

### Recovery Rule Examples

```text
ExpireAfterDuration
RequiresRepair
RequiresReboot
Permanent
RecoverWhenJammingEnds
RecoverWhenPowerRestored
```

---

# 12. Environment Architecture

Environment objects affect detection, classification, identification, tracks, and effects.

---

## 12.1 Terrain Object Template

```json
{
  "id": "Terrain-Forest-01",
  "interferenceType": "Noise",
  "clutterPenalty_dB": 5,
  "heightZ": 20,
  "areaPolygon": []
}
```

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique terrain object identifier. |
| `interferenceType` | Enum | Block, Noise, or No. |
| `clutterPenalty_dB` | Float | Added noise penalty if LOS intersects. |
| `heightZ` | Float | Maximum object height. |
| `areaPolygon` | Array[Point] | Terrain footprint. |

### Interference Type Enum

```text
Block
Noise
No
```

---

## 12.2 Environment Clutter Field

Clutter fields generate physical clutter objects, ghost tracks, or both.

```json
{
  "id": "Clutter-Bird-Field-01",
  "type": "Birds",
  "areaPolygon": [],
  "altitudeBand": {
    "minZ": 20,
    "maxZ": 120
  },
  "density": 0.4,
  "spawnRate_per_min": 3,
  "canSpawnPhysicalObjects": true,
  "canSpawnGhostTracks": false,
  "physicalObjectTemplateIds": ["Template-Neutral-Bird"],
  "ghostTrackSignatureProfile": null,
  "classificationConfusionModifier": 0.2,
  "identificationConfusionModifier": 0.1,
  "durationRange_sec": {
    "min": 30,
    "max": 180
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique clutter field identifier. |
| `type` | Enum | Clutter type. |
| `areaPolygon` | Array[Point] | Area where clutter can appear. |
| `altitudeBand` | Object | Minimum and maximum clutter altitude. |
| `density` | Float | Relative clutter density. |
| `spawnRate_per_min` | Float | Spawn rate. |
| `canSpawnPhysicalObjects` | Boolean | Can create physical objects. |
| `canSpawnGhostTracks` | Boolean | Can create track-only ghosts. |
| `physicalObjectTemplateIds` | Array[String] | Templates used for physical clutter. |
| `ghostTrackSignatureProfile` | Object/null | Signature for ghost tracks. |
| `classificationConfusionModifier` | Float | Classification penalty. |
| `identificationConfusionModifier` | Float | Identification penalty. |
| `durationRange_sec` | Object | Minimum and maximum duration. |

### Clutter Type Enum

```text
Birds
Balloons
Weather
UrbanRF
Foliage
RFNoise
ThermalNoise
GroundTraffic
```

### Clutter Rule

```text
Physical clutter becomes a Physical Object.

Ghost clutter becomes a Track.
```

---

## 12.3 Spectrum Environment

The Spectrum Environment represents shared RF conditions.

```json
{
  "bands": [
    {
      "bandName": "2.4GHz",
      "baseNoise_dB": -90,
      "congestion_dB": 5,
      "blueJammingPower_dB": 0,
      "redJammingPower_dB": 10,
      "affectedSystems": ["FPV", "RF_Passive", "C2"]
    }
  ],
  "gpsDenied": false,
  "commsDenied": false,
  "spoofingActive": false
}
```

| Field | Type | Description |
|---|---|---|
| `bands` | Array | RF bands and conditions. |
| `gpsDenied` | Boolean | GPS denied globally or locally. |
| `commsDenied` | Boolean | Comms denied globally or locally. |
| `spoofingActive` | Boolean | Spoofing environment active. |

### Spectrum Band Fields

| Field | Type | Description |
|---|---|---|
| `bandName` | String | RF band label. |
| `baseNoise_dB` | Float | Noise floor. |
| `congestion_dB` | Float | Added congestion. |
| `blueJammingPower_dB` | Float | Blue jamming power. |
| `redJammingPower_dB` | Float | Red jamming power. |
| `affectedSystems` | Array[String] | Systems affected by this band. |

---

# 13. Network and Grid Controllers

Network and grid controllers are Tier 3 manager objects.

They do not require physical X/Y/Z coordinates unless explicitly modeled as physical infrastructure.

---

## 13.1 Power Grid Object

```json
{
  "id": "Grid-Tactical-Alpha",
  "gridType": "Tactical",
  "totalCapacity_kW": 30,
  "currentLoad_kW": 20,
  "status": "Online",
  "connectedProducerIds": [],
  "connectedConsumerIds": []
}
```

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique grid identifier. |
| `gridType` | Enum | Shore or Tactical. |
| `totalCapacity_kW` | Float | Available power. |
| `currentLoad_kW` | Float | Current demand. |
| `status` | Enum | Online, Overloaded, or Offline. |
| `connectedProducerIds` | Array[String] | Power producers connected to grid. |
| `connectedConsumerIds` | Array[String] | Power consumers connected to grid. |

### Grid Status Enum

```text
Online
Overloaded
Offline
```

---

## 13.2 C2 Network Object

```json
{
  "id": "Blue-C2-Net-01",
  "side": "Blue",
  "networkType": "RF",
  "transmissionLatency_sec": 0.2,
  "networkStatus": "Connected",
  "activeSystemTracks": [],
  "maxTracks": 20
}
```

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique C2 network identifier. |
| `side` | Enum | Blue, Red, or Neutral. |
| `networkType` | Enum | RF, Hardwired, SATCOM, or AutonomousSwarm. |
| `transmissionLatency_sec` | Float | Network transmission delay. |
| `networkStatus` | Enum | Current network status. |
| `activeSystemTracks` | Array[Track] | Tracks currently carried by the network. |
| `maxTracks` | Integer | Maximum track capacity. |

### Network Type Enum

```text
RF
Hardwired
SATCOM
AutonomousSwarm
```

---

# 14. Example Templates

## 14.1 Generic Red FPV UAS Template

```json
{
  "id": "Template-Red-FPV-UAS",
  "name": "Generic Red FPV UAS",
  "category": "UAS",
  "defaultRoles": ["UAS", "Sensor", "Effector"],
  "icon": "base64-inline-icon",
  "components": {
    "health": {
      "maxHealth": 20,
      "armorLevel": 0,
      "assetValue_pts": 5
    },
    "movement": {
      "isMobileXY": true,
      "isMobileZ": true,
      "maxSpeed_mps": 35,
      "maxAccel": 8,
      "turnRate_dps": 90,
      "maxEndurance_sec": 900
    },
    "signature": {
      "radarSignature_dB": -20,
      "thermalSignature_dB": -15,
      "acousticSignature_dB": -10,
      "rfSignature_dB": -5
    },
    "control": {
      "controlMode": "Networked",
      "linkResilience": 0.6,
      "autonomyLogic": "ManualFPV",
      "lostLinkBehavior": "ExecuteTerminalDive"
    },
    "sensors": [
      {
        "type": "FPV",
        "maxRange_m": 1200,
        "fov_azimuth_deg": 90,
        "fov_elevation_deg": 60,
        "txPower_dB": 0,
        "rxThreshold_dB": -80,
        "sweepRate_sec": 1,
        "susceptibleToSpoofing": true,
        "susceptibleToClutter": true,
        "classification": {
          "canClassify": true,
          "classificationLatency_sec": 1.0,
          "classificationAccuracyBase": 0.7
        },
        "identification": {
          "canIdentify": true,
          "identificationLatency_sec": 1.5,
          "identificationAccuracyBase": 0.6
        },
        "fpv": {
          "fpvLatency_sec": 0.15,
          "fpvLinkQuality": 0.8,
          "operatorReactionLatency_sec": 1.0,
          "cameraStatus": "Nominal"
        }
      }
    ],
    "effectors": [
      {
        "type": "TerminalAttack",
        "maxRange_m": 5,
        "basePk": 0.8,
        "basePe": 0,
        "cooldown_sec": 999,
        "effectDuration_sec": 0,
        "effectRadius_m": 5,
        "ammoCapacity": 1,
        "localAutonomousROE": "AutoEngageLocalTracks"
      }
    ],
    "explosive": {
      "payloadYield": 50,
      "explosiveYield": "Low"
    }
  }
}
```

---

## 14.2 Generic Blue Radar Template

```json
{
  "id": "Template-Blue-Radar",
  "name": "Generic Blue Radar",
  "category": "Sensor",
  "defaultRoles": ["Sensor", "Asset"],
  "icon": "base64-inline-icon",
  "components": {
    "health": {
      "maxHealth": 100,
      "armorLevel": 1,
      "assetValue_pts": 50
    },
    "capability": {
      "usesGPS": false,
      "usesNetwork": true,
      "usesRF": true,
      "requiresPower": true,
      "requiresC2": false,
      "canOperateAutonomously": true
    },
    "powerConsumer": {
      "powerConsumed_kW": 5,
      "connectedPowerGridId": "Grid-Tactical-Alpha"
    },
    "network": {
      "networkIds": ["Blue-C2-Net-01"],
      "networkStatus": "Connected"
    },
    "sensors": [
      {
        "type": "Radar",
        "maxRange_m": 5000,
        "fov_azimuth_deg": 120,
        "fov_elevation_deg": 40,
        "txPower_dB": 30,
        "rxThreshold_dB": -90,
        "sweepRate_sec": 2,
        "susceptibleToSpoofing": true,
        "susceptibleToClutter": true,
        "classification": {
          "canClassify": true,
          "classificationLatency_sec": 0,
          "classificationAccuracyBase": 0.6
        },
        "identification": {
          "canIdentify": false,
          "identificationLatency_sec": 0,
          "identificationAccuracyBase": 0
        }
      }
    ]
  }
}
```

---

## 14.3 Generic Blue C-UAS Effector Template

```json
{
  "id": "Template-Blue-CUAS-Kinetic",
  "name": "Generic Blue Kinetic C-UAS System",
  "category": "CUAS",
  "defaultRoles": ["Asset", "Effector"],
  "icon": "base64-inline-icon",
  "components": {
    "health": {
      "maxHealth": 120,
      "armorLevel": 1,
      "assetValue_pts": 60
    },
    "capability": {
      "usesGPS": false,
      "usesNetwork": true,
      "usesRF": false,
      "requiresPower": true,
      "requiresC2": true,
      "canOperateAutonomously": false
    },
    "powerConsumer": {
      "powerConsumed_kW": 10,
      "connectedPowerGridId": "Grid-Tactical-Alpha"
    },
    "network": {
      "networkIds": ["Blue-C2-Net-01"],
      "networkStatus": "Connected"
    },
    "effectors": [
      {
        "type": "Kinetic",
        "maxRange_m": 1500,
        "basePk": 0.7,
        "basePe": 0,
        "cooldown_sec": 2,
        "effectDuration_sec": 0,
        "effectRadius_m": 0,
        "ammoCapacity": 100,
        "localAutonomousROE": "HoldFire",
        "kinetic": {
          "projectileSpeed_mps": 900
        }
      }
    ]
  }
}
```

---

# 15. Processing Chain Reference

This data model supports the following simulation processing chain:

```text
Physical Object Layer
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
C2 Decision Layer
        ↓
Effect Layer
        ↓
Damage Layer
        ↓
Logging Layer
```

All Blue, Red, Neutral, Clutter, Decoy, and Ghost Track interactions should use this chain.
