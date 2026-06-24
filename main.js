
    function createSimulationKernel() {
      const EVENT_PRIORITIES = {
        state: 1,
        sensor: 2,
        track: 3,
        c2: 4,
        movement: 5,
        effector: 6,
        effect: 7,
        damage: 8,
        log: 9
      };

      const MIN_STATE_DELAY_SEC = 0.1;
      const THREAT_SPEED_THRESHOLD_MPS = 5;
      const THREAT_DISTANCE_EPSILON_M = 1;
      const CLASSIFICATION_STALE_SEC = 12;
      const IDENTIFICATION_STALE_SEC = 15;
      const INTENT_STALE_SEC = 6;
      const CLASSIFICATION_CONFIDENCE_DELTA = 0.12;
      const IDENTIFICATION_CONFIDENCE_DELTA = 0.1;
      const TRACK_QUALITY_DELTA = 0.1;
      const INTENT_SPEED_DELTA_MPS = 3;
      const INTENT_HEADING_DELTA_DEG = 18;

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function round(value, decimals = 2) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
      }

      function deepClone(value) {
        if (typeof structuredClone === "function") {
          return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
      }

      function distance3D(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = (b.z || 0) - (a.z || 0);
        return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
      }

      function distance2D(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt((dx * dx) + (dy * dy));
      }

      function subtractVectors(a, b) {
        return {
          x: (a.x || 0) - (b.x || 0),
          y: (a.y || 0) - (b.y || 0),
          z: (a.z || 0) - (b.z || 0)
        };
      }

      function addVectors(a, b) {
        return {
          x: (a.x || 0) + (b.x || 0),
          y: (a.y || 0) + (b.y || 0),
          z: (a.z || 0) + (b.z || 0)
        };
      }

      function scaleVector(vector, scalar) {
        return {
          x: (vector.x || 0) * scalar,
          y: (vector.y || 0) * scalar,
          z: (vector.z || 0) * scalar
        };
      }

      function dotProduct(a, b) {
        return ((a.x || 0) * (b.x || 0)) + ((a.y || 0) * (b.y || 0)) + ((a.z || 0) * (b.z || 0));
      }

      function magnitude3D(vector) {
        return Math.sqrt(dotProduct(vector, vector));
      }

      function magnitude2D(vector) {
        return Math.sqrt(((vector.x || 0) * (vector.x || 0)) + ((vector.y || 0) * (vector.y || 0)));
      }

      function normalizeVector(vector) {
        const magnitude = magnitude3D(vector);
        if (magnitude <= 1e-6) {
          return null;
        }
        return scaleVector(vector, 1 / magnitude);
      }

      function normalizeVector2D(vector) {
        const magnitude = magnitude2D(vector);
        if (magnitude <= 1e-6) {
          return null;
        }
        return {
          x: (vector.x || 0) / magnitude,
          y: (vector.y || 0) / magnitude,
          z: 0
        };
      }

      function dotProduct2D(a, b) {
        return ((a.x || 0) * (b.x || 0)) + ((a.y || 0) * (b.y || 0));
      }

      function angleDeg(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) {
          angle += 360;
        }
        return angle;
      }

      function smallestAngleDifference(a, b) {
        let diff = ((a - b + 540) % 360) - 180;
        if (diff < -180) {
          diff += 360;
        }
        return diff;
      }

      function normalizeHeadingDeg(heading) {
        const numericHeading = Number(heading ?? 0);
        const normalized = (Number.isFinite(numericHeading) ? numericHeading : 0) % 360;
        return normalized < 0 ? normalized + 360 : normalized;
      }

      function ensureArray(value) {
        return Array.isArray(value) ? value : [];
      }

      function normalizeRoles(roles, fallbackRoles = []) {
        if (Array.isArray(roles) && roles.length) {
          return roles.slice();
        }
        return fallbackRoles.slice();
      }

      function normalizeMissionProfile(profile) {
        const type = String(profile?.type || "Geographic");
        return {
          type: ["Geographic", "SpecificAsset", "MaxDamage"].includes(type) ? type : "Geographic",
          targetTemplateId: profile?.targetTemplateId || null
        };
      }

      function normalizeLostLinkBehavior(value) {
        const behavior = String(value || "ContinueDeadReckoning");
        return ["ContinueDeadReckoning", "RTB", "Hover/Loiter", "ExecuteTerminalDive"].includes(behavior)
          ? behavior
          : "ContinueDeadReckoning";
      }

      function normalizePayload(payload) {
        return {
          impactDamagePoints: Number(payload?.impactDamagePoints ?? payload?.damagePoints ?? payload?.payloadYield ?? 0),
          selfDestructOnImpact: payload?.selfDestructOnImpact !== false
        };
      }

      function normalizeResistance(resistance = {}) {
        return {
          kineticResistance: Number(resistance.kineticResistance ?? 0.1),
          ewResistance: Number(resistance.ewResistance ?? 0.1),
          networkResistance: Number(resistance.networkResistance ?? 0.1)
        };
      }

      function normalizeSignature(signature = {}) {
        return {
          radarSignatureDb: Number(signature.radarSignatureDb ?? signature.radarSignature_dB ?? -10),
          acousticSignatureDb: Number(signature.acousticSignatureDb ?? signature.acousticSignature_dB ?? 60),
          rfEmissionDb: Number(signature.rfEmissionDb ?? signature.rfEmission_dB ?? 20)
        };
      }

      function normalizeVulnerability(vulnerability = {}, resistance = {}) {
        const fallbackLinkResilience = vulnerability.linkResilience ?? resistance.linkResilience ?? 0.5;
        return {
          commsResilience: clamp(Number(vulnerability.commsResilience ?? fallbackLinkResilience), 0, 1),
          navResilience: clamp(Number(vulnerability.navResilience ?? fallbackLinkResilience), 0, 1),
          cyberResilience: clamp(Number(vulnerability.cyberResilience ?? fallbackLinkResilience), 0, 1)
        };
      }

      function normalizeCapability(capability, components = {}) {
        const inferredUsesRf = ensureArray(components.sensors).length > 0 || ensureArray(components.effectors).some((effector) => {
          const type = String(effector?.type || "").toUpperCase();
          return ["EW", "JAMMER", "SPOOFER", "CYBER", "RF_PASSIVE", "FPV"].includes(type);
        });
        const inferredNeedsPower = ensureArray(components.sensors).length > 0
          || ensureArray(components.effectors).length > 0
          || Boolean(components.c2);
        const inferredUsesNetwork = Boolean(components.c2) || Boolean(capability?.usesNetwork);
        return {
          usesGPS: capability?.usesGPS !== false,
          usesNetwork: capability?.usesNetwork != null ? !!capability.usesNetwork : inferredUsesNetwork,
          usesRF: capability?.usesRF != null ? !!capability.usesRF : inferredUsesRf,
          requiresPower: capability?.requiresPower != null ? !!capability.requiresPower : inferredNeedsPower,
          requiresC2: !!capability?.requiresC2,
          canOperateAutonomously: capability?.canOperateAutonomously !== false,
          lostLinkBehavior: normalizeLostLinkBehavior(capability?.lostLinkBehavior)
        };
      }

      function normalizeSensorType(type) {
        const rawType = String(type || "Radar").trim();
        const upperType = rawType.toUpperCase();
        const sensorType = ({
          RADAR: "Radar",
          EO_IR: "EO_IR",
          "EO-IR": "EO_IR",
          EOIR: "EO_IR",
          RF: "RF_Passive",
          RF_PASSIVE: "RF_Passive",
          "RF-PASSIVE": "RF_Passive",
          RFPASSIVE: "RF_Passive",
          ACOUSTIC: "Acoustic",
          FPV: "FPV"
        }[upperType] || rawType);
        return ["Radar", "EO_IR", "RF_Passive", "Acoustic", "FPV"].includes(sensorType)
          ? sensorType
          : "Radar";
      }

      function normalizeSensor(sensor, index) {
        const classification = sensor.classification || {};
        const identification = sensor.identification || {};
        return {
          id: sensor.id || "Sensor-" + (index + 1),
          name: sensor.name || sensor.type || ("Sensor " + (index + 1)),
          type: normalizeSensorType(sensor.type),
          maxRangeM: Number(sensor.maxRangeM ?? sensor.maxRange_m ?? 0),
          horizontalFovDeg: Number(sensor.horizontalFovDeg ?? sensor.fov_azimuth_deg ?? 360),
          verticalFovDeg: Number(sensor.verticalFovDeg ?? sensor.fov_elevation_deg ?? 180),
          headingDeg: Number(sensor.headingDeg ?? sensor.heading_deg ?? 0),
          transmitPowerDb: Number(sensor.transmitPowerDb ?? sensor.txPower_dB ?? 0),
          noiseFloorDb: Number(sensor.noiseFloorDb ?? -94),
          noiseSigmaDb: Number(sensor.noiseSigmaDb ?? 1.2),
          detectionThresholdDb: Number(sensor.detectionThresholdDb ?? sensor.thresholdDb ?? 17),
          scanIntervalSec: Number(sensor.scanIntervalSec ?? sensor.sweepRate_sec ?? 1),
          classification: {
            canClassify: classification.canClassify !== false,
            latencySec: Number(classification.latencySec ?? classification.classificationLatency_sec ?? 0.2),
            accuracyBase: Number(classification.accuracyBase ?? classification.classificationAccuracyBase ?? 0.72)
          },
          identification: {
            canIdentify: identification.canIdentify !== false,
            latencySec: Number(identification.latencySec ?? identification.identificationLatency_sec ?? 0.35),
            accuracyBase: Number(identification.accuracyBase ?? identification.identificationAccuracyBase ?? 0.68)
          }
        };
      }

      function normalizeEffectorType(type) {
        const rawType = String(type || "Kinetic").trim();
        const effectorType = ({
          KINETIC: "Kinetic",
          EW: "Jammer",
          JAMMER: "Jammer",
          LASER: "DirectedEnergy",
          DIRECTEDENERGY: "DirectedEnergy",
          DIRECTED_ENERGY: "DirectedEnergy",
          INTERCEPTOR: "Interceptor",
          SPOOFER: "Spoofer",
          CYBER: "Cyber"
        }[rawType.toUpperCase()] || rawType);
        return ["Kinetic", "Jammer", "DirectedEnergy", "Interceptor", "Spoofer", "Cyber"].includes(effectorType)
          ? effectorType
          : "Kinetic";
      }

      function normalizeDeliveryModel(model, effectorType) {
        const rawModel = String(model || "").trim();
        if (["Ballistic", "Guided", "Instant"].includes(rawModel)) {
          return rawModel;
        }
        if (effectorType === "Interceptor") {
          return "Guided";
        }
        if (effectorType === "Kinetic") {
          return "Ballistic";
        }
        return "Instant";
      }

      function normalizeEffector(effector, index) {
        const projectileSpeedMps = Number(
          effector.projectileSpeedMps
          ?? effector.projectileSpeed_mps
          ?? effector.kinetic?.projectileSpeed_mps
          ?? 0
        );
        return {
          id: effector.id || "Effector-" + (index + 1),
          name: effector.name || effector.type || ("Effector " + (index + 1)),
          type: normalizeEffectorType(effector.type),
          maxRangeM: Number(effector.maxRangeM ?? effector.maxRange_m ?? 0),
          basePk: Number(effector.basePk ?? 0),
          basePe: Number(effector.basePe ?? 0),
          damagePoints: Number(effector.damagePoints ?? effector.payloadYield ?? 0),
          ammoCapacity: Number(effector.ammoCapacity ?? 1),
          slewRateSec: Number(effector.slewRateSec ?? effector.slewRate_sec ?? effector.commandDelaySec ?? 0.2),
          cooldownSec: Number(effector.cooldownSec ?? effector.cooldown_sec ?? 1.5),
          projectileSpeedMps: Number.isFinite(projectileSpeedMps) ? projectileSpeedMps : 0,
          terminalRadiusM: Number(effector.terminalRadiusM ?? effector.terminalRadius_m ?? 12),
          maxFlightTimeSec: Number(effector.maxFlightTimeSec ?? effector.maxFlightTime_sec ?? 8),
          effectDurationSec: Number(effector.effectDurationSec ?? effector.effectDuration_sec ?? 6),
          jamStrengthDb: Number(effector.jamStrengthDb ?? effector.jammingPowerDb ?? 8),
          deliveryModel: normalizeDeliveryModel(effector.deliveryModel, normalizeEffectorType(effector.type)),
          guidanceType: ["Autonomous", "Command"].includes(effector.guidanceType) ? effector.guidanceType : "Command",
          affectedDomains: ensureArray(effector.affectedDomains).length
            ? ensureArray(effector.affectedDomains)
            : ({
              Jammer: ["Sensor", "Network", "C2"],
              Spoofer: ["Navigation"],
              Cyber: ["Track", "Telemetry", "C2"]
            }[normalizeEffectorType(effector.type)] || [])
        };
      }

      function pointToSegmentDistance2D(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (dx === 0 && dy === 0) {
          return distance2D(point, start);
        }
        const t = clamp((((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx * dx) + (dy * dy)), 0, 1);
        const projected = {
          x: start.x + (dx * t),
          y: start.y + (dy * t)
        };
        return distance2D(point, projected);
      }

      function createValidationIssue(severity, message, recommendedAction, extras = {}) {
        return {
          severity,
          message,
          recommendedAction: recommendedAction || "",
          targetScreen: extras.targetScreen || null,
          targetId: extras.targetId || null,
          targetLabel: extras.targetLabel || null
        };
      }

      function normalizeScenario(inputScenario) {
        const scenario = deepClone(inputScenario || {});
        scenario.metadata = scenario.metadata || {};
        scenario.metadata.name = scenario.metadata.name || scenario.name || "C-sUAS Tactical Simulator";
        scenario.metadata.description = scenario.metadata.description || "";
        scenario.metadata.notes = Array.isArray(scenario.metadata.notes)
          ? scenario.metadata.notes.join("\n")
          : String(scenario.metadata.notes || "");
        scenario.metadata.tutorial = Array.isArray(scenario.metadata.tutorial)
          ? scenario.metadata.tutorial.join("\n")
          : String(scenario.metadata.tutorial || "");
        scenario.config = scenario.config || {};
        scenario.config.maxTimeSec = Number(scenario.config.maxTimeSec ?? 45);
        scenario.config.trackStaleAfterSec = Number(scenario.config.trackStaleAfterSec ?? 4);
        scenario.config.attackRunRangeM = Number(scenario.config.attackRunRangeM ?? 240);
        scenario.config.projectedPathToleranceM = Number(scenario.config.projectedPathToleranceM ?? 50);
        scenario.environment = scenario.environment || {};
        scenario.environment.baseNoiseDb = Number(scenario.environment.baseNoiseDb ?? 1.8);
        scenario.environment.backgroundImageBase64 = scenario.environment.backgroundImageBase64 || "";
        scenario.environment.mapWidthMeters = Number(scenario.environment.mapWidthMeters ?? 1080);
        scenario.environment.anomalySpawnChance = Number(scenario.environment.anomalySpawnChance ?? 0.35);
        scenario.environment.clutterSpawnChance = Number(scenario.environment.clutterSpawnChance ?? 0.28);
        scenario.environment.placeholderGhostTrack = scenario.environment.placeholderGhostTrack || {
          enabled: false,
          spawnTimeSec: 7,
          posX: 500,
          posY: 180,
          posZ: 110,
          label: "Ghost Track Placeholder"
        };
        scenario.environment.placeholderClutterField = scenario.environment.placeholderClutterField || {
          enabled: false,
          centerX: 410,
          centerY: 430,
          radiusM: 100,
          label: "Clutter Placeholder",
          note: "Placeholder clutter field only; no full clutter object spawning yet."
        };
        scenario.terrainObjects = ensureArray(scenario.terrainObjects).map((terrain, index) => ({
          id: terrain.id || "Terrain-" + (index + 1),
          label: terrain.label || terrain.name || ("Terrain " + (index + 1)),
          interferenceType: ["Block", "Noise", "No"].includes(terrain.interferenceType) ? terrain.interferenceType : "Block",
          clutterPenaltyDb: Number(terrain.clutterPenaltyDb ?? terrain.clutterPenalty_dB ?? 0),
          heightZ: Number(terrain.heightZ ?? 0),
          areaPolygon: ensureArray(terrain.areaPolygon).map((point) => ({
            x: Number(point.x ?? 0),
            y: Number(point.y ?? 0)
          }))
        }));
        scenario.networks = ensureArray(scenario.networks).map((network, index) => ({
          id: network.id || "Network-" + (index + 1),
          name: network.name || ("Network " + (index + 1)),
          type: network.type || "RF",
          transmissionLatencySec: Number(network.transmissionLatencySec ?? network.latencySec ?? 0.25)
        }));
        scenario.powerGrids = ensureArray(scenario.powerGrids).map((grid, index) => ({
          id: grid.id || "PowerGrid-" + (index + 1),
          name: grid.name || ("Power Grid " + (index + 1)),
          type: grid.type || "Tactical"
        }));
        scenario.rosters = ensureArray(scenario.rosters).map((roster, index) => ({
          id: roster.id || "Roster-" + (index + 1),
          side: roster.side || "Neutral",
          items: ensureArray(roster.items).map((item) => ({
            templateId: item.templateId || "",
            quantity: Math.max(1, Math.floor(Number(item.quantity || 1)))
          }))
        }));
        scenario.templates = ensureArray(scenario.templates).map((template, templateIndex) => {
          const components = template.components || {};
          return {
            id: template.id || "Template-" + (templateIndex + 1),
            name: template.name || ("Template " + (templateIndex + 1)),
            category: template.category || "Generic",
            defaultRoles: normalizeRoles(template.defaultRoles, []),
            missionProfile: normalizeMissionProfile(template.missionProfile),
            components: {
              health: {
                maxHealth: Number(components.health?.maxHealth ?? 100),
                assetValuePts: Number(components.health?.assetValuePts ?? components.health?.assetValue_pts ?? 1),
                isHQ: Boolean(components.health?.isHQ)
              },
              resistance: normalizeResistance(components.resistance),
              signature: normalizeSignature(components.signature),
              vulnerability: normalizeVulnerability(components.vulnerability, components.resistance),
              payload: normalizePayload(components.payload),
              capability: normalizeCapability(components.capability, components),
              powerConsumer: {
                powerConsumedKw: Number(components.powerConsumer?.powerConsumedKw ?? components.powerConsumer?.powerConsumed_kW ?? (components.c2 || ensureArray(components.sensors).length || ensureArray(components.effectors).length ? 5 : 0))
              },
              movement: components.movement ? {
                speedMps: Number(components.movement.speedMps ?? components.movement.maxSpeed_mps ?? 0),
                stepSec: Number(components.movement.stepSec ?? 1),
                waypointToleranceM: Number(components.movement.waypointToleranceM ?? 10),
                maxAccel: Number(components.movement.maxAccel ?? components.movement.maxAccel_mps2 ?? 9999),
                turnRate_dps: Number(components.movement.turnRate_dps ?? components.movement.turnRateDps ?? 360),
                maxEnduranceSec: Number(components.movement.maxEnduranceSec ?? components.movement.maxEndurance_sec ?? Number.POSITIVE_INFINITY)
              } : null,
              sensors: ensureArray(components.sensors).map(normalizeSensor),
              effectors: ensureArray(components.effectors).map(normalizeEffector),
              c2: components.c2 ? {
                trackCapacity: Number(components.c2.trackCapacity ?? components.c2.maxTracks ?? 8),
                processingLatencySec: Number(components.c2.processingLatencySec ?? components.c2.processingLatency_sec ?? 0.25)
              } : null
            }
          };
        });

        scenario.instances = ensureArray(scenario.instances).map((instance, instanceIndex) => ({
          id: instance.id || "Instance-" + (instanceIndex + 1),
          templateId: instance.templateId,
          name: instance.name || ("Instance " + (instanceIndex + 1)),
          side: instance.side || "Neutral",
          roles: normalizeRoles(instance.roles, []),
          networkId: instance.networkId || null,
          connectedPowerGridId: instance.connectedPowerGridId || null,
          posX: Number(instance.posX ?? 0),
          posY: Number(instance.posY ?? 0),
          posZ: Number(instance.posZ ?? 0),
          headingDeg: normalizeHeadingDeg(instance.headingDeg ?? instance.heading_deg ?? 0),
          missionWaypoints: ensureArray(instance.missionWaypoints).map((waypoint) => ({
            x: Number(waypoint.x ?? 0),
            y: Number(waypoint.y ?? 0),
            z: Number(waypoint.z ?? 0)
          }))
        }));

        return scenario;
      }

      function validateScenario(inputScenario) {
        const errorIssues = [];
        const warningIssues = [];
        const noteIssues = [];
        const scenario = normalizeScenario(inputScenario);
        const addIssue = (severity, message, recommendedAction, extras = {}) => {
          const issue = createValidationIssue(severity, message, recommendedAction, extras);
          if (severity === "error") {
            errorIssues.push(issue);
          } else if (severity === "warning") {
            warningIssues.push(issue);
          } else {
            noteIssues.push(issue);
          }
        };

        if (!scenario.metadata.name) {
          addIssue("error", "Scenario name is required.", "Add a descriptive scenario name in metadata.", { targetScreen: "wizard" });
        }

        if (!scenario.templates.length) {
          addIssue("error", "At least one template is required.", "Create or import at least one template before running.", { targetScreen: "templates" });
        }

        if (!scenario.instances.length) {
          addIssue("error", "At least one instance is required.", "Use the Scenario Editor or raw JSON import to add Blue and Red instances.", { targetScreen: "wizard" });
        }

        const templateIds = new Set();
        const templateNameMap = new Map();
        scenario.templates.forEach((template) => {
          if (templateIds.has(template.id)) {
            addIssue("error", "Duplicate template id: " + template.id, "Rename one of the duplicate templates so every template id is unique.", {
              targetScreen: "templates",
              targetId: template.id,
              targetLabel: "Open template"
            });
          }
          templateIds.add(template.id);
          if (!Array.isArray(template.defaultRoles)) {
            addIssue("error", "Template " + template.id + " must use roles as an array.", "Replace any single role string with an array of roles.", {
              targetScreen: "templates",
              targetId: template.id,
              targetLabel: "Open template"
            });
          }
          if (!template.components.health || !Number.isFinite(template.components.health.maxHealth)) {
            addIssue("error", "Template " + template.id + " is missing valid health.maxHealth.", "Set a finite max health value for the template.", {
              targetScreen: "templates",
              targetId: template.id,
              targetLabel: "Open template"
            });
          }

          const normalizedTemplateName = String(template.name || "").trim().toLowerCase();
          if (normalizedTemplateName) {
            const templateNameCount = templateNameMap.get(normalizedTemplateName) || 0;
            templateNameMap.set(normalizedTemplateName, templateNameCount + 1);
          }

          if ((template.components.sensors || []).length > 0) {
            template.components.sensors.forEach((sensor) => {
              if (!(sensor.maxRangeM > 0)) {
                addIssue("warning", "Template " + template.id + " has a sensor with no usable range.", "Set sensor.maxRangeM above zero so detections are plausible.", {
                  targetScreen: "templates",
                  targetId: template.id,
                  targetLabel: "Open template"
                });
              }
            });
          }

          if ((template.components.effectors || []).length > 0) {
            template.components.effectors.forEach((effector) => {
              if ((effector.maxRangeM > 0) && !(effector.ammoCapacity > 0)) {
                addIssue("warning", "Template " + template.id + " has an effector with range but no usable ammo.", "Increase ammoCapacity or remove the effector from the template.", {
                  targetScreen: "templates",
                  targetId: template.id,
                  targetLabel: "Open template"
                });
              }
              if (String(effector.type || "").toLowerCase() === "kinetic" && effector.maxRangeM > 0 && !(effector.projectileSpeedMps > 0)) {
                addIssue("warning", "Template " + template.id + " has a kinetic effector without projectile speed.", "Set projectileSpeedMps so time-to-effect remains meaningful.", {
                  targetScreen: "templates",
                  targetId: template.id,
                  targetLabel: "Open template"
                });
              }
            });
          }

          if (template.components.c2 && !(template.components.sensors || []).length && !(template.components.effectors || []).length) {
            addIssue("warning", "Template " + template.id + " has C2 but no local sensors or effectors.", "Confirm this is intentional, or add the sensing / firing components that support the node.", {
              targetScreen: "templates",
              targetId: template.id,
              targetLabel: "Open template"
            });
          }
        });

        const instanceIds = new Set();
        const instanceNameMap = new Map();
        let blueCount = 0;
        let redCount = 0;
        let sensorCount = 0;
        let blueC2Count = 0;
        let redC2Count = 0;
        let effectorCount = 0;
        const blueAssets = [];
        const blueSitesWithCoverage = new Set();
        const redThreatRouteResults = [];
        let redC2DependentStrikeCount = 0;

        scenario.instances.forEach((instance) => {
          if (instanceIds.has(instance.id)) {
            addIssue("error", "Duplicate instance id: " + instance.id, "Rename one of the duplicate instances so every instance id is unique.", {
              targetScreen: "wizard",
              targetId: instance.id,
              targetLabel: "Open wizard"
            });
          }
          instanceIds.add(instance.id);

          if (!templateIds.has(instance.templateId)) {
            addIssue("error", "Instance " + instance.id + " references missing template " + instance.templateId + ".", "Update the instance templateId or recreate the missing template.", {
              targetScreen: "templates",
              targetId: instance.templateId,
              targetLabel: "Open templates"
            });
          }

          if (!Array.isArray(instance.roles)) {
            addIssue("error", "Instance " + instance.id + " must use roles as an array.", "Convert any single role string to an array of roles.", {
              targetScreen: "wizard",
              targetId: instance.id,
              targetLabel: "Open wizard"
            });
          }

          ["posX", "posY", "posZ"].forEach((field) => {
            if (!Number.isFinite(instance[field])) {
              addIssue("error", "Instance " + instance.id + " has invalid " + field + ".", "Replace invalid coordinates with finite numeric values.", {
                targetScreen: "wizard",
                targetId: instance.id,
                targetLabel: "Open wizard"
              });
            }
          });

          if (instance.side === "Blue") {
            blueCount += 1;
          } else if (instance.side === "Red") {
            redCount += 1;
          }

          const template = scenario.templates.find((candidate) => candidate.id === instance.templateId);
          if (template) {
            const normalizedInstanceName = String(instance.name || "").trim().toLowerCase();
            if (normalizedInstanceName) {
              const instanceNameCount = instanceNameMap.get(normalizedInstanceName) || 0;
              instanceNameMap.set(normalizedInstanceName, instanceNameCount + 1);
            }
            if ((template.components.sensors || []).length) {
              sensorCount += 1;
            }
            if ((template.components.effectors || []).length) {
              effectorCount += 1;
            }
            if (template.components.c2) {
              if (instance.side === "Blue") {
                blueC2Count += 1;
              } else if (instance.side === "Red") {
                redC2Count += 1;
              }
            }
            if (instance.side === "Blue") {
              blueAssets.push({ instance, template });
            }
            if (
              instance.side === "Red"
              && instance.roles.includes("UAS")
              && template.components.capability?.requiresC2
            ) {
              redC2DependentStrikeCount += 1;
            }
            if (
              instance.side === "Red"
              && instance.roles.includes("UAS")
              && template.missionProfile?.type !== "Geographic"
              && Number(template.components.payload?.impactDamagePoints || 0) <= 0
            ) {
              addIssue("warning", "Red strike instance " + instance.id + " has no terminal impact payload.", "Set components.payload.impactDamagePoints on the Red template so one-way attack runs can damage their target.", {
                targetScreen: "templates",
                targetId: template.id,
                targetLabel: "Open templates"
              });
            }
            if (instance.side === "Red" && !instance.missionWaypoints.length) {
              addIssue("warning", "Red instance " + instance.id + " has no mission waypoints.", "Add at least one waypoint so the threat produces meaningful pathing and intent behavior.", {
                targetScreen: "wizard",
                targetId: instance.id,
                targetLabel: "Open wizard"
              });
            }
          }
        });

        if (blueCount === 0) {
          addIssue("error", "At least one Blue instance is required.", "Add a Blue instance that can defend or represent a defended asset.", { targetScreen: "wizard" });
        }
        if (redCount === 0) {
          addIssue("error", "At least one Red instance is required.", "Add a Red threat instance so the scenario has something to evaluate.", { targetScreen: "wizard" });
        }
        if (sensorCount === 0) {
          addIssue("error", "At least one sensor-bearing object is required.", "Add a sensor to a Blue template or import a scenario with sensor coverage.", { targetScreen: "templates" });
        }
        if (blueC2Count === 0) {
          addIssue("warning", "No Blue C2-capable object was found; Blue autonomous engagements will not occur.", "Add a C2 component to at least one Blue template if you expect autonomous tasking.", {
            targetScreen: "templates",
            targetLabel: "Open templates"
          });
        }
        if (redC2DependentStrikeCount > 0 && redC2Count === 0) {
          addIssue("warning", "Red strike objects require C2 but no Red C2-capable object was found.", "Add a Red C2 template/object or remove the requiresC2 dependency so Red can fall back cleanly.", {
            targetScreen: "templates",
            targetLabel: "Open templates"
          });
        }
        if (effectorCount === 0) {
          addIssue("note", "No effector-bearing object was found.", "This is acceptable for detection-only reviews, but no threat will be defeated.", {
            targetScreen: "templates",
            targetLabel: "Open templates"
          });
        }
        scenario.terrainObjects.forEach((terrain) => {
          if (terrain.areaPolygon.length > 0 && terrain.areaPolygon.length < 3) {
            addIssue("warning", "Terrain " + terrain.id + " has fewer than 3 vertices.", "Add at least three map clicks or clear the polygon before running.", {
              targetScreen: "wizard",
              targetId: terrain.id,
              targetLabel: "Open terrain"
            });
          }
        });
        blueAssets.forEach(({ instance: blueInstance }) => {
          scenario.terrainObjects.forEach((terrain) => {
            if (
              terrain.interferenceType === "Block"
              && terrain.areaPolygon.length >= 3
              && pointInPolygon({ x: blueInstance.posX, y: blueInstance.posY }, terrain.areaPolygon)
              && Number(terrain.heightZ || 0) >= Number(blueInstance.posZ || 0)
            ) {
              addIssue("warning", "Blocking terrain " + terrain.id + " overlaps Blue asset " + blueInstance.id + " at or above asset altitude.", "Lower the terrain height, move the asset, or treat the polygon as a non-blocking visual shell if it is meant to represent FOB walls.", {
                targetScreen: "wizard",
                targetId: terrain.id,
                targetLabel: "Open terrain"
              });
            }
          });
        });
        scenario.instances
          .filter((instance) => instance.side === "Red")
          .forEach((instance) => {
            const start = { x: instance.posX, y: instance.posY };
            const waypoints = instance.missionWaypoints.length ? instance.missionWaypoints : [{ x: instance.posX, y: instance.posY }];
            let threatensBlueAsset = false;
            let hasBlueCoverage = false;
            let previous = start;
            waypoints.forEach((waypoint) => {
              const current = { x: waypoint.x, y: waypoint.y };
              blueAssets.forEach(({ instance: blueInstance, template }) => {
                const bluePoint = { x: blueInstance.posX, y: blueInstance.posY };
                const pathDistance = pointToSegmentDistance2D(bluePoint, previous, current);
                if (pathDistance <= scenario.config.projectedPathToleranceM) {
                  threatensBlueAsset = true;
                }
                const bestCoverageRange = Math.max(
                  ...[]
                    .concat(template.components.sensors || [])
                    .concat(template.components.effectors || [])
                    .map((component) => Number(component.maxRangeM || 0)),
                  0
                );
                if (pathDistance <= bestCoverageRange) {
                  hasBlueCoverage = true;
                  blueSitesWithCoverage.add(blueInstance.id);
                }
              });
              previous = current;
            });

            redThreatRouteResults.push({ instanceId: instance.id, threatensBlueAsset, hasBlueCoverage });
            if (!threatensBlueAsset) {
              addIssue("warning", "Red instance " + instance.id + " does not currently threaten a Blue asset in XY pathing.", "Adjust its route or defended-asset placement if this run is meant to test TEWA and intent behavior.", {
                targetScreen: "wizard",
                targetId: instance.id,
                targetLabel: "Open wizard"
              });
            }
            if (!hasBlueCoverage) {
              addIssue("warning", "Red instance " + instance.id + " has no meaningful Blue sensor or effector coverage along its route.", "Move the threat, extend coverage, or accept that this scenario is designed to show a coverage gap.", {
                targetScreen: "wizard",
                targetId: instance.id,
                targetLabel: "Open wizard"
              });
            }
          });

        templateNameMap.forEach((count, name) => {
          if (count > 1) {
            addIssue("note", "Multiple templates share the name \"" + name + "\".", "Unique template names make report review and export sharing easier.", {
              targetScreen: "templates",
              targetLabel: "Open templates"
            });
          }
        });

        instanceNameMap.forEach((count, name) => {
          if (count > 1) {
            addIssue("note", "Multiple instances share the name \"" + name + "\".", "Unique instance names make event logs easier to interpret.", {
              targetScreen: "wizard",
              targetLabel: "Open wizard"
            });
          }
        });

        if (blueAssets.length <= 1) {
          addIssue("note", "Only one Blue defended asset is present.", "That is fine for baseline runs, but TEWA prioritization is easier to evaluate with multiple defended assets.", {
            targetScreen: "wizard",
            targetLabel: "Open wizard"
          });
        }

        return {
          valid: errorIssues.length === 0,
          errors: errorIssues.map((issue) => issue.message),
          warnings: warningIssues.map((issue) => issue.message),
          notes: noteIssues.map((issue) => issue.message),
          issues: {
            errors: errorIssues,
            warnings: warningIssues,
            notes: noteIssues
          },
          scenario
        };
      }

      function buildBaselineScenario() {
        return normalizeScenario({
          metadata: {
            name: "FOB Defense (Swarm Attack)",
            description: "Blue defends a forward operating base against a Red recon drone and a three-drone kamikaze swarm."
          },
          config: {
            maxTimeSec: 70,
            trackStaleAfterSec: 4,
            attackRunRangeM: 240,
            projectedPathToleranceM: 50
          },
          environment: {
            baseNoiseDb: 1.8,
            mapWidthMeters: 1080,
            backgroundImageBase64: "",
            placeholderGhostTrack: {
              enabled: false,
              spawnTimeSec: 7,
              posX: 505,
              posY: 182,
              posZ: 110,
              label: "Ghost Track Placeholder"
            },
            placeholderClutterField: {
              enabled: false,
              centerX: 410,
              centerY: 430,
              radiusM: 100,
              label: "Clutter Placeholder",
              note: "Visual placeholder for future clutter field behavior."
            }
          },
          networks: [],
          powerGrids: [],
          rosters: [],
          terrainObjects: [
            {
              id: "Terrain-Woods",
              label: "North Woods",
              interferenceType: "Noise",
              clutterPenaltyDb: 7,
              heightZ: 28,
              areaPolygon: [
                { x: 150, y: 120 },
                { x: 310, y: 110 },
                { x: 335, y: 255 },
                { x: 185, y: 285 }
              ]
            },
            {
              id: "Terrain-Village",
              label: "Village",
              interferenceType: "Block",
              clutterPenaltyDb: 4,
              heightZ: 18,
              areaPolygon: [
                { x: 410, y: 120 },
                { x: 560, y: 120 },
                { x: 575, y: 250 },
                { x: 425, y: 255 }
              ]
            },
            {
              id: "Terrain-Hill",
              label: "East Hill",
              interferenceType: "Noise",
              clutterPenaltyDb: 3,
              heightZ: 95,
              areaPolygon: [
                { x: 745, y: 180 },
                { x: 900, y: 145 },
                { x: 950, y: 310 },
                { x: 770, y: 335 }
              ]
            },
            {
              id: "Terrain-FOB-Walls",
              label: "FOB Walls",
              interferenceType: "Block",
              clutterPenaltyDb: 0,
              heightZ: 12,
              areaPolygon: [
                { x: 520, y: 260 },
                { x: 720, y: 260 },
                { x: 720, y: 420 },
                { x: 520, y: 420 }
              ]
            }
          ],
          templates: [
            {
              id: "Template-Blue-C2-Node",
              name: "C2 Node",
              defaultRoles: ["Asset", "C2"],
              components: {
                health: { maxHealth: 130, assetValuePts: 120, isHQ: true },
                resistance: { kineticResistance: 0.15 },
                signature: { radarSignatureDb: -6 },
                sensors: [],
                effectors: [],
                c2: { trackCapacity: 10, processingLatencySec: 0.25 }
              }
            },
            {
              id: "Template-Blue-Early-Warning",
              name: "Early Warning Radar",
              defaultRoles: ["Sensor"],
              components: {
                health: { maxHealth: 90, assetValuePts: 22, isHQ: false },
                resistance: { kineticResistance: 0.08 },
                signature: { radarSignatureDb: -4 },
                sensors: [
                  {
                    id: "Sensor-Blue-EWR-1",
                    name: "Early Warning Radar",
                    type: "Radar",
                    maxRangeM: 2000,
                    horizontalFovDeg: 360,
                    verticalFovDeg: 120,
                    headingDeg: 0,
                    transmitPowerDb: 57,
                    noiseFloorDb: -94,
                    noiseSigmaDb: 1.1,
                    detectionThresholdDb: 16,
                    scanIntervalSec: 1,
                    classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.82 },
                    identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.75 }
                  }
                ],
                effectors: [],
                c2: null
              }
            },
            {
              id: "Template-Blue-Point-Defense",
              name: "Point Defense Gun",
              defaultRoles: ["Effector"],
              components: {
                health: { maxHealth: 80, assetValuePts: 18, isHQ: false },
                resistance: { kineticResistance: 0.18 },
                signature: { radarSignatureDb: -5 },
                sensors: [],
                effectors: [
                  {
                    id: "Effector-Blue-PDG-1",
                    name: "Point Defense Gun",
                    type: "Kinetic",
                    maxRangeM: 600,
                    basePk: 0.72,
                    damagePoints: 110,
                    ammoCapacity: 8,
                    slewRateSec: 0.15,
                    cooldownSec: 1.5,
                    projectileSpeedMps: 900,
                    guidanceType: "Command"
                  }
                ],
                c2: null
              }
            },
            {
              id: "Template-Blue-Adaptive-Jammer",
              name: "Adaptive Jammer",
              defaultRoles: ["Effector"],
              components: {
                health: { maxHealth: 70, assetValuePts: 16, isHQ: false },
                resistance: { kineticResistance: 0.1 },
                signature: { radarSignatureDb: -8 },
                sensors: [],
                effectors: [
                  {
                    id: "Effector-Blue-Jammer-1",
                    name: "Adaptive Jammer",
                    type: "Jammer",
                    maxRangeM: 800,
                    basePe: 0.66,
                    damagePoints: 0,
                    ammoCapacity: 4,
                    slewRateSec: 0.2,
                    cooldownSec: 3,
                    effectDurationSec: 8,
                    jamStrengthDb: 12,
                    affectedDomains: ["Sensor", "Network", "C2", "Navigation"]
                  }
                ],
                c2: null
              }
            },
            {
              id: "Template-Red-Recon-Drone",
              name: "Recon Drone",
              defaultRoles: ["UAS", "Sensor"],
              missionProfile: {
                type: "Geographic",
                targetTemplateId: null
              },
              components: {
                health: { maxHealth: 70, assetValuePts: 10, isHQ: false },
                resistance: { kineticResistance: 0.15 },
                signature: { radarSignatureDb: -16, acousticSignatureDb: -18, rfEmissionDb: -18 },
                vulnerability: { commsResilience: 0.45, navResilience: 0.55, cyberResilience: 0.5 },
                payload: { impactDamagePoints: 0, selfDestructOnImpact: false },
                capability: {
                  usesGPS: true,
                  usesNetwork: true,
                  usesRF: true,
                  requiresPower: false,
                  requiresC2: true,
                  canOperateAutonomously: true
                },
                movement: {
                  speedMps: 24,
                  stepSec: 1,
                  waypointToleranceM: 10
                },
                sensors: [
                  {
                    id: "Sensor-Red-Recon-1",
                    name: "Recon EO Sensor",
                    type: "EO_IR",
                    maxRangeM: 1600,
                    horizontalFovDeg: 300,
                    verticalFovDeg: 120,
                    headingDeg: 0,
                    transmitPowerDb: 49,
                    noiseFloorDb: -95,
                    noiseSigmaDb: 1.0,
                    detectionThresholdDb: 16,
                    scanIntervalSec: 1,
                    classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.78 },
                    identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.7 }
                  }
                ],
                effectors: []
              }
            },
            {
              id: "Template-Red-C2-Node",
              name: "Red C2 Node",
              defaultRoles: ["C2", "Asset"],
              components: {
                health: { maxHealth: 95, assetValuePts: 15, isHQ: false },
                resistance: { kineticResistance: 0.1 },
                signature: { radarSignatureDb: -10 },
                sensors: [],
                effectors: [],
                c2: { trackCapacity: 8, processingLatencySec: 0.25 }
              }
            },
            {
              id: "Template-Red-Swarm-Kamikaze",
              name: "Kamikaze Drone",
              defaultRoles: ["UAS"],
              missionProfile: {
                type: "MaxDamage",
                targetTemplateId: null
              },
              components: {
                health: { maxHealth: 85, assetValuePts: 12, isHQ: false },
                resistance: { kineticResistance: 0.12 },
                signature: { radarSignatureDb: -12, acousticSignatureDb: -15, rfEmissionDb: -10 },
                vulnerability: { commsResilience: 0.5, navResilience: 0.48, cyberResilience: 0.44 },
                payload: { impactDamagePoints: 140, selfDestructOnImpact: true },
                capability: {
                  usesGPS: true,
                  usesNetwork: true,
                  usesRF: true,
                  requiresPower: false,
                  requiresC2: true,
                  canOperateAutonomously: true
                },
                movement: {
                  speedMps: 40,
                  stepSec: 1,
                  waypointToleranceM: 10
                },
                sensors: [],
                effectors: []
              }
            }
          ],
          instances: [
            {
              id: "Blue-C2-01",
              templateId: "Template-Blue-C2-Node",
              name: "C2 Node",
              side: "Blue",
              roles: ["Asset", "C2"],
              posX: 580,
              posY: 330,
              posZ: 20,
              missionWaypoints: []
            },
            { id: "Blue-EWR-01", templateId: "Template-Blue-Early-Warning", name: "Early Warning Radar", side: "Blue", roles: ["Sensor"], posX: 520, posY: 310, posZ: 24, missionWaypoints: [] },
            { id: "Blue-PDG-01", templateId: "Template-Blue-Point-Defense", name: "Point Defense Gun 01", side: "Blue", roles: ["Effector"], posX: 555, posY: 360, posZ: 18, missionWaypoints: [] },
            { id: "Blue-PDG-02", templateId: "Template-Blue-Point-Defense", name: "Point Defense Gun 02", side: "Blue", roles: ["Effector"], posX: 610, posY: 365, posZ: 18, missionWaypoints: [] },
            { id: "Blue-Jammer-01", templateId: "Template-Blue-Adaptive-Jammer", name: "Adaptive Jammer", side: "Blue", roles: ["Effector"], posX: 640, posY: 300, posZ: 18, missionWaypoints: [] },
            {
              id: "Red-Recon-01",
              templateId: "Template-Red-Recon-Drone",
              name: "Recon Drone",
              side: "Red",
              roles: ["UAS", "Sensor"],
              posX: 75,
              posY: 120,
              posZ: 140,
              missionWaypoints: [
                { x: 240, y: 170, z: 140 },
                { x: 360, y: 220, z: 120 },
                { x: 470, y: 260, z: 110 }
              ]
            },
            {
              id: "Red-C2-01",
              templateId: "Template-Red-C2-Node",
              name: "Red C2 Node",
              side: "Red",
              roles: ["C2", "Asset"],
              posX: 115,
              posY: 80,
              posZ: 28,
              missionWaypoints: []
            },
            {
              id: "Red-Swarm-01",
              templateId: "Template-Red-Swarm-Kamikaze",
              name: "Swarm Group 01",
              side: "Red",
              roles: ["UAS"],
              posX: 40,
              posY: 500,
              posZ: 150,
              missionWaypoints: [
                { x: 290, y: 450, z: 135 },
                { x: 470, y: 390, z: 110 },
                { x: 610, y: 335, z: 90 }
              ]
            },
            {
              id: "Red-Swarm-02",
              templateId: "Template-Red-Swarm-Kamikaze",
              name: "Swarm Group 02",
              side: "Red",
              roles: ["UAS"],
              posX: 65,
              posY: 560,
              posZ: 150,
              missionWaypoints: [
                { x: 305, y: 500, z: 135 },
                { x: 505, y: 425, z: 110 },
                { x: 655, y: 355, z: 90 }
              ]
            },
            {
              id: "Red-Swarm-03",
              templateId: "Template-Red-Swarm-Kamikaze",
              name: "Swarm Group 03",
              side: "Red",
              roles: ["UAS"],
              posX: 110,
              posY: 615,
              posZ: 150,
              missionWaypoints: [
                { x: 345, y: 545, z: 135 },
                { x: 540, y: 465, z: 110 },
                { x: 690, y: 360, z: 90 }
              ]
            }
          ]
        });
      }

      function buildDemoScenario() {
        return buildBaselineScenario();
      }

      function buildScratchScenario() {
        return normalizeScenario({
          metadata: {
            name: "Blank Scratch Scenario",
            description: "Empty starting point for terrain and object authoring."
          },
          config: {
            maxTimeSec: 55,
            trackStaleAfterSec: 4,
            attackRunRangeM: 240,
            projectedPathToleranceM: 50
          },
          environment: {
            baseNoiseDb: 1.8,
            mapWidthMeters: 1080,
            backgroundImageBase64: "",
            placeholderGhostTrack: {
              enabled: false,
              spawnTimeSec: 7,
              posX: 505,
              posY: 182,
              posZ: 110,
              label: "Ghost Track Placeholder"
            },
            placeholderClutterField: {
              enabled: false,
              centerX: 410,
              centerY: 430,
              radiusM: 100,
              label: "Clutter Placeholder",
              note: "Visual placeholder for future clutter field behavior."
            }
          },
          networks: [],
          powerGrids: [],
          rosters: [],
          terrainObjects: [],
          templates: [],
          instances: []
        });
      }

      function getObject(world, objectId) {
        return world.objects[objectId] || null;
      }

      function getTrack(world, trackId) {
        return world.blueTracks?.[trackId] || world.redTracks?.[trackId] || null;
      }

      function getTracksForSide(world, side) {
        if (side === "Red") {
          return Object.values(world.redTracks || {});
        }
        if (side === "Blue") {
          return Object.values(world.blueTracks || {});
        }
        return [];
      }

      function getAllTracks(world) {
        return [
          ...Object.values(world.blueTracks || {}),
          ...Object.values(world.redTracks || {})
        ];
      }

      function getTracksForObject(world, objectId) {
        return getAllTracks(world).filter((track) => track.realObjectId === objectId);
      }

      function getSensor(world, objectId, sensorId) {
        const object = getObject(world, objectId);
        if (!object) {
          return null;
        }
        return (object.components.sensors || []).find((sensor) => sensor.id === sensorId) || null;
      }

      function getSensorRuntimeState(object, sensorId) {
        return object?.runtime?.sensorStates?.[sensorId] || null;
      }

      function getOpposingSide(side) {
        if (side === "Blue") {
          return "Red";
        }
        if (side === "Red") {
          return "Blue";
        }
        return "Neutral";
      }

      function getObjectsForSide(world, side) {
        return world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === side && !object.runtime.destroyed);
      }

      function getSideAssets(world, side) {
        return getObjectsForSide(world, side)
          .filter((object) => object.roles.includes("Asset"));
      }

      function getEffectorRuntimeState(object, effectorId) {
        return object?.runtime?.effectorStates?.[effectorId] || null;
      }

      function getObjectSideById(world, objectId) {
        return world.objects[objectId]?.side || null;
      }

      function inferLogSide(world, data = {}) {
        if (data.side) {
          return data.side;
        }
        if (data.trackId) {
          const track = getTrack(world, data.trackId);
          if (track?.owningSide) {
            return track.owningSide;
          }
        }
        const candidateIds = [
          data.objectId,
          data.observerId,
          data.shooterId,
          data.hostId,
          data.c2ObjectId,
          data.targetId
        ];
        for (const candidateId of candidateIds) {
          const side = getObjectSideById(world, candidateId);
          if (side) {
            return side;
          }
        }
        return "Neutral";
      }

      function isOpticalSensor(sensor) {
        const type = String(sensor?.type || "").toUpperCase();
        return type === "EO_IR" || type === "FPV";
      }

      function isRfPassiveSensor(sensor) {
        return String(sensor?.type || "").toUpperCase() === "RF_PASSIVE";
      }

      function isAcousticSensor(sensor) {
        return String(sensor?.type || "").toUpperCase() === "ACOUSTIC";
      }

      function isDirectedEnergyEffector(effector) {
        return String(effector?.type || "").toUpperCase() === "DIRECTEDENERGY";
      }

      function getObjectEmissionState(object) {
        if (!object) {
          return { radioSilent: true, navigationCompromised: false, telemetryCompromised: false };
        }
        const controlMode = String(object.runtime?.controlMode || "");
        return {
          radioSilent: !object.components?.capability?.usesRF || ["AutonomousFallback", "HeuristicFallback", "Jammed/Severed"].includes(controlMode),
          navigationCompromised: Boolean(object.runtime?.spoofedOffset && !object.runtime?.spoofRestored),
          telemetryCompromised: Boolean(object.runtime?.telemetrySpoofed && !object.runtime?.telemetryRestored)
        };
      }

      function getTrackObservedPosition(world, observerSide, target) {
        if (
          observerSide === target?.side
          && target?.runtime?.telemetrySpoofed
          && target.runtime.telemetryOffsetXY
        ) {
          return {
            x: (target.runtime.position.x || 0) + Number(target.runtime.telemetryOffsetXY.x || 0),
            y: (target.runtime.position.y || 0) + Number(target.runtime.telemetryOffsetXY.y || 0),
            z: target.runtime.position.z || 0
          };
        }
        return deepClone(target?.runtime?.position || { x: 0, y: 0, z: 0 });
      }

      function syncFpvSensorHeading(object, headingDeg) {
        (object?.components?.sensors || []).forEach((sensor) => {
          if (String(sensor.type || "").toUpperCase() === "FPV") {
            sensor.headingDeg = round(headingDeg, 2);
          }
        });
      }

      function clearEffectorAssignment(object, effectorId, world) {
        const effectorState = getEffectorRuntimeState(object, effectorId);
        if (!effectorState) {
          return;
        }
        const lockedTrack = effectorState.lockedTrackId ? getTrack(world, effectorState.lockedTrackId) : null;
        if (lockedTrack) {
          lockedTrack.pendingEngagement = false;
        }
        effectorState.missionState = "Idle";
        effectorState.lockedTrackId = null;
        effectorState.lockedTargetId = null;
        effectorState.inFlightChildId = null;
      }

      function markObjectDestroyed(world, object, operationalStatus = "Destroyed") {
        if (!object || object.runtime.destroyed) {
          return false;
        }
        object.runtime.health = 0;
        object.runtime.destroyed = true;
        object.runtime.operationalStatus = operationalStatus;
        object.runtime.behaviorTargetId = null;
        if (operationalStatus === "Expended On Impact") {
          object.runtime.behaviorState = "Expended";
        }
        getTracksForObject(world, object.id).forEach((track) => {
          track.status = "Destroyed";
          track.pendingEngagement = false;
        });
        return true;
      }

      function applyDamageEvent(world, payload, timeSec, services) {
        const target = getObject(world, payload.targetId);
        const track = getTrack(world, payload.trackId);
        if (!target) {
          return;
        }

        if (!payload.hit) {
          services.logger.record(
            world,
            timeSec,
            "damage",
            target.name + " was not damaged",
            { targetId: target.id, remainingHealth: target.runtime.health }
          );
          return;
        }

        target.runtime.health = Math.max(0, target.runtime.health - payload.damagePoints);
        world.metrics.damageResolutions += 1;
        if (target.runtime.health <= 0) {
          markObjectDestroyed(world, target, "Destroyed");
          if (target.side === "Red") {
            world.metrics.targetsDestroyed += 1;
            world.metrics.killTimeSec = round(timeSec, 2);
          }
          services.logger.record(
            world,
            timeSec,
            "damage",
            target.name + " was destroyed",
            { targetId: target.id, trackId: track ? track.id : null, sourceMode: payload.sourceMode || null }
          );

          const explosiveYield = String(
            target.components?.payload?.explosiveYield
            ?? target.components?.health?.explosiveYield
            ?? ""
          ).trim().toLowerCase();
          const blastProfile = ({
            high: { radiusM: 100, damagePoints: 500 },
            medium: { radiusM: 50, damagePoints: 100 },
            low: { radiusM: 20, damagePoints: 25 }
          }[explosiveYield] || null);
          if (blastProfile) {
            const blastOrigin = target.runtime.position || { x: 0, y: 0, z: 0 };
            const affectedObjectIds = world.objectIds.slice();
            affectedObjectIds.forEach((objectId) => {
              if (objectId === target.id) {
                return;
              }
              const affectedObject = getObject(world, objectId);
              if (!affectedObject || affectedObject.runtime.destroyed) {
                return;
              }
              if (distance3D(blastOrigin, affectedObject.runtime.position) > blastProfile.radiusM) {
                return;
              }
              services.events.schedule({
                time: round(timeSec + 0.1, 3),
                type: "damage.resolve",
                priority: EVENT_PRIORITIES.damage,
                payload: {
                  targetId: affectedObject.id,
                  trackId: null,
                  hit: true,
                  damagePoints: blastProfile.damagePoints,
                  sourceObjectId: target.id,
                  sourceMode: "secondary-explosion"
                }
              });
            });
          }
        } else {
          services.logger.record(
            world,
            timeSec,
            "damage",
            target.name + " survived with " + round(target.runtime.health, 2) + " health",
            { targetId: target.id, remainingHealth: round(target.runtime.health, 2) }
          );
        }

        services.captureFrame(world, timeSec, "damage");
      }

      function removeRuntimeObject(world, objectId) {
        delete world.objects[objectId];
        world.objectIds = world.objectIds.filter((candidateId) => candidateId !== objectId);
      }

      function getInfrastructureForSide(world, side) {
        return world.infrastructure?.[side] || null;
      }

      function getNetworkState(world, side, timeSec = 0) {
        const network = getInfrastructureForSide(world, side)?.network;
        if (!network) {
          return { status: "Disconnected", latencySec: 999, noisePenaltyDb: 0 };
        }
        if (timeSec < (network.jammedUntilSec || 0)) {
          return {
            status: "Jammed",
            latencySec: Number(network.transmissionLatencySec || 0.25) + 1.5,
            noisePenaltyDb: Number(network.sensorNoisePenaltyDb || 0)
          };
        }
        if (timeSec < (network.degradedUntilSec || 0)) {
          return {
            status: "Degraded",
            latencySec: Number(network.transmissionLatencySec || 0.25) + 0.75,
            noisePenaltyDb: Number(network.sensorNoisePenaltyDb || 0)
          };
        }
        return {
          status: "Connected",
          latencySec: Number(network.transmissionLatencySec || 0.25),
          noisePenaltyDb: 0
        };
      }

      function hasOperationalPower(world, object) {
        if (!object?.components?.capability?.requiresPower) {
          return true;
        }
        const power = getInfrastructureForSide(world, object.side)?.power;
        return Boolean(power && power.status === "Online");
      }

      function hasNetworkAccess(world, object, timeSec = 0) {
        if (!object?.components?.capability?.usesNetwork && !object?.components?.capability?.requiresC2) {
          return true;
        }
        const state = getNetworkState(world, object.side, timeSec);
        return state.status === "Connected" || state.status === "Degraded";
      }

      function canObjectAct(world, object, timeSec = 0) {
        return Boolean(object && !object.runtime.destroyed && hasOperationalPower(world, object) && hasNetworkAccess(world, object, timeSec));
      }

      function setObjectControlMode(world, object, mode, timeSec, services, reason) {
        if (!object?.runtime) {
          return;
        }
        if (object.runtime.controlMode === mode) {
          return;
        }
        if (mode === "AutonomousFallback" || mode === "HeuristicFallback") {
          world.metrics.fallbackTransitions += 1;
        }
        object.runtime.controlMode = mode;
        services.logger.record(
          world,
          timeSec,
          "c2",
          object.name + " transitioned to " + mode,
          {
            objectId: object.id,
            side: object.side,
            reason: reason || "control-state-change"
          }
        );
      }

      function restoreObjectControlMode(world, object, timeSec, services, reason) {
        if (!object?.runtime) {
          return;
        }
        if (object.components.capability?.requiresC2 && canObjectAct(world, object, timeSec)) {
          setObjectControlMode(world, object, "C2Directed", timeSec, services, reason);
          return;
        }
        if (object.components.capability?.canOperateAutonomously === false) {
          setObjectControlMode(world, object, "HeuristicFallback", timeSec, services, reason);
          return;
        }
        setObjectControlMode(world, object, "AutonomousFallback", timeSec, services, reason);
      }

      function clearExpiredRuntimeEffects(world, object, timeSec, services) {
        if (!object?.runtime) {
          return;
        }
        if (object.runtime.jammedUntilSec && timeSec >= object.runtime.jammedUntilSec) {
          object.runtime.jammedUntilSec = 0;
          if (object.runtime.controlMode === "Jammed/Severed") {
            restoreObjectControlMode(world, object, timeSec, services, "jam-expired");
          }
        }
        if (object.runtime.spoofedUntilSec && timeSec >= object.runtime.spoofedUntilSec) {
          object.runtime.spoofedOffset = null;
          object.runtime.spoofedUntilSec = 0;
          object.runtime.spoofRestored = true;
          services.logger.record(
            world,
            timeSec,
            "effect",
            object.name + " cleared spoofed navigation offset",
            { objectId: object.id, side: object.side }
          );
        }
        if (object.runtime.telemetrySpoofedUntilSec && timeSec >= object.runtime.telemetrySpoofedUntilSec) {
          object.runtime.telemetrySpoofed = false;
          object.runtime.telemetryOffsetXY = null;
          object.runtime.telemetrySpoofedUntilSec = 0;
          object.runtime.telemetryRestored = true;
          services.logger.record(
            world,
            timeSec,
            "effect",
            object.name + " restored telemetry integrity",
            { objectId: object.id, side: object.side }
          );
        }
      }

      function buildRandomOffset(services, maxMagnitudeM, includeAltitude = false) {
        const magnitudeM = clamp(Math.abs(services.rng.nextGaussian(maxMagnitudeM * 0.7, maxMagnitudeM * 0.2)), maxMagnitudeM * 0.25, maxMagnitudeM);
        const angleRad = services.rng.next() * Math.PI * 2;
        return {
          x: round(Math.cos(angleRad) * magnitudeM, 2),
          y: round(Math.sin(angleRad) * magnitudeM, 2),
          z: includeAltitude ? round(services.rng.nextGaussian(0, maxMagnitudeM * 0.15), 2) : 0
        };
      }

      function getActiveTerrainObjects(world) {
        return ensureArray(world.scenario?.terrainObjects);
      }

      function pointInPolygon(point, polygon) {
        if (!polygon || polygon.length < 3) {
          return false;
        }
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
          const xi = polygon[i].x;
          const yi = polygon[i].y;
          const xj = polygon[j].x;
          const yj = polygon[j].y;
          const intersects = ((yi > point.y) !== (yj > point.y))
            && (point.x < (((xj - xi) * (point.y - yi)) / Math.max(1e-6, (yj - yi))) + xi);
          if (intersects) {
            inside = !inside;
          }
        }
        return inside;
      }

      function orientation2D(a, b, c) {
        return ((b.y - a.y) * (c.x - b.x)) - ((b.x - a.x) * (c.y - b.y));
      }

      function onSegment2D(a, b, c) {
        return b.x <= Math.max(a.x, c.x) + 1e-6
          && b.x + 1e-6 >= Math.min(a.x, c.x)
          && b.y <= Math.max(a.y, c.y) + 1e-6
          && b.y + 1e-6 >= Math.min(a.y, c.y);
      }

      function segmentsIntersect2D(p1, q1, p2, q2) {
        const o1 = orientation2D(p1, q1, p2);
        const o2 = orientation2D(p1, q1, q2);
        const o3 = orientation2D(p2, q2, p1);
        const o4 = orientation2D(p2, q2, q1);
        if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
          return true;
        }
        if (Math.abs(o1) <= 1e-6 && onSegment2D(p1, p2, q1)) {
          return true;
        }
        if (Math.abs(o2) <= 1e-6 && onSegment2D(p1, q2, q1)) {
          return true;
        }
        if (Math.abs(o3) <= 1e-6 && onSegment2D(p2, p1, q2)) {
          return true;
        }
        if (Math.abs(o4) <= 1e-6 && onSegment2D(p2, q1, q2)) {
          return true;
        }
        return false;
      }

      function segmentIntersectsPolygon2D(start, end, polygon) {
        if (!polygon || polygon.length < 3) {
          return false;
        }
        if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon)) {
          return true;
        }
        for (let index = 0; index < polygon.length; index += 1) {
          const current = polygon[index];
          const next = polygon[(index + 1) % polygon.length];
          if (segmentsIntersect2D(start, end, current, next)) {
            return true;
          }
        }
        return false;
      }

      function getTerrainCentroid(terrain) {
        if (!terrain?.areaPolygon || terrain.areaPolygon.length < 3) {
          return null;
        }
        const centroid = terrain.areaPolygon.reduce((accumulator, point) => ({
          x: accumulator.x + Number(point.x || 0),
          y: accumulator.y + Number(point.y || 0)
        }), { x: 0, y: 0 });
        return {
          x: centroid.x / terrain.areaPolygon.length,
          y: centroid.y / terrain.areaPolygon.length
        };
      }

      function getTerrainIntersection(world, start, end, filterFn = null) {
        const terrainObjects = getActiveTerrainObjects(world);
        return terrainObjects.find((terrain) => {
          if (typeof filterFn === "function" && !filterFn(terrain)) {
            return false;
          }
          const terrainCenter = getTerrainCentroid(terrain);
          if (!terrainCenter) {
            return false;
          }
          const total2DDistance = Math.max(distance2D(start, end), 1e-6);
          const distanceToObstacle = distance2D(start, terrainCenter);
          const losZAtObstacle = Number(start.z || 0)
            + ((Number(end.z || 0) - Number(start.z || 0)) * (distanceToObstacle / total2DDistance));
          if (!(losZAtObstacle < Number(terrain.heightZ || 0))) {
            return false;
          }
          return segmentIntersectsPolygon2D(start, end, terrain.areaPolygon);
        }) || null;
      }

      function getTerrainNoisePenalty(world, start, end) {
        const terrainPenalty = getActiveTerrainObjects(world)
          .filter((terrain) => terrain.interferenceType === "Noise")
          .filter((terrain) => {
            const terrainCenter = getTerrainCentroid(terrain);
            if (!terrainCenter) {
              return false;
            }
            const total2DDistance = Math.max(distance2D(start, end), 1e-6);
            const distanceToObstacle = distance2D(start, terrainCenter);
            const losZAtObstacle = Number(start.z || 0)
              + ((Number(end.z || 0) - Number(start.z || 0)) * (distanceToObstacle / total2DDistance));
            return losZAtObstacle < Number(terrain.heightZ || 0) && segmentIntersectsPolygon2D(start, end, terrain.areaPolygon);
          })
          .reduce((sum, terrain) => sum + (Number(terrain.clutterPenaltyDb || 0) * 0.55), 0);
        const clutterPenalty = ensureArray(world.environment?.activeClutter)
          .filter((clutter) => Number(clutter.expiresAtSec || 0) > Number(world.currentTimeSec || 0))
          .filter((clutter) => {
            const center = { x: Number(clutter.centerX || 0), y: Number(clutter.centerY || 0) };
            const total2DDistance = Math.max(distance2D(start, end), 1e-6);
            const distanceToObstacle = distance2D(start, center);
            const losZAtObstacle = Number(start.z || 0)
              + ((Number(end.z || 0) - Number(start.z || 0)) * (distanceToObstacle / total2DDistance));
            const heightZ = Number(clutter.heightZ ?? clutter.centerZ ?? Number.MAX_SAFE_INTEGER);
            return losZAtObstacle < heightZ
              && pointToSegmentDistance2D(center, start, end) <= Number(clutter.radiusM || 0);
          })
          .reduce((sum, clutter) => sum + Number(clutter.clutterPenaltyDb || 0), 0);
        return terrainPenalty + clutterPenalty;
      }

      function createAssessmentStageState() {
        return {
          lastRefreshTimeSec: null,
          lastDecisionTimeSec: null,
          lastReason: "never",
          refreshCount: 0,
          skipCount: 0
        };
      }

      function createTrackAssessmentState() {
        return {
          nextCycleId: 0,
          currentCycleId: null,
          cycles: {},
          classification: {
            ...createAssessmentStageState(),
            lastDetectionConfidence: null,
            lastTrackQuality: null,
            lastSourceSensorCount: 0,
            lastStatus: "Unknown Air Object"
          },
          identification: {
            ...createAssessmentStageState(),
            lastTrackQuality: null,
            lastSourceSensorCount: 0,
            lastStatus: "Unknown",
            lastClassificationStatus: "Unknown Air Object",
            lastClassificationConfidence: 0
          },
          intent: {
            ...createAssessmentStageState(),
            lastSpeedMps: null,
            lastHeadingUnitXY: null,
            lastProjectedAssetId: null,
            lastProjectedDistanceXYM: null,
            lastAttackRunActive: false,
            lastThreatReason: "none",
            lastNonClosingCount: 0
          }
        };
      }

      function getTrackAssessmentState(track) {
        if (!track.assessmentState) {
          track.assessmentState = createTrackAssessmentState();
        }
        return track.assessmentState;
      }

      function startAssessmentCycle(track, timeSec, context = {}) {
        const assessmentState = getTrackAssessmentState(track);
        const cycleId = assessmentState.nextCycleId + 1;
        assessmentState.nextCycleId = cycleId;
        assessmentState.currentCycleId = cycleId;
        assessmentState.cycles[cycleId] = {
          id: cycleId,
          timeSec: round(timeSec, 2),
          observerId: context.observerId || null,
          sensorId: context.sensorId || null,
          sourceSensorCount: Number(context.sourceSensorCount || 0),
          newSensorContribution: !!context.newSensorContribution,
          classification: { action: "pending", reason: "pending" },
          identification: { action: "pending", reason: "pending" },
          intent: { action: "pending", reason: "pending" }
        };
        return assessmentState.cycles[cycleId];
      }

      function getAssessmentCycle(track, cycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const resolvedCycleId = cycleId == null ? assessmentState.currentCycleId : cycleId;
        return Number.isFinite(resolvedCycleId) ? (assessmentState.cycles[resolvedCycleId] || null) : null;
      }

      function pruneAssessmentCycles(track, keepCycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const retainedIds = Object.keys(assessmentState.cycles)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .sort((left, right) => left - right);
        while (retainedIds.length > 6) {
          const oldestId = retainedIds.shift();
          if (oldestId === assessmentState.currentCycleId || oldestId === keepCycleId) {
            retainedIds.push(oldestId);
            retainedIds.sort((left, right) => left - right);
            break;
          }
          delete assessmentState.cycles[oldestId];
        }
      }

      function recordAssessmentDecision(track, stageName, action, reason, timeSec, cycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const stageState = assessmentState[stageName];
        stageState.lastDecisionTimeSec = round(timeSec, 2);
        stageState.lastReason = reason;
        if (action === "refreshed") {
          stageState.refreshCount += 1;
        } else {
          stageState.skipCount += 1;
        }

        const cycle = getAssessmentCycle(track, cycleId);
        if (cycle) {
          cycle[stageName] = { action, reason };
        }
      }

      function commitClassificationAssessment(track, timeSec) {
        const stageState = getTrackAssessmentState(track).classification;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastDetectionConfidence = track.detectionConfidence;
        stageState.lastTrackQuality = track.trackQuality;
        stageState.lastSourceSensorCount = track.sourceSensorIds.length;
        stageState.lastStatus = track.classificationStatus;
      }

      function commitIdentificationAssessment(track, timeSec) {
        const stageState = getTrackAssessmentState(track).identification;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastTrackQuality = track.trackQuality;
        stageState.lastSourceSensorCount = track.sourceSensorIds.length;
        stageState.lastStatus = track.identificationStatus;
        stageState.lastClassificationStatus = track.classificationStatus;
        stageState.lastClassificationConfidence = track.classificationConfidence;
      }

      function commitIntentAssessment(track, assessmentResult, timeSec) {
        const stageState = getTrackAssessmentState(track).intent;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastSpeedMps = round(assessmentResult.speedMps, 2);
        stageState.lastHeadingUnitXY = assessmentResult.headingUnitXY
          ? {
            x: round(assessmentResult.headingUnitXY.x, 4),
            y: round(assessmentResult.headingUnitXY.y, 4),
            z: 0
          }
          : null;
        stageState.lastProjectedAssetId = assessmentResult.effectiveThreatAssetId || null;
        stageState.lastProjectedDistanceXYM = Number.isFinite(assessmentResult.effectiveThreatDistanceXYM)
          ? round(assessmentResult.effectiveThreatDistanceXYM, 2)
          : null;
        stageState.lastAttackRunActive = !!assessmentResult.attackRunActive;
        stageState.lastThreatReason = assessmentResult.threatReason || "none";
        stageState.lastNonClosingCount = assessmentResult.nonClosingCount ?? 0;
      }

      function headingChangeDegrees(previousHeading, currentHeading) {
        if (!previousHeading && !currentHeading) {
          return 0;
        }
        if (!previousHeading || !currentHeading) {
          return 180;
        }
        const cosine = clamp(dotProduct2D(previousHeading, currentHeading), -1, 1);
        return Math.acos(cosine) * (180 / Math.PI);
      }

      function recordAssessmentSnapshot(world, track, timeSec, cycleId = null) {
        const cycle = getAssessmentCycle(track, cycleId);
        const assessmentState = getTrackAssessmentState(track);
        world.assessmentSnapshots.push({
          timeSec: round(timeSec, 2),
          trackId: track.id,
          cycleId: cycle ? cycle.id : null,
          sourceSensorCount: track.sourceSensorIds.length,
          sourceSensorIds: deepClone(track.sourceSensorIds),
          classificationStatus: track.classificationStatus,
          identificationStatus: track.identificationStatus,
          intentStatus: track.intentStatus,
          projectedTargetId: track.projectedTargetId || null,
          currentProjectedAssetId: track.currentProjectedAssetId || null,
          currentSpeedMps: track.currentSpeedMps ?? null,
          threatScore: track.threatScore ?? null,
          threatNonClosingCount: track.threatNonClosingCount ?? 0,
          threatReason: track.threatReason || "none",
          stages: {
            classification: deepClone(cycle?.classification || { action: "unknown", reason: "no-cycle" }),
            identification: deepClone(cycle?.identification || { action: "unknown", reason: "no-cycle" }),
            intent: deepClone(cycle?.intent || { action: "unknown", reason: "no-cycle" })
          },
          stageCounts: {
            classification: {
              refreshes: assessmentState.classification.refreshCount,
              skips: assessmentState.classification.skipCount
            },
            identification: {
              refreshes: assessmentState.identification.refreshCount,
              skips: assessmentState.identification.skipCount
            },
            intent: {
              refreshes: assessmentState.intent.refreshCount,
              skips: assessmentState.intent.skipCount
            }
          }
        });
        pruneAssessmentCycles(track, cycle ? cycle.id : null);
      }

      function getVelocityVector(track, target) {
        const history = track?.history || [];
        if (history.length >= 2) {
          const previousEntry = history[history.length - 2];
          const currentEntry = history[history.length - 1];
          const deltaTimeSec = Math.max(0.001, (currentEntry.timeSec || 0) - (previousEntry.timeSec || 0));
          return scaleVector(subtractVectors(currentEntry.position, previousEntry.position), 1 / deltaTimeSec);
        }

        const mission = target?.runtime?.mission;
        const movement = target?.components?.movement;
        if (target && movement && mission && mission.currentWaypointIndex < mission.waypoints.length) {
          const waypoint = mission.waypoints[mission.currentWaypointIndex];
          const direction = normalizeVector(subtractVectors(waypoint, target.runtime.position));
          if (direction) {
            return scaleVector(direction, movement.speedMps || 0);
          }
        }

        return { x: 0, y: 0, z: 0 };
      }

      function estimateTrackPayloadScore(track, target) {
        const speedMps = magnitude3D(getVelocityVector(track, target));
        const signatureDb = target?.components?.signature?.radarSignatureDb ?? -18;
        const sizeScore = clamp((signatureDb + 20) / 6, 0, 3);
        const behaviorScore = track.intentStatus === "Attack Run"
          ? 3
          : (track.intentStatus === "Loiter" ? 1.25 : 0.5);
        const speedScore = clamp(speedMps / 20, 0, 2);
        return round(1 + sizeScore + behaviorScore + speedScore, 2);
      }

      function findMissionHeuristicTarget(world, object) {
        const missionProfile = object?.runtime?.missionProfile || object?.missionProfile || { type: "Geographic", targetTemplateId: null };
        const hostileAssets = getSideAssets(world, getOpposingSide(object?.side))
          .filter((candidate) => candidate.id !== object.id);

        if (!hostileAssets.length) {
          return null;
        }

        if (missionProfile.type === "SpecificAsset" && missionProfile.targetTemplateId) {
          const matches = hostileAssets.filter((candidate) => candidate.templateId === missionProfile.targetTemplateId);
          if (matches.length) {
            return matches.sort((left, right) => (
              distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position)
            ))[0];
          }
        }

        if (missionProfile.type === "MaxDamage") {
          return hostileAssets
            .slice()
            .sort((left, right) => {
              const valueDiff = Number(right.components.health.assetValuePts || 0) - Number(left.components.health.assetValuePts || 0);
              if (valueDiff !== 0) {
                return valueDiff;
              }
              return distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position);
            })[0];
        }

        return hostileAssets
          .slice()
          .sort((left, right) => (
            distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position)
          ))[0];
      }

      function resolveProjectedAsset(world, originPosition, velocityVector, fallbackObject, defendedSide = "Blue") {
        const direction = normalizeVector2D(velocityVector);
        const toleranceM = world.config.projectedPathToleranceM;
        if (!direction) {
          const fallbackDistanceM = fallbackObject ? distance2D(originPosition, fallbackObject.runtime.position) : Infinity;
          return {
            asset: fallbackObject || null,
            directDistanceM: fallbackDistanceM,
            directDistanceXYM: fallbackDistanceM,
            pathOffsetM: Infinity,
            pathOffsetXYM: Infinity,
            intersectsPath: false
          };
        }

        let bestCandidate = null;
        getSideAssets(world, defendedSide).forEach((asset) => {
          const offset = subtractVectors(asset.runtime.position, originPosition);
          const alongDistanceM = dotProduct2D(offset, direction);
          if (alongDistanceM < 0) {
            return;
          }
          const projectedPoint = {
            x: originPosition.x + (direction.x * alongDistanceM),
            y: originPosition.y + (direction.y * alongDistanceM),
            z: originPosition.z || 0
          };
          const directDistanceXYM = distance2D(originPosition, asset.runtime.position);
          const pathOffsetXYM = distance2D(asset.runtime.position, projectedPoint);
          if (!bestCandidate || pathOffsetXYM < bestCandidate.pathOffsetXYM) {
            bestCandidate = {
              asset,
              directDistanceM: directDistanceXYM,
              directDistanceXYM,
              pathOffsetM: pathOffsetXYM,
              pathOffsetXYM,
              intersectsPath: pathOffsetXYM <= toleranceM
            };
          }
        });

        if (bestCandidate && bestCandidate.intersectsPath) {
          return bestCandidate;
        }

        const fallbackDistanceM = fallbackObject ? distance2D(originPosition, fallbackObject.runtime.position) : Infinity;
        return {
          asset: fallbackObject || null,
          directDistanceM: fallbackDistanceM,
          directDistanceXYM: fallbackDistanceM,
          pathOffsetM: bestCandidate ? bestCandidate.pathOffsetXYM : Infinity,
          pathOffsetXYM: bestCandidate ? bestCandidate.pathOffsetXYM : Infinity,
          intersectsPath: false
        };
      }

      function getTrackThreatState(track) {
        if (!track.threatState) {
          track.threatState = {
            attackRunActive: false,
            nonClosingCount: 0,
            lastThreatAssetId: null,
            lastThreatDistanceXYM: null
          };
        }
        return track.threatState;
      }

      function updateTrackThreatAssessment(world, track, target, options = {}) {
        const commitState = options.commitState !== false;
        const updateTrackFields = options.updateTrackFields !== false;
        const threatState = getTrackThreatState(track);
        const originPosition = track.position || target.runtime.position;
        const velocityVector = getVelocityVector(track, target);
        const speedMps = magnitude3D(velocityVector);
        const headingUnitXY = normalizeVector2D(velocityVector);
        const currentProjectedAsset = resolveProjectedAsset(world, originPosition, velocityVector, null, track.owningSide || "Blue");
        const currentProjectedAssetId = currentProjectedAsset.asset && currentProjectedAsset.intersectsPath
          ? currentProjectedAsset.asset.id
          : null;
        const currentProjectedDistanceXYM = currentProjectedAssetId
          ? currentProjectedAsset.directDistanceXYM
          : null;
        const sameThreatAsset = currentProjectedAssetId
          && threatState.lastThreatAssetId === currentProjectedAssetId;
        const increasingDistance = sameThreatAsset
          && Number.isFinite(threatState.lastThreatDistanceXYM)
          && Number.isFinite(currentProjectedDistanceXYM)
          && currentProjectedDistanceXYM > (threatState.lastThreatDistanceXYM + THREAT_DISTANCE_EPSILON_M);
        const lowSpeed = speedMps < THREAT_SPEED_THRESHOLD_MPS;
        const currentlyClosing = Boolean(currentProjectedAssetId) && !lowSpeed && !increasingDistance;

        let attackRunActive = false;
        let nonClosingCount = 0;
        let effectiveThreatAssetId = null;
        let effectiveThreatDistanceXYM = null;
        let threatReason = "no-threat-path";

        if (currentlyClosing) {
          attackRunActive = true;
          nonClosingCount = 0;
          effectiveThreatAssetId = currentProjectedAssetId;
          effectiveThreatDistanceXYM = currentProjectedDistanceXYM;
          threatReason = "closing";
        } else if (threatState.attackRunActive) {
          nonClosingCount = threatState.nonClosingCount + 1;
          if (nonClosingCount < 2 && threatState.lastThreatAssetId) {
            attackRunActive = true;
            effectiveThreatAssetId = threatState.lastThreatAssetId;
            effectiveThreatDistanceXYM = threatState.lastThreatDistanceXYM;
            threatReason = lowSpeed
              ? "low-speed-hysteresis"
              : (increasingDistance ? "opening-range-hysteresis" : "path-break-hysteresis");
          } else {
            threatReason = lowSpeed
              ? "threat-dropped-low-speed"
              : (increasingDistance ? "threat-dropped-opening-range" : "threat-dropped-path-break");
          }
        } else if (lowSpeed) {
          threatReason = "low-speed";
        } else if (increasingDistance) {
          threatReason = "opening-range";
        }

        if (commitState) {
          if (currentlyClosing) {
            threatState.lastThreatAssetId = currentProjectedAssetId;
            threatState.lastThreatDistanceXYM = currentProjectedDistanceXYM;
          } else if (!attackRunActive) {
            threatState.lastThreatAssetId = null;
            threatState.lastThreatDistanceXYM = null;
          }

          threatState.attackRunActive = attackRunActive;
          threatState.nonClosingCount = attackRunActive ? nonClosingCount : 0;
        }

        if (updateTrackFields) {
          track.currentSpeedMps = round(speedMps, 2);
          track.currentHeadingUnitXY = headingUnitXY
            ? {
              x: round(headingUnitXY.x, 4),
              y: round(headingUnitXY.y, 4),
              z: 0
            }
            : null;
          track.currentProjectedAssetId = currentProjectedAssetId;
          track.currentProjectedDistanceXYM = Number.isFinite(currentProjectedDistanceXYM) ? round(currentProjectedDistanceXYM, 2) : null;
          track.projectedTargetId = effectiveThreatAssetId;
          track.effectiveThreatDistanceXYM = Number.isFinite(effectiveThreatDistanceXYM) ? round(effectiveThreatDistanceXYM, 2) : null;
          track.attackRunActive = attackRunActive;
          track.threatNonClosingCount = nonClosingCount;
          track.threatReason = threatReason;
        }

        return {
          speedMps,
          headingUnitXY,
          currentProjectedAsset,
          currentProjectedAssetId,
          currentProjectedDistanceXYM,
          attackRunActive,
          effectiveThreatAssetId,
          effectiveThreatDistanceXYM,
          threatReason,
          nonClosingCount
        };
      }

      function snapshotWorld(world, timeSec, reason) {
        return {
          timeSec: round(timeSec, 2),
          reason,
          objects: world.objectIds.map((id) => {
            const object = world.objects[id];
            return {
              id: object.id,
              name: object.name,
              side: object.side,
              roles: deepClone(object.roles),
              isInterceptorChild: !!object.runtime.interceptorChild,
              x: object.runtime.position.x,
              y: object.runtime.position.y,
              z: object.runtime.position.z,
              sensors: deepClone(object.components.sensors || []),
              effectors: deepClone(object.components.effectors || []),
              currentHeadingDeg: object.runtime.currentHeadingDeg ?? null,
              behaviorState: object.runtime.behaviorState || "Active",
              controlMode: object.runtime.controlMode || null,
              destroyed: object.runtime.destroyed,
              status: object.runtime.operationalStatus
            };
          }),
          tracks: getAllTracks(world).map((track) => ({
            id: track.id,
            x: track.position ? track.position.x : null,
            y: track.position ? track.position.y : null,
            headingDeg: track.currentHeadingUnitXY
              ? round((Math.atan2(track.currentHeadingUnitXY.y, track.currentHeadingUnitXY.x) * (180 / Math.PI) + 360) % 360, 2)
              : null,
            classification: track.classificationStatus,
            identification: track.identificationStatus,
            intent: track.intentStatus,
            status: track.status
          })),
          clutterPlaceholders: ensureArray(world.environment?.activeClutter)
            .filter((clutter) => Number(clutter.expiresAtSec || 0) > timeSec)
            .map((clutter) => ({
              centerX: Number(clutter.centerX || 0),
              centerY: Number(clutter.centerY || 0),
              radiusM: Number(clutter.radiusM || 0),
              label: clutter.label || "Physical Clutter"
            }))
        };
      }

      function finalizeReport(world, seed) {
        const blueObjects = world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === "Blue");
        const redObjects = world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === "Red");
        const destroyedRedObjects = redObjects.filter((object) => object.runtime.destroyed);
        const survivingBlueObjects = blueObjects.filter((object) => !object.runtime.destroyed);
        const destroyedBlueObjects = blueObjects.filter((object) => object.runtime.destroyed);
        const damagedBlueObjects = blueObjects.filter((object) => (
          !object.runtime.destroyed
          && Number(object.runtime.health || 0) < Number(object.components.health.maxHealth || 0)
        ));
        const hqObjects = blueObjects.filter((object) => object.components.health.isHQ);
        const totalBlueAssetValue = blueObjects.reduce((sum, object) => (
          sum + Math.max(0, Number(object.components.health.assetValuePts || 0))
        ), 0);
        const remainingBlueAssetValue = blueObjects.reduce((sum, object) => {
          const maxHealth = Math.max(1, Number(object.components.health.maxHealth || 1));
          const healthFraction = clamp((object.runtime.health || 0) / maxHealth, 0, 1);
          return sum + (healthFraction * Math.max(0, Number(object.components.health.assetValuePts || 0)));
        }, 0);
        const primaryTrack = getAllTracks(world)
          .sort((left, right) => (right.lastUpdateTimeSec || 0) - (left.lastUpdateTimeSec || 0))[0] || null;

        return {
          report: {
            scenarioName: world.scenario.metadata.name,
            seed,
            endTimeSec: round(world.currentTimeSec, 2),
            detected: world.metrics.detectionCandidates > 0,
            trackCreated: world.metrics.tracksCreated > 0,
            classified: world.metrics.classifications > 0,
            identified: world.metrics.identifications > 0,
            intentAssessed: world.metrics.intentsAssessed > 0,
            engaged: world.metrics.shotsFired > 0,
            targetDestroyed: destroyedRedObjects.length > 0,
            tracksDropped: world.metrics.tracksDropped,
            ghostTracksGenerated: world.metrics.ghostTracksGenerated,
            firstDetectionTimeSec: world.metrics.firstDetectionTimeSec,
            firstDetectionRangeM: world.metrics.firstDetectionRangeM,
            killTimeSec: world.metrics.killTimeSec,
            blueAssetsSurvived: survivingBlueObjects.length,
            hqSurvived: hqObjects.every((object) => !object.runtime.destroyed),
            percentSurvived: blueObjects.length ? round(survivingBlueObjects.length / blueObjects.length, 4) : 0,
            weightedSurvivalScore: totalBlueAssetValue > 0 ? round(remainingBlueAssetValue / totalBlueAssetValue, 4) : 0,
            threatsDestroyed: destroyedRedObjects.length,
            successfulStrikes: world.metrics.successfulStrikes || 0,
            blueAssetsDestroyed: destroyedBlueObjects.length,
            blueAssetsDamaged: damagedBlueObjects.length + destroyedBlueObjects.length,
            shotsFired: world.metrics.shotsFired,
            eventCount: world.logs.length,
            assessmentSnapshotCount: world.assessmentSnapshots.length,
            interceptorLaunches: world.metrics.interceptorLaunches,
            interceptorResolutions: world.metrics.interceptorResolutions,
            interceptorAborts: world.metrics.interceptorAborts,
            terrainCollisions: world.metrics.terrainCollisions,
            ewEvents: world.metrics.ewEvents,
            spoofEvents: world.metrics.spoofEvents || 0,
            cyberEvents: world.metrics.cyberEvents || 0,
            networkJamEvents: world.metrics.networkJamEvents,
            fallbackTransitions: world.metrics.fallbackTransitions,
            ammoExpended: deepClone(world.metrics.ammoExpended),
            finalTargetStatus: destroyedRedObjects.length > 0
              ? "Destroyed"
              : (redObjects[0]?.runtime.operationalStatus || "Unknown"),
            finalTrackStatus: primaryTrack ? primaryTrack.status : "None",
            finalClassificationStatus: primaryTrack ? primaryTrack.classificationStatus : "None",
            finalIdentificationStatus: primaryTrack ? primaryTrack.identificationStatus : "None",
            finalIntentStatus: primaryTrack ? primaryTrack.intentStatus : "None",
            logs: deepClone(world.logs),
            assessmentSnapshots: deepClone(world.assessmentSnapshots),
            frames: deepClone(world.frames),
            tracks: {
              blue: deepClone(world.blueTracks || {}),
              red: deepClone(world.redTracks || {})
            }
          }
        };
      }

      function createCsvRow(iterationId, report) {
        const row = {
          Iteration_ID: iterationId,
          Scenario_Name: report.scenarioName,
          Seed: report.seed,
          Detected: report.detected ? "Yes" : "No",
          Track_Created: report.trackCreated ? "Yes" : "No",
          Classified: report.classified ? "Yes" : "No",
          Identified: report.identified ? "Yes" : "No",
          Intent_Assessed: report.intentAssessed ? "Yes" : "No",
          Engaged: report.engaged ? "Yes" : "No",
          Threat_Destroyed: report.targetDestroyed ? "Yes" : "No",
          Tracks_Dropped: report.tracksDropped,
          Ghost_Tracks_Generated: report.ghostTracksGenerated,
          First_Detection_Time_s: report.firstDetectionTimeSec ?? "",
          First_Detection_Range_m: report.firstDetectionRangeM ?? "",
          Kill_Time_s: report.killTimeSec ?? "",
          Blue_Assets_Survived: report.blueAssetsSurvived,
          HQ_Survived: report.hqSurvived ? 1 : 0,
          Percent_Survived: report.percentSurvived,
          Weighted_Survival_Score: report.weightedSurvivalScore,
          Threats_Destroyed: report.threatsDestroyed,
          Successful_Strikes: report.successfulStrikes ?? 0,
          Blue_Assets_Destroyed: report.blueAssetsDestroyed ?? 0,
          Blue_Assets_Damaged: report.blueAssetsDamaged ?? 0,
          Shots_Fired: report.shotsFired,
          Interceptor_Launches: report.interceptorLaunches ?? 0,
          Interceptor_Resolutions: report.interceptorResolutions ?? 0,
          Interceptor_Aborts: report.interceptorAborts ?? 0,
          Terrain_Collisions: report.terrainCollisions ?? 0,
          EW_Events: report.ewEvents ?? 0,
          Spoof_Events: report.spoofEvents ?? 0,
          Cyber_Events: report.cyberEvents ?? 0,
          Network_Jam_Events: report.networkJamEvents ?? 0,
          Fallback_Transitions: report.fallbackTransitions ?? 0,
          Final_Target_Status: report.finalTargetStatus,
          Final_Track_Status: report.finalTrackStatus,
          Classification_Status: report.finalClassificationStatus,
          Identification_Status: report.finalIdentificationStatus,
          Intent_Status: report.finalIntentStatus,
          Event_Count: report.eventCount
        };

        Object.keys(report.ammoExpended || {})
          .sort()
          .forEach((templateId) => {
            row[templateId + "_Ammo_Expended"] = report.ammoExpended[templateId] || 0;
          });

        return row;
      }

      function rowsToCsv(rows) {
        if (!rows.length) {
          return "";
        }
        const headers = [];
        rows.forEach((row) => {
          Object.keys(row).forEach((header) => {
            if (!headers.includes(header)) {
              headers.push(header);
            }
          });
        });
        const lines = [headers.join(",")];
        rows.forEach((row) => {
          const values = headers.map((header) => {
            const rawValue = row[header] ?? "";
            return "\"" + String(rawValue).replace(/"/g, "\"\"") + "\"";
          });
          lines.push(values.join(","));
        });
        return lines.join("\n");
      }

      class SeededRNG {
        constructor(seed) {
          this.seed = seed >>> 0;
        }

        next() {
          this.seed = (1664525 * this.seed + 1013904223) >>> 0;
          return this.seed / 4294967296;
        }

        nextGaussian(mean = 0, standardDeviation = 1) {
          let u1 = this.next();
          let u2 = this.next();
          if (u1 <= 1e-12) {
            u1 = 1e-12;
          }
          const magnitude = Math.sqrt(-2 * Math.log(u1));
          const z0 = magnitude * Math.cos(2 * Math.PI * u2);
          return mean + (z0 * standardDeviation);
        }

        chance(probability) {
          return this.next() <= probability;
        }
      }

      class EventManager {
        constructor() {
          this.queue = [];
          this.sequence = 0;
        }

        schedule(event) {
          this.queue.push({
            ...event,
            sequence: this.sequence++
          });
          this.queue.sort((left, right) => {
            if (left.time !== right.time) {
              return left.time - right.time;
            }
            if (left.priority !== right.priority) {
              return left.priority - right.priority;
            }
            return left.sequence - right.sequence;
          });
        }

        scheduleDelay(currentTime, delaySec, event, options = {}) {
          const adjustedDelay = options.enforceMinimumDelay && delaySec <= 0
            ? MIN_STATE_DELAY_SEC
            : Math.max(0, delaySec);
          this.schedule({
            ...event,
            time: round(currentTime + adjustedDelay, 3)
          });
        }

        next() {
          return this.queue.shift();
        }

        hasEvents() {
          return this.queue.length > 0;
        }
      }

      class LoggingSystem {
        record(world, timeSec, type, message, data = {}) {
          const side = inferLogSide(world, data);
          world.logs.push({
            timeSec: round(timeSec, 2),
            type,
            message,
            side,
            data
          });
        }
      }

      class EnvironmentSystem {
        initialize(world, services) {
          world.environment.activeAnomalies = ensureArray(world.environment.activeAnomalies);
          world.environment.activeClutter = ensureArray(world.environment.activeClutter);
          world.environment.nextAnomalyIndex = Number(world.environment.nextAnomalyIndex || 0);
          world.environment.nextClutterIndex = Number(world.environment.nextClutterIndex || 0);
          services.events.schedule({
            time: 5,
            type: "environment.process",
            priority: EVENT_PRIORITIES.track,
            payload: {}
          });
        }

        process(event, world, services) {
          world.environment.activeAnomalies = ensureArray(world.environment.activeAnomalies)
            .filter((anomaly) => Number(anomaly.expiresAtSec || 0) > event.time);
          world.environment.activeClutter = ensureArray(world.environment.activeClutter)
            .filter((clutter) => Number(clutter.expiresAtSec || 0) > event.time);

          const mapWidthMeters = Math.max(100, Number(world.environment.mapWidthMeters || 1080));
          if (services.rng.chance(Number(world.environment.anomalySpawnChance ?? 0.35))) {
            world.environment.nextAnomalyIndex += 1;
            const anomaly = {
              id: "Anomaly-" + world.environment.nextAnomalyIndex,
              label: "RF Noise Spike " + world.environment.nextAnomalyIndex,
              position: {
                x: round(services.rng.next() * mapWidthMeters, 2),
                y: round(services.rng.next() * mapWidthMeters, 2),
                z: round(20 + (services.rng.next() * 180), 2)
              },
              signatureDb: round(-20 + (services.rng.next() * 20), 2),
              expiresAtSec: round(event.time + 3 + (services.rng.next() * 9), 2)
            };
            world.environment.activeAnomalies.push(anomaly);
            services.logger.record(
              world,
              event.time,
              "environment",
              anomaly.label + " spawned",
              {
                anomalyId: anomaly.id,
                x: anomaly.position.x,
                y: anomaly.position.y,
                z: anomaly.position.z,
                signatureDb: anomaly.signatureDb,
                expiresAtSec: anomaly.expiresAtSec
              }
            );
          }

          if (services.rng.chance(Number(world.environment.clutterSpawnChance ?? 0.28))) {
            world.environment.nextClutterIndex += 1;
            const centerZ = round(10 + (services.rng.next() * 50), 2);
            const clutter = {
              id: "Clutter-" + world.environment.nextClutterIndex,
              label: "Physical Clutter " + world.environment.nextClutterIndex,
              centerX: round(services.rng.next() * mapWidthMeters, 2),
              centerY: round(services.rng.next() * mapWidthMeters, 2),
              centerZ,
              radiusM: round(35 + (services.rng.next() * 125), 2),
              clutterPenaltyDb: round(2 + (services.rng.next() * 8), 2),
              heightZ: round(centerZ + 20 + (services.rng.next() * 40), 2),
              expiresAtSec: round(event.time + 3 + (services.rng.next() * 9), 2)
            };
            world.environment.activeClutter.push(clutter);
            services.logger.record(
              world,
              event.time,
              "environment",
              clutter.label + " formed",
              {
                clutterId: clutter.id,
                centerX: clutter.centerX,
                centerY: clutter.centerY,
                radiusM: clutter.radiusM,
                clutterPenaltyDb: clutter.clutterPenaltyDb,
                expiresAtSec: clutter.expiresAtSec
              }
            );
          }

          if (event.time + 5 <= world.config.maxTimeSec) {
            services.events.schedule({
              time: round(event.time + 5, 2),
              type: "environment.process",
              priority: EVENT_PRIORITIES.track,
              payload: {}
            });
          }
          services.captureFrame(world, event.time, "environment");
        }
      }

      class MovementSystem {
        process(event, world, services) {
          const object = getObject(world, event.payload.objectId);
          if (!object || object.runtime.destroyed) {
            return;
          }
          clearExpiredRuntimeEffects(world, object, event.time, services);

          const movement = object.components.movement;
          const mission = object.runtime.mission;
          if (!movement) {
            return;
          }
          const enduranceLimitSec = Number(movement.maxEnduranceSec ?? Number.POSITIVE_INFINITY);
          if (
            Number.isFinite(enduranceLimitSec)
            && event.time > Number(object.runtime.spawnTimeSec || 0) + enduranceLimitSec
          ) {
            services.logger.record(
              world,
              event.time,
              "movement",
              object.name + " exhausted fuel/endurance and crashed",
              {
                objectId: object.id,
                sourceMode: "fuel-depletion",
                maxEnduranceSec: enduranceLimitSec
              }
            );
            services.events.schedule({
              time: round(event.time, 3),
              type: "damage.resolve",
              priority: EVENT_PRIORITIES.damage,
              payload: {
                targetId: object.id,
                trackId: null,
                hit: true,
                damagePoints: 9999,
                sourceMode: "fuel-depletion"
              }
            });
            return;
          }

          const current = object.runtime.position;
          const stepDistance = movement.speedMps * movement.stepSec;
          const navigationOrigin = object.runtime.telemetrySpoofed && object.runtime.telemetryOffsetXY
            ? {
              x: current.x + Number(object.runtime.telemetryOffsetXY.x || 0),
              y: current.y + Number(object.runtime.telemetryOffsetXY.y || 0),
              z: current.z
            }
            : current;
          let movementTarget = null;
          let movementReason = "waypoint";

          if (object.runtime.interceptorChild) {
            const childState = object.runtime.interceptorChild;
            const shooter = getObject(world, childState.sourceShooterId);
            const target = getObject(world, childState.targetObjectId);
            if (!target || target.runtime.destroyed) {
              if (shooter) {
                clearEffectorAssignment(shooter, childState.sourceEffectorId, world);
              }
              world.metrics.interceptorAborts += 1;
              services.logger.record(
                world,
                event.time,
                "effector",
                object.name + " aborted because the target was lost",
                {
                  objectId: object.id,
                  shooterId: childState.sourceShooterId,
                  targetId: childState.targetObjectId,
                  trackId: childState.targetTrackId,
                  reason: "target-lost"
                }
              );
              removeRuntimeObject(world, object.id);
              services.captureFrame(world, event.time, "interceptor-abort");
              return;
            }

            if ((event.time - childState.spawnTimeSec) >= childState.maxFlightTimeSec) {
              if (shooter) {
                clearEffectorAssignment(shooter, childState.sourceEffectorId, world);
              }
              world.metrics.interceptorAborts += 1;
              services.logger.record(
                world,
                event.time,
                "effector",
                object.name + " timed out before intercept",
                {
                  objectId: object.id,
                  shooterId: childState.sourceShooterId,
                  targetId: childState.targetObjectId,
                  trackId: childState.targetTrackId,
                  reason: "flight-time-expired"
                }
              );
              removeRuntimeObject(world, object.id);
              services.captureFrame(world, event.time, "interceptor-timeout");
              return;
            }

            movementTarget = deepClone(target.runtime.position);
            if (childState.aimOffsetXY) {
              movementTarget.x += Number(childState.aimOffsetXY.x || 0);
              movementTarget.y += Number(childState.aimOffsetXY.y || 0);
            }
            movementReason = "interceptor-pursuit";
            object.runtime.behaviorState = "Pursuit";
            object.runtime.behaviorTargetId = target.id;
          }

          if (!movementTarget) {
            if (object.side === "Red" && object.roles.includes("UAS") && object.runtime.controlMode === "Jammed/Severed") {
              const lostLinkBehavior = normalizeLostLinkBehavior(object.components.capability?.lostLinkBehavior);
              if (lostLinkBehavior === "Hover/Loiter") {
                object.runtime.behaviorState = "Loiter";
                object.runtime.currentSpeedMps = 0;
                services.events.scheduleDelay(event.time, movement.stepSec, {
                  type: "movement.step",
                  priority: EVENT_PRIORITIES.movement,
                  payload: { objectId: object.id }
                });
                return;
              }
              if (lostLinkBehavior === "RTB") {
                movementTarget = deepClone(object.runtime.initialPosition || current);
                movementReason = "rtb";
                object.runtime.behaviorState = "RTB";
              } else if (lostLinkBehavior === "ExecuteTerminalDive") {
                const terminalTarget = object.runtime.behaviorTargetId
                  ? getObject(world, object.runtime.behaviorTargetId)
                  : findMissionHeuristicTarget(world, object);
                if (terminalTarget && !terminalTarget.runtime.destroyed) {
                  movementTarget = deepClone(terminalTarget.runtime.position);
                  movementTarget.z = Math.min(Number(movementTarget.z || 0), 0);
                  movementReason = "terminal-dive";
                  object.runtime.behaviorTargetId = terminalTarget.id;
                  object.runtime.behaviorState = "Terminal Dive";
                }
              }
              if (!movementTarget && lostLinkBehavior === "ContinueDeadReckoning") {
                const headingRad = (Number.isFinite(object.runtime.currentHeadingDeg) ? object.runtime.currentHeadingDeg : 0) * (Math.PI / 180);
                movementTarget = {
                  x: current.x + (Math.cos(headingRad) * Math.max(stepDistance, movement.waypointToleranceM)),
                  y: current.y + (Math.sin(headingRad) * Math.max(stepDistance, movement.waypointToleranceM)),
                  z: current.z
                };
                movementReason = "dead-reckoning";
                object.runtime.behaviorState = "Dead Reckoning";
              }
            }
          }

          if (!movementTarget) {
            const c2AssignedTarget = object.runtime.c2AssignedTargetId
              ? getObject(world, object.runtime.c2AssignedTargetId)
              : null;
            if (c2AssignedTarget && !c2AssignedTarget.runtime.destroyed && canObjectAct(world, object, event.time)) {
              movementTarget = deepClone(c2AssignedTarget.runtime.position);
              movementReason = "c2-directed";
              object.runtime.behaviorTargetId = c2AssignedTarget.id;
              object.runtime.behaviorState = "C2 Directed";
              setObjectControlMode(world, object, "C2Directed", event.time, services, "c2-assignment");
            } else if (object.runtime.c2AssignedTargetId) {
              object.runtime.c2AssignedTargetId = null;
            }
          }

          if (!movementTarget) {
            const lockedTargetId = Object.values(object.runtime.effectorStates || {})
              .find((state) => state?.missionState === "Engaging" && state.lockedTargetId)?.lockedTargetId || null;
            const lockedTarget = lockedTargetId ? getObject(world, lockedTargetId) : null;
            if (lockedTarget && !lockedTarget.runtime.destroyed) {
              movementTarget = deepClone(lockedTarget.runtime.position);
              movementReason = "pursuit";
              if (object.runtime.behaviorState !== "Pursuit" || object.runtime.behaviorTargetId !== lockedTarget.id) {
                object.runtime.behaviorState = "Pursuit";
                object.runtime.behaviorTargetId = lockedTarget.id;
                services.logger.record(
                  world,
                  event.time,
                  "movement",
                  object.name + " shifted to pursuit of " + lockedTarget.name,
                  {
                    objectId: object.id,
                    targetId: lockedTarget.id,
                    reason: "effector-lock"
                  }
                );
              }
            } else if (object.runtime.behaviorTargetId) {
              const behaviorTarget = getObject(world, object.runtime.behaviorTargetId);
              if (behaviorTarget && !behaviorTarget.runtime.destroyed && object.side === "Red") {
                movementTarget = deepClone(behaviorTarget.runtime.position);
                movementReason = "attack-run";
                object.runtime.behaviorState = "Attack Run";
              } else {
                object.runtime.behaviorTargetId = null;
              }
            }
          }

          if (!movementTarget && mission.currentWaypointIndex < mission.waypoints.length) {
            movementTarget = mission.waypoints[mission.currentWaypointIndex];
            movementReason = "waypoint";
            object.runtime.behaviorState = "Route";
            if (object.side === "Red") {
              setObjectControlMode(world, object, "Networked", event.time, services, "route-follow");
            }
          }

          if (!movementTarget && object.side === "Red" && object.roles.includes("UAS")) {
            const missionProfile = object.runtime.missionProfile || object.missionProfile || { type: "Geographic" };
            if (object.runtime.controlMode === "Jammed/Severed") {
              const heuristicTarget = findMissionHeuristicTarget(world, object);
              if (heuristicTarget) {
                object.runtime.behaviorTargetId = heuristicTarget.id;
                object.runtime.behaviorState = "Attack Run";
                setObjectControlMode(world, object, object.components.capability.canOperateAutonomously ? "AutonomousFallback" : "HeuristicFallback", event.time, services, "control-lost");
                movementTarget = deepClone(heuristicTarget.runtime.position);
                movementReason = "attack-run";
                services.logger.record(
                  world,
                  event.time,
                  "movement",
                  object.name + " entered fallback attack run toward " + heuristicTarget.name,
                  {
                    objectId: object.id,
                    targetId: heuristicTarget.id,
                    missionProfileType: missionProfile.type,
                    targetTemplateId: missionProfile.targetTemplateId || null
                  }
                );
              }
              return;
            }
            if (mission.currentWaypointIndex >= mission.waypoints.length) {
              if (missionProfile.type === "Geographic") {
                if (object.runtime.behaviorState !== "Loiter") {
                  object.runtime.behaviorState = "Loiter";
                  object.runtime.behaviorTargetId = null;
                  object.runtime.currentSpeedMps = 0;
                  services.logger.record(
                    world,
                    event.time,
                    "movement",
                    object.name + " entered geographic loiter",
                    {
                      objectId: object.id,
                      reason: "route-complete"
                    }
                  );
                }
                return;
              }

              const heuristicTarget = findMissionHeuristicTarget(world, object);
              if (heuristicTarget) {
                object.runtime.behaviorTargetId = heuristicTarget.id;
                object.runtime.behaviorState = "Attack Run";
                setObjectControlMode(
                  world,
                  object,
                  object.components.capability.canOperateAutonomously ? "AutonomousFallback" : "HeuristicFallback",
                  event.time,
                  services,
                  "mission-complete"
                );
                movementTarget = deepClone(heuristicTarget.runtime.position);
                movementReason = "attack-run";
                services.logger.record(
                  world,
                  event.time,
                  "movement",
                  object.name + " initiated mission-complete attack run toward " + heuristicTarget.name,
                  {
                    objectId: object.id,
                    targetId: heuristicTarget.id,
                    missionProfileType: missionProfile.type,
                    targetTemplateId: missionProfile.targetTemplateId || null
                  }
                );
              } else if (object.runtime.behaviorState !== "Loiter") {
                object.runtime.behaviorState = "Loiter";
                object.runtime.behaviorTargetId = null;
                object.runtime.currentSpeedMps = 0;
                services.logger.record(
                  world,
                  event.time,
                  "movement",
                  object.name + " entered loiter while awaiting a valid target",
                  {
                    objectId: object.id,
                    reason: "no-attack-target"
                  }
                );
                return;
              }
            }

            const heuristicTarget = findMissionHeuristicTarget(world, object);
            if (heuristicTarget) {
              object.runtime.behaviorTargetId = heuristicTarget.id;
              object.runtime.behaviorState = "Attack Run";
              setObjectControlMode(world, object, "HeuristicFallback", event.time, services, "heuristic-targeting");
              movementTarget = deepClone(heuristicTarget.runtime.position);
              movementReason = "attack-run";
              services.logger.record(
                world,
                event.time,
                "movement",
                object.name + " initiated attack run toward " + heuristicTarget.name,
                {
                  objectId: object.id,
                  targetId: heuristicTarget.id,
                  missionProfileType: missionProfile.type,
                  targetTemplateId: missionProfile.targetTemplateId || null
                }
              );
            }
          }

          if (movementTarget && object.runtime.spoofedOffset) {
            movementTarget = {
              x: Number(movementTarget.x || 0) + Number(object.runtime.spoofedOffset.x || 0),
              y: Number(movementTarget.y || 0) + Number(object.runtime.spoofedOffset.y || 0),
              z: Number(movementTarget.z || 0) + Number(object.runtime.spoofedOffset.z || 0)
            };
            if (movementReason === "waypoint") {
              movementReason = "spoofed-waypoint";
            }
          }

          if (!movementTarget) {
            if (object.runtime.behaviorState !== "Complete") {
              object.runtime.behaviorState = "Complete";
              object.runtime.currentSpeedMps = 0;
              services.logger.record(
                world,
                event.time,
                "movement",
                object.name + " completed its waypoint route",
                { objectId: object.id }
              );
            }
            return;
          }

          const remainingDistance = distance3D(navigationOrigin, movementTarget);
          const desiredHeadingDeg = remainingDistance > 0.001
            ? angleDeg(navigationOrigin, movementTarget)
            : Number.isFinite(object.runtime.currentHeadingDeg) ? object.runtime.currentHeadingDeg : 0;
          const currentHeadingDeg = Number.isFinite(object.runtime.currentHeadingDeg)
            ? object.runtime.currentHeadingDeg
            : desiredHeadingDeg;
          const turnLimitDeg = Math.max(0, Number(movement.turnRate_dps ?? movement.turnRateDps ?? 360)) * movement.stepSec;
          const headingDeltaDeg = clamp(smallestAngleDifference(desiredHeadingDeg, currentHeadingDeg), -turnLimitDeg, turnLimitDeg);
          const nextHeadingDeg = normalizeHeadingDeg(currentHeadingDeg + headingDeltaDeg);

          const desiredSpeedMps = Math.max(0, Number(movement.speedMps || 0));
          const currentSpeedMps = Number.isFinite(object.runtime.currentSpeedMps)
            ? Number(object.runtime.currentSpeedMps)
            : 0;
          const accelLimitMps = Math.max(0, Number(movement.maxAccel ?? movement.maxAccelMps2 ?? 9999)) * movement.stepSec;
          const speedDeltaMps = clamp(desiredSpeedMps - currentSpeedMps, -accelLimitMps, accelLimitMps);
          const nextSpeedMps = Math.max(0, currentSpeedMps + speedDeltaMps);
          const travelDistance = nextSpeedMps * movement.stepSec;
          const headingRad = nextHeadingDeg * (Math.PI / 180);
          let nextPosition = {
            x: current.x + (Math.cos(headingRad) * travelDistance),
            y: current.y + (Math.sin(headingRad) * travelDistance),
            z: current.z
          };
          if (remainingDistance > 0.001) {
            const verticalRatio = clamp(travelDistance / Math.max(remainingDistance, 1e-6), 0, 1);
            nextPosition.z = current.z + ((movementTarget.z - current.z) * verticalRatio);
          }

          const distanceAfterStep = distance3D(nextPosition, movementTarget);
          if (distanceAfterStep <= movement.waypointToleranceM) {
            nextPosition = { x: movementTarget.x, y: movementTarget.y, z: movementTarget.z };
            if (movementReason === "waypoint") {
              mission.currentWaypointIndex += 1;
            }
          }

          if (
            movementReason === "rtb"
            && distance3D(nextPosition, object.runtime.initialPosition || nextPosition) <= movement.waypointToleranceM
          ) {
            object.runtime.position = nextPosition;
            object.runtime.currentSpeedMps = 0;
            object.runtime.behaviorState = "Loiter";
            object.runtime.behaviorTargetId = null;
            services.logger.record(
              world,
              event.time,
              "movement",
              object.name + " completed RTB and is holding near launch point",
              {
                objectId: object.id,
                movementReason
              }
            );
            services.captureFrame(world, event.time, "movement");
            return;
          }

          object.runtime.currentHeadingDeg = round(nextHeadingDeg, 2);
          object.runtime.currentSpeedMps = round(nextSpeedMps, 2);
          syncFpvSensorHeading(object, object.runtime.currentHeadingDeg);

          const blockingTerrain = getTerrainIntersection(
                world,
                current,
                nextPosition,
                (terrain) => terrain.interferenceType === "Block"
              );
          if (blockingTerrain) {
            world.metrics.terrainCollisions += 1;
            services.logger.record(
              world,
              event.time,
              "movement",
              object.name + " encountered blocking terrain " + blockingTerrain.label,
              {
                objectId: object.id,
                terrainId: blockingTerrain.id,
                movementReason
              }
            );
            if (object.runtime.interceptorChild) {
              const shooter = getObject(world, object.runtime.interceptorChild.sourceShooterId);
              if (shooter) {
                clearEffectorAssignment(shooter, object.runtime.interceptorChild.sourceEffectorId, world);
              }
              const interceptorTrack = getTrack(world, object.runtime.interceptorChild.targetTrackId);
              if (object.runtime.interceptorChild.guidanceType === "Autonomous" && interceptorTrack) {
                interceptorTrack.interceptorsInbound = Math.max(0, (interceptorTrack.interceptorsInbound || 1) - 1);
              }
              world.metrics.interceptorAborts += 1;
              removeRuntimeObject(world, object.id);
              services.captureFrame(world, event.time, "interceptor-terrain-collision");
              return;
            }
            if (object.side === "Red" && object.roles.includes("UAS")) {
              mission.currentWaypointIndex = mission.waypoints.length;
              object.runtime.behaviorTargetId = null;
              setObjectControlMode(world, object, "HeuristicFallback", event.time, services, "terrain-blocked-route");
              services.events.scheduleDelay(event.time, movement.stepSec, {
                type: "movement.step",
                priority: EVENT_PRIORITIES.movement,
                payload: { objectId: object.id }
              });
              return;
            }
            object.runtime.behaviorState = "Blocked";
            services.captureFrame(world, event.time, "movement-blocked");
            return;
          }

          object.runtime.position = nextPosition;

          if (object.runtime.interceptorChild) {
            const childState = object.runtime.interceptorChild;
            const target = getObject(world, childState.targetObjectId);
            const track = getTrack(world, childState.targetTrackId);
            if (childState.guidanceType === "Command" && (!track || track.status !== "Active" || track.trackQuality < 0.60)) {
              const shooter = getObject(world, childState.sourceShooterId);
              if (shooter) {
                clearEffectorAssignment(shooter, childState.sourceEffectorId, world);
              }
              world.metrics.interceptorAborts += 1;
              services.logger.record(
                world,
                event.time,
                "effector",
                object.name + " interceptor aborted due to loss of fire control track",
                {
                  objectId: object.id,
                  shooterId: childState.sourceShooterId,
                  targetId: childState.targetObjectId,
                  trackId: childState.targetTrackId,
                  guidanceType: childState.guidanceType
                }
              );
              removeRuntimeObject(world, object.id);
              services.captureFrame(world, event.time, "interceptor-abort");
              return;
            }
            if (target) {
              const terminalDistanceM = distance3D(object.runtime.position, target.runtime.position);
              if (terminalDistanceM <= childState.terminalRadiusM) {
                world.metrics.interceptorResolutions += 1;
                services.logger.record(
                  world,
                  event.time,
                  "effector",
                  object.name + " reached terminal intercept window",
                  {
                    objectId: object.id,
                    shooterId: childState.sourceShooterId,
                    targetId: childState.targetObjectId,
                    trackId: childState.targetTrackId,
                    terminalDistanceM: round(terminalDistanceM, 2)
                  }
                );
                services.events.schedule({
                  time: round(event.time, 3),
                  type: "effect.resolve",
                  priority: EVENT_PRIORITIES.effect,
                  payload: {
                    shooterId: childState.sourceShooterId,
                    targetId: childState.targetObjectId,
                    trackId: childState.targetTrackId,
                    damagePoints: childState.damagePoints,
                    effectivePk: childState.effectivePk,
                    interceptorId: object.id,
                    sourceEffectorId: childState.sourceEffectorId,
                    effectMode: "guided-child"
                  }
                });
                services.captureFrame(world, event.time, "interceptor-terminal");
                return;
              }
            }
            if (!target) {
              if (childState.guidanceType === "Autonomous" && track) {
                track.interceptorsInbound = Math.max(0, (track.interceptorsInbound || 1) - 1);
              }
            }
          } else if (distanceAfterStep <= movement.waypointToleranceM) {
            const strikeTargetId = object.runtime.behaviorTargetId;
            const strikeTarget = strikeTargetId ? getObject(world, strikeTargetId) : null;
            const impactDamagePoints = Number(object.components.payload?.impactDamagePoints || 0);
            if (
              object.side === "Red"
              && object.roles.includes("UAS")
              && movementReason !== "waypoint"
              && strikeTarget
              && !strikeTarget.runtime.destroyed
              && impactDamagePoints > 0
            ) {
              const attackerTracks = getTracksForObject(world, object.id);
              const attackerTrack = attackerTracks[0] || null;
              object.runtime.behaviorState = "Impacting";
              object.runtime.behaviorTargetId = null;
              services.logger.record(
                world,
                event.time,
                "movement",
                object.name + " executed terminal impact on " + strikeTarget.name,
                {
                  objectId: object.id,
                  targetId: strikeTarget.id,
                  movementReason,
                  impactDamagePoints
                }
              );
              services.events.schedule({
                time: round(event.time, 3),
                type: "impact.resolve",
                priority: EVENT_PRIORITIES.damage,
                payload: {
                  attackerId: object.id,
                  attackerTrackId: attackerTrack ? attackerTrack.id : null,
                  targetId: strikeTarget.id,
                  targetTrackId: null,
                  damagePoints: impactDamagePoints,
                  destroyAttacker: object.components.payload?.selfDestructOnImpact !== false
                }
              });
              services.captureFrame(world, event.time, "owa-impact");
              return;
            }
            services.logger.record(
              world,
              event.time,
              "movement",
              movementReason === "waypoint"
                ? (object.name + " reached waypoint " + mission.currentWaypointIndex)
                : (object.name + " closed on current target"),
              {
                objectId: object.id,
                waypointIndex: mission.currentWaypointIndex,
                targetId: object.runtime.behaviorTargetId || null,
                movementReason
              }
            );
          }

          services.captureFrame(world, event.time, "movement");

          services.events.scheduleDelay(event.time, movement.stepSec, {
            type: "movement.step",
            priority: EVENT_PRIORITIES.movement,
            payload: { objectId: object.id }
          });
        }
      }

      class ImpactSystem {
        resolve(event, world, services) {
          const attacker = getObject(world, event.payload.attackerId);
          const target = getObject(world, event.payload.targetId);
          if (!attacker) {
            return;
          }

          services.logger.record(
            world,
            event.time,
            "damage",
            attacker.name + " impacted " + (target ? target.name : "the target area"),
            {
              attackerId: attacker.id,
              targetId: target ? target.id : event.payload.targetId,
              damagePoints: Number(event.payload.damagePoints || 0),
              destroyAttacker: event.payload.destroyAttacker !== false
            }
          );

          world.metrics.successfulStrikes += 1;

          if (target && !target.runtime.destroyed && Number(event.payload.damagePoints || 0) > 0) {
            applyDamageEvent(world, {
              targetId: target.id,
              trackId: event.payload.targetTrackId || null,
              hit: true,
              damagePoints: Number(event.payload.damagePoints || 0),
              sourceObjectId: attacker.id,
              sourceMode: "owa-impact"
            }, event.time, services);
          }

          if (event.payload.destroyAttacker !== false) {
            if (markObjectDestroyed(world, attacker, "Expended On Impact")) {
              services.logger.record(
                world,
                event.time,
                "damage",
                attacker.name + " was expended on impact",
                {
                  attackerId: attacker.id,
                  attackerTrackId: event.payload.attackerTrackId || null
                }
              );
            }
          } else {
            attacker.runtime.operationalStatus = "Mission Complete";
            attacker.runtime.behaviorState = "Complete";
            attacker.runtime.behaviorTargetId = null;
          }

          services.captureFrame(world, event.time, "owa-impact-resolve");
        }
      }

      class SensorSystem {
        process(event, world, services) {
          const host = getObject(world, event.payload.objectId);
          if (!host || host.runtime.destroyed || !hasOperationalPower(world, host)) {
            return;
          }
          clearExpiredRuntimeEffects(world, host, event.time, services);

          (host.components.sensors || []).forEach((sensor) => {
            const sensorState = getSensorRuntimeState(host, sensor.id);
            const cuedTrack = sensorState?.cuedTrackId ? getTrack(world, sensorState.cuedTrackId) : null;
            const focusedTargetId = cuedTrack?.realObjectId || null;
            const candidateTargetIds = focusedTargetId ? [focusedTargetId] : world.objectIds.slice();

            candidateTargetIds.forEach((targetId) => {
              const target = getObject(world, targetId);
              if (!target || target.runtime.destroyed || target.side === host.side) {
                return;
              }
              clearExpiredRuntimeEffects(world, target, event.time, services);

              const hostPosition = host.runtime.position;
              const targetPosition = getTrackObservedPosition(world, host.side, target);
              const rangeM = distance3D(hostPosition, targetPosition);
              const horizontalRangeM = distance2D(hostPosition, targetPosition);
              if (rangeM > sensor.maxRangeM) {
                return;
              }

              const blockingTerrain = getTerrainIntersection(
                world,
                hostPosition,
                targetPosition,
                (terrain) => terrain.interferenceType === "Block"
              );
              if (blockingTerrain) {
                return;
              }

              const bearingDeg = angleDeg(hostPosition, targetPosition);
              const relativeBearingDeg = Math.abs(smallestAngleDifference(bearingDeg, sensor.headingDeg));
              const elevationDeg = Math.abs(
                Math.atan2(targetPosition.z - hostPosition.z, Math.max(1, horizontalRangeM)) * (180 / Math.PI)
              );

              if (relativeBearingDeg > sensor.horizontalFovDeg / 2 || elevationDeg > sensor.verticalFovDeg / 2) {
                return;
              }

              let confidence = 0;
              let signalStrengthDb = null;
              let noiseDb = null;
              if (isOpticalSensor(sensor)) {
                confidence = clamp(1 - Math.pow((rangeM / Math.max(1, sensor.maxRangeM)), 2), 0, 0.99);
                const visualPenalty = getTerrainNoisePenalty(world, hostPosition, targetPosition) * 0.01;
                confidence = clamp(confidence - visualPenalty, 0, 0.99);
                if (confidence <= 0.1) {
                  return;
                }
              } else {
                const terrainNoiseDb = getTerrainNoisePenalty(world, hostPosition, targetPosition);
                const networkNoiseDb = isAcousticSensor(sensor) ? 0 : getNetworkState(world, host.side, event.time).noisePenaltyDb;
                const pathLossDb = 20 * Math.log10(Math.max(1, rangeM));
                if (isAcousticSensor(sensor)) {
                  signalStrengthDb = Number(target.components.signature.acousticSignatureDb || 0) - pathLossDb;
                } else if (isRfPassiveSensor(sensor)) {
                  if (getObjectEmissionState(target).radioSilent) {
                    return;
                  }
                  signalStrengthDb = Number(target.components.signature.rfEmissionDb || 0) - pathLossDb;
                } else {
                  signalStrengthDb = sensor.transmitPowerDb
                    + Number(target.components.signature.radarSignatureDb || 0)
                    - pathLossDb;
                }
                noiseDb = sensor.noiseFloorDb
                  + world.environment.baseNoiseDb
                  + terrainNoiseDb
                  + networkNoiseDb
                  + services.rng.nextGaussian(0, sensor.noiseSigmaDb);

                if (signalStrengthDb <= noiseDb + sensor.detectionThresholdDb) {
                  return;
                }

                confidence = clamp((signalStrengthDb - (noiseDb + sensor.detectionThresholdDb) + 22) / 24, 0.1, 0.99);
              }

              if (focusedTargetId && target.id === focusedTargetId) {
                confidence = clamp(confidence + 0.08, 0.1, 0.99);
              }
              world.metrics.detectionCandidates += 1;
              if (world.metrics.firstDetectionTimeSec === null) {
                world.metrics.firstDetectionTimeSec = round(event.time, 2);
                world.metrics.firstDetectionRangeM = round(rangeM, 2);
              }

              services.logger.record(
                world,
                event.time,
                "detection",
                host.name + " (" + sensor.name + ") generated a detection candidate on " + target.name,
                {
                  observerId: host.id,
                  sensorId: sensor.id,
                  sensorName: sensor.name,
                  sensorType: sensor.type,
                  targetId: target.id,
                  rangeM: round(rangeM, 2),
                  confidence: round(confidence, 2),
                  cueFocused: focusedTargetId === target.id,
                  sensorMode: isOpticalSensor(sensor) ? "optical" : "em"
                }
              );

              services.events.schedule({
                time: event.time,
                type: "track.process",
                priority: EVENT_PRIORITIES.track,
                payload: {
                  observerId: host.id,
                  sensorId: sensor.id,
                  targetId: target.id,
                  observedPosition: deepClone(targetPosition),
                  confidence,
                  rangeM,
                  bearingDeg
                }
              });
            });

            ensureArray(world.environment?.activeAnomalies)
              .filter((anomaly) => Number(anomaly.expiresAtSec || 0) > event.time)
              .forEach((anomaly) => {
                if (isOpticalSensor(sensor) || isAcousticSensor(sensor)) {
                  return;
                }
                const hostPosition = host.runtime.position;
                const anomalyPosition = deepClone(anomaly.position || { x: 0, y: 0, z: 0 });
                const rangeM = distance3D(hostPosition, anomalyPosition);
                const horizontalRangeM = distance2D(hostPosition, anomalyPosition);
                if (rangeM > sensor.maxRangeM) {
                  return;
                }

                const blockingTerrain = getTerrainIntersection(
                  world,
                  hostPosition,
                  anomalyPosition,
                  (terrain) => terrain.interferenceType === "Block"
                );
                if (blockingTerrain) {
                  return;
                }

                const bearingDeg = angleDeg(hostPosition, anomalyPosition);
                const relativeBearingDeg = Math.abs(smallestAngleDifference(bearingDeg, sensor.headingDeg));
                const elevationDeg = Math.abs(
                  Math.atan2(anomalyPosition.z - hostPosition.z, Math.max(1, horizontalRangeM)) * (180 / Math.PI)
                );
                if (relativeBearingDeg > sensor.horizontalFovDeg / 2 || elevationDeg > sensor.verticalFovDeg / 2) {
                  return;
                }

                const terrainNoiseDb = getTerrainNoisePenalty(world, hostPosition, anomalyPosition);
                const networkNoiseDb = getNetworkState(world, host.side, event.time).noisePenaltyDb;
                const pathLossDb = 20 * Math.log10(Math.max(1, rangeM));
                const signalStrengthDb = isRfPassiveSensor(sensor)
                  ? Number(anomaly.signatureDb || 0) - pathLossDb
                  : sensor.transmitPowerDb + Number(anomaly.signatureDb || 0) - pathLossDb;
                const noiseDb = sensor.noiseFloorDb
                  + world.environment.baseNoiseDb
                  + terrainNoiseDb
                  + networkNoiseDb
                  + services.rng.nextGaussian(0, sensor.noiseSigmaDb);
                if (signalStrengthDb <= noiseDb + sensor.detectionThresholdDb) {
                  return;
                }

                const confidence = clamp((signalStrengthDb - (noiseDb + sensor.detectionThresholdDb) + 22) / 24, 0.1, 0.99);
                world.metrics.detectionCandidates += 1;
                services.logger.record(
                  world,
                  event.time,
                  "detection",
                  host.name + " (" + sensor.name + ") generated a detection candidate on " + anomaly.label,
                  {
                    observerId: host.id,
                    sensorId: sensor.id,
                    sensorName: sensor.name,
                    sensorType: sensor.type,
                    anomalyId: anomaly.id,
                    rangeM: round(rangeM, 2),
                    confidence: round(confidence, 2),
                    sensorMode: "em",
                    isAnomaly: true
                  }
                );

                services.events.schedule({
                  time: event.time,
                  type: "track.process",
                  priority: EVENT_PRIORITIES.track,
                  payload: {
                    observerId: host.id,
                    sensorId: sensor.id,
                    targetId: null,
                    observedPosition: deepClone(anomalyPosition),
                    confidence,
                    rangeM,
                    bearingDeg,
                    isAnomaly: true,
                    anomalyId: anomaly.id,
                    anomalyLabel: anomaly.label
                  }
                });
              });

            if (event.time + sensor.scanIntervalSec <= world.config.maxTimeSec) {
              services.events.scheduleDelay(event.time, sensor.scanIntervalSec, {
                type: "sensor.scan",
                priority: EVENT_PRIORITIES.sensor,
                payload: { objectId: host.id }
              });
            }
          });
        }

        releaseCue(event, world, services) {
          const host = getObject(world, event.payload.objectId);
          if (!host || host.runtime.destroyed) {
            return;
          }
          const sensorState = getSensorRuntimeState(host, event.payload.sensorId);
          if (!sensorState || sensorState.cuedTrackId !== event.payload.trackId) {
            return;
          }
          sensorState.missionState = "Scanning";
          sensorState.cuedTrackId = null;
          sensorState.busyUntilSec = 0;
          services.logger.record(
            world,
            event.time,
            "sensor",
            host.name + " released cue on " + event.payload.trackId,
            {
              objectId: host.id,
              sensorId: event.payload.sensorId,
              trackId: event.payload.trackId,
              reason: event.payload.reason || "cue-complete"
            }
          );
        }
      }

      class TrackSystem {
        scheduleTrackAging(track, timeSec, events) {
          track.agingToken += 1;
          events.scheduleDelay(timeSec, track.staleAfterSec, {
            type: "track.age",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              agingToken: track.agingToken
            }
          });
        }

        process(event, world, services) {
          const target = event.payload.isAnomaly ? null : getObject(world, event.payload.targetId);
          const observer = getObject(world, event.payload.observerId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          if (!observer || !sensor || (!event.payload.isAnomaly && (!target || target.runtime.destroyed))) {
            return;
          }
          if (target) {
            clearExpiredRuntimeEffects(world, target, event.time, services);
          }

          const trackCollection = observer.side === "Red" ? world.redTracks : world.blueTracks;
          let track = Object.values(trackCollection).find((candidate) =>
            event.payload.isAnomaly
              ? candidate.trackType === "Anomaly" && candidate.anomalyId === event.payload.anomalyId && candidate.status === "Active"
              : (
                candidate.realObjectId === target.id
                && candidate.owningSide === observer.side
                && candidate.status === "Active"
              )
          );

          if (!track && event.payload.isAnomaly) {
            const trackId = (observer.side === "Red" ? "Red-Track-" + world.nextRedTrackId++ : "Blue-Track-" + world.nextBlueTrackId++);
            track = {
              id: trackId,
              realObjectId: null,
              anomalyId: event.payload.anomalyId,
              trackType: "Anomaly",
              owningSide: observer.side,
              perceivedSide: "Unknown",
              sourceSensorIds: [sensor.id],
              detectionConfidence: 0,
              classificationStatus: "Unknown Air Object",
              classificationConfidence: 0.18,
              identificationStatus: "Unknown",
              identificationConfidence: 0,
              intentStatus: "Unknown",
              intentConfidence: 0,
              trackQuality: 0,
              status: "Active",
              staleAfterSec: world.config.trackStaleAfterSec,
              lastUpdateTimeSec: 0,
              history: [],
              pendingEngagement: false,
              agingToken: 0,
              assessmentState: createTrackAssessmentState(),
              threatState: {
                attackRunActive: false,
                nonClosingCount: 0,
                lastThreatAssetId: null,
                lastThreatDistanceXYM: null
              }
            };
            trackCollection[trackId] = track;
            world.metrics.tracksCreated += 1;
            services.logger.record(
              world,
              event.time,
              "track",
              "Environmental anomaly track created for " + (event.payload.anomalyLabel || event.payload.anomalyId),
              { trackId: track.id, anomalyId: event.payload.anomalyId, observerId: observer.id, updateReason: "new-anomaly-track" }
            );
          } else if (!track) {
            const trackId = (observer.side === "Red" ? "Red-Track-" + world.nextRedTrackId++ : "Blue-Track-" + world.nextBlueTrackId++);
            track = {
              id: trackId,
              realObjectId: target.id,
              trackType: "Real",
              owningSide: observer.side,
              perceivedSide: "Unknown",
              sourceSensorIds: [sensor.id],
              detectionConfidence: 0,
              classificationStatus: "Unknown Air Object",
              classificationConfidence: 0,
              identificationStatus: "Unknown",
              identificationConfidence: 0,
              intentStatus: "Unknown",
              intentConfidence: 0,
              trackQuality: 0,
              status: "Active",
              staleAfterSec: world.config.trackStaleAfterSec,
              lastUpdateTimeSec: 0,
              history: [],
              pendingEngagement: false,
              agingToken: 0,
              assessmentState: createTrackAssessmentState(),
              threatState: {
                attackRunActive: false,
                nonClosingCount: 0,
                lastThreatAssetId: null,
                lastThreatDistanceXYM: null
              }
            };
            trackCollection[trackId] = track;
            world.metrics.tracksCreated += 1;
            services.logger.record(
              world,
              event.time,
              "track",
              "Track created for " + target.name,
              { trackId: track.id, targetId: target.id, observerId: observer.id, updateReason: "new-track" }
            );
          }

          const newSensorContribution = !track.sourceSensorIds.includes(sensor.id);
          const fallbackPosition = target?.runtime?.position || event.payload.observedPosition || { x: 0, y: 0, z: 0 };
          if (!event.payload.isAnomaly && track.history.length > 0) {
            const lastKnownPosition = track.position || track.history[track.history.length - 1]?.position || fallbackPosition;
            const movedDistanceM = distance3D(lastKnownPosition, fallbackPosition);
            const updateReason = newSensorContribution
              ? "new-sensor-fused"
              : (movedDistanceM >= 15 ? "track-state-changed" : "same-sensor-refresh");
            services.logger.record(
              world,
              event.time,
              "track",
              "Track updated for " + target.name,
              {
                trackId: track.id,
                targetId: target.id,
                observerId: observer.id,
                updateReason,
                movementDeltaM: round(movedDistanceM, 2)
              }
            );
          }
          if (newSensorContribution) {
            track.sourceSensorIds.push(sensor.id);
          }
          const observedPosition = deepClone(event.payload.observedPosition || fallbackPosition);
          track.lastUpdateTimeSec = round(event.time, 2);
          track.position = observedPosition;
          track.rangeM = round(event.payload.rangeM, 2);
          track.detectionConfidence = round(event.payload.confidence, 2);
          track.trackQuality = round(clamp((track.trackQuality * 0.45) + (event.payload.confidence * 0.55), 0.1, 0.99), 2);
          track.history.push({
            timeSec: round(event.time, 2),
            confidence: round(event.payload.confidence, 2),
            rangeM: round(event.payload.rangeM, 2),
            position: observedPosition
          });

          const cycle = startAssessmentCycle(track, event.time, {
            observerId: observer.id,
            sensorId: sensor.id,
            sourceSensorCount: track.sourceSensorIds.length,
            newSensorContribution
          });

          this.scheduleTrackAging(track, event.time, services.events);
          services.captureFrame(world, event.time, "track");

          if (event.payload.isAnomaly) {
            return;
          }

          services.events.scheduleDelay(event.time, sensor.classification.latencySec, {
            type: "classification.process",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              observerId: observer.id,
              sensorId: sensor.id,
              baseConfidence: event.payload.confidence,
              cycleId: cycle.id
            }
          }, { enforceMinimumDelay: sensor.classification.latencySec <= 0 });
        }

        age(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          if (!track || track.status !== "Active" || track.agingToken !== event.payload.agingToken) {
            return;
          }

          if (round(event.time - track.lastUpdateTimeSec, 2) < track.staleAfterSec) {
            return;
          }

          track.status = "Dropped";
          world.metrics.tracksDropped += 1;
          services.logger.record(
            world,
            event.time,
            "track",
            track.id + " dropped due to staleness",
            { trackId: track.id, staleAfterSec: track.staleAfterSec }
          );
          services.captureFrame(world, event.time, "track-drop");
        }
      }

      class ClassificationSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !sensor || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.classification;
          let shouldRefresh = false;
          let reason = "retained";
          if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if (cycle.newSensorContribution) {
            shouldRefresh = true;
            reason = "new-sensor";
          } else if (Math.abs(track.detectionConfidence - (stageState.lastDetectionConfidence ?? track.detectionConfidence)) >= CLASSIFICATION_CONFIDENCE_DELTA) {
            shouldRefresh = true;
            reason = "detection-confidence-shift";
          } else if (Math.abs(track.trackQuality - (stageState.lastTrackQuality ?? track.trackQuality)) >= TRACK_QUALITY_DELTA) {
            shouldRefresh = true;
            reason = "track-quality-shift";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= CLASSIFICATION_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          }

          if (!shouldRefresh) {
            recordAssessmentDecision(track, "classification", "skipped", reason, event.time, cycle.id);
            const skipDelaySec = sensor.identification.canIdentify ? sensor.identification.latencySec : 0;
            services.events.scheduleDelay(event.time, skipDelaySec, {
              type: "identification.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                observerId: event.payload.observerId,
                sensorId: sensor.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: skipDelaySec <= 0 });
            return;
          }

          if (track.trackType === "Ghost") {
            track.classificationStatus = "Unknown Air Object";
            track.classificationConfidence = 0.2;
            world.metrics.classifications += 1;
            recordAssessmentDecision(track, "classification", "refreshed", reason, event.time, cycle.id);
            commitClassificationAssessment(track, event.time);
            services.logger.record(
              world,
              event.time,
              "classification",
              track.id + " remained ghost-like clutter during classification",
              {
                trackId: track.id,
                classification: track.classificationStatus,
                confidence: track.classificationConfidence
              }
            );
            services.events.scheduleDelay(event.time, 0.2, {
              type: "identification.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                observerId: event.payload.observerId,
                sensorId: sensor.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          const confidence = clamp(
            (event.payload.baseConfidence * sensor.classification.accuracyBase)
              + 0.14
              + world.randomization.classificationBias
              + services.rng.nextGaussian(0, 0.035),
            0.05,
            0.99
          );

          if (Number(track.position?.z || 0) > 5 && confidence >= 0.52) {
            track.classificationStatus = "UAS";
          } else if (confidence >= 0.52) {
            track.classificationStatus = "Ground Asset";
          } else {
            track.classificationStatus = "Unknown Object";
          }
          track.classificationConfidence = round(confidence, 2);
          world.metrics.classifications += 1;
          recordAssessmentDecision(track, "classification", "refreshed", reason, event.time, cycle.id);
          commitClassificationAssessment(track, event.time);

          services.logger.record(
            world,
            event.time,
            "classification",
            track.id + " classified as " + track.classificationStatus,
            {
              trackId: track.id,
              classification: track.classificationStatus,
              confidence: track.classificationConfidence
            }
          );

          services.captureFrame(world, event.time, "classification");

          const delaySec = sensor.identification.canIdentify ? sensor.identification.latencySec : 0;
          services.events.scheduleDelay(event.time, delaySec, {
            type: "identification.process",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              observerId: event.payload.observerId,
              sensorId: sensor.id,
              cycleId: cycle.id
            }
          }, { enforceMinimumDelay: delaySec <= 0 });
        }
      }

      class IdentificationSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          const observer = getObject(world, event.payload.observerId);
          const target = track ? getObject(world, track.realObjectId) : null;
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !sensor || !observer || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.identification;
          let shouldRefresh = false;
          let reason = "retained";
          if (track.classificationStatus === "Unknown Air Object" || track.classificationStatus === "Unknown Object") {
            reason = "classification-unknown";
          } else if (track.classificationConfidence < 0.45) {
            reason = "classification-weak";
          } else if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if (cycle.classification.action === "refreshed") {
            shouldRefresh = true;
            reason = "classification-updated";
          } else if (cycle.newSensorContribution) {
            shouldRefresh = true;
            reason = "new-sensor";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= IDENTIFICATION_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          } else if (
            (track.identificationStatus === "Unknown" || track.identificationStatus === "Suspect")
            && (
              Math.abs(track.trackQuality - (stageState.lastTrackQuality ?? track.trackQuality)) >= TRACK_QUALITY_DELTA
              || Math.abs(track.classificationConfidence - (stageState.lastClassificationConfidence ?? track.classificationConfidence)) >= IDENTIFICATION_CONFIDENCE_DELTA
            )
          ) {
            shouldRefresh = true;
            reason = track.identificationStatus === "Unknown"
              ? "unknown-confidence-shift"
              : "suspect-confidence-shift";
          }

          if (!shouldRefresh) {
            recordAssessmentDecision(track, "identification", "skipped", reason, event.time, cycle.id);
            services.events.scheduleDelay(event.time, 0.2, {
              type: "intent.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          if (track.trackType === "Ghost") {
            track.identificationStatus = "Unknown";
            track.identificationConfidence = 0.08;
            world.metrics.identifications += 1;
            recordAssessmentDecision(track, "identification", "refreshed", reason, event.time, cycle.id);
            commitIdentificationAssessment(track, event.time);
            services.logger.record(
              world,
              event.time,
              "identification",
              track.id + " remained unidentified because it is a ghost placeholder",
              {
                trackId: track.id,
                identification: track.identificationStatus,
                confidence: track.identificationConfidence
              }
            );
            services.events.scheduleDelay(event.time, 0.2, {
              type: "intent.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          if (!target || target.runtime.destroyed) {
            return;
          }

          const confidence = clamp(
            (track.classificationConfidence * sensor.identification.accuracyBase)
              + 0.12
              + world.randomization.identificationBias
              + services.rng.nextGaussian(0, 0.04),
            0.05,
            0.99
          );

          let identificationStatus = "Unknown";
          if (target.side === observer.side && confidence >= 0.52) {
            identificationStatus = "Friendly";
          } else if (["UAS", "Ground Asset"].includes(track.classificationStatus) && confidence >= 0.58) {
            identificationStatus = "Hostile";
          } else if (["UAS", "Ground Asset"].includes(track.classificationStatus) && confidence >= 0.42) {
            identificationStatus = "Suspect";
          }

          track.identificationStatus = identificationStatus;
          track.identificationConfidence = round(confidence, 2);
          track.perceivedSide = identificationStatus;
          world.metrics.identifications += 1;
          recordAssessmentDecision(track, "identification", "refreshed", reason, event.time, cycle.id);
          commitIdentificationAssessment(track, event.time);

          services.logger.record(
            world,
            event.time,
            "identification",
            track.id + " identified as " + identificationStatus,
            {
              trackId: track.id,
              identification: identificationStatus,
              confidence: track.identificationConfidence
            }
          );

          services.captureFrame(world, event.time, "identification");

          services.events.scheduleDelay(event.time, 0.2, {
            type: "intent.process",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              cycleId: cycle.id
            }
          }, { enforceMinimumDelay: true });
        }
      }

      class IntentSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const target = track ? getObject(world, track.realObjectId) : null;
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.intent;

          if (track.trackType === "Ghost") {
            track.intentStatus = "Unknown";
            track.intentConfidence = 0.1;
            world.metrics.intentsAssessed += 1;
            recordAssessmentDecision(track, "intent", "refreshed", "ghost-track", event.time, cycle.id);
            services.logger.record(
              world,
              event.time,
              "intent",
              track.id + " kept unknown intent because it is a ghost placeholder",
              {
                trackId: track.id,
                intent: track.intentStatus,
                confidence: track.intentConfidence
              }
            );
            services.captureFrame(world, event.time, "intent");
            services.events.schedule({
              time: event.time,
              type: "c2.decide",
              priority: EVENT_PRIORITIES.c2,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            });
            return;
          }

          if (!target || target.runtime.destroyed) {
            return;
          }

          const previewAssessment = updateTrackThreatAssessment(world, track, target, {
            commitState: false,
            updateTrackFields: false
          });
          track.currentSpeedMps = round(previewAssessment.speedMps, 2);
          track.currentHeadingUnitXY = previewAssessment.headingUnitXY
            ? {
              x: round(previewAssessment.headingUnitXY.x, 4),
              y: round(previewAssessment.headingUnitXY.y, 4),
              z: 0
            }
            : null;
          track.currentProjectedAssetId = previewAssessment.currentProjectedAssetId || null;
          track.currentProjectedDistanceXYM = Number.isFinite(previewAssessment.currentProjectedDistanceXYM)
            ? round(previewAssessment.currentProjectedDistanceXYM, 2)
            : null;
          const speedDelta = Math.abs(previewAssessment.speedMps - (stageState.lastSpeedMps ?? previewAssessment.speedMps));
          const headingDeltaDeg = headingChangeDegrees(stageState.lastHeadingUnitXY, previewAssessment.headingUnitXY);

          let shouldRefresh = false;
          let reason = "retained";
          if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= INTENT_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          } else if ((stageState.lastProjectedAssetId || null) !== (previewAssessment.effectiveThreatAssetId || null)) {
            shouldRefresh = true;
            reason = "projected-asset-change";
          } else if (stageState.lastAttackRunActive !== previewAssessment.attackRunActive) {
            shouldRefresh = true;
            reason = "attack-run-change";
          } else if ((stageState.lastNonClosingCount ?? 0) !== (previewAssessment.nonClosingCount ?? 0)) {
            shouldRefresh = true;
            reason = "hysteresis-change";
          } else if (speedDelta >= INTENT_SPEED_DELTA_MPS) {
            shouldRefresh = true;
            reason = "speed-change";
          } else if (headingDeltaDeg >= INTENT_HEADING_DELTA_DEG) {
            shouldRefresh = true;
            reason = "heading-change";
          }

          if (shouldRefresh) {
            let intentStatus = "Unknown";
            let confidence = clamp(0.42 + world.randomization.intentBias + services.rng.nextGaussian(0, 0.03), 0.1, 0.99);
            const threatAssessment = updateTrackThreatAssessment(world, track, target);

            intentStatus = "Transit";
            if (track.classificationStatus !== "UAS") {
              intentStatus = "Unknown";
            } else if (threatAssessment.attackRunActive) {
              intentStatus = "Attack Run";
              confidence += 0.18;
            } else if (threatAssessment.speedMps < THREAT_SPEED_THRESHOLD_MPS) {
              intentStatus = "Loiter";
              confidence += 0.12;
            }

            track.intentStatus = intentStatus;
            track.intentConfidence = round(clamp(confidence, 0.05, 0.99), 2);
            world.metrics.intentsAssessed += 1;
            recordAssessmentDecision(track, "intent", "refreshed", reason, event.time, cycle.id);
            commitIntentAssessment(track, threatAssessment, event.time);

            services.logger.record(
              world,
              event.time,
              "intent",
              track.id + " assessed intent " + intentStatus,
              {
                trackId: track.id,
                intent: intentStatus,
                confidence: track.intentConfidence,
                projectedTargetId: track.projectedTargetId || null,
                currentProjectedAssetId: track.currentProjectedAssetId || null,
                currentSpeedMps: track.currentSpeedMps ?? null,
                threatNonClosingCount: track.threatNonClosingCount ?? 0,
                threatReason: track.threatReason || "none",
                assessmentReason: reason
              }
            );

            services.captureFrame(world, event.time, "intent");
          } else {
            recordAssessmentDecision(track, "intent", "skipped", reason, event.time, cycle.id);
          }

          services.events.schedule({
            time: event.time,
            type: "c2.decide",
            priority: EVENT_PRIORITIES.c2,
            payload: {
              trackId: track.id,
              cycleId: cycle.id
            }
          });
        }
      }

      class C2System {
        needsSensorCue(track) {
          return track
            && track.status === "Active"
            && track.trackType !== "Ghost"
            && (
              ["Unknown Air Object", "Unknown Object"].includes(track.classificationStatus)
              || ["Unknown", "Suspect"].includes(track.identificationStatus)
            );
        }

        cueSensor(world, c2Object, track, timeSec, services) {
          const alreadyCued = world.objectIds.some((objectId) => {
            const object = world.objects[objectId];
            return Object.values(object?.runtime?.sensorStates || {}).some((state) => state?.cuedTrackId === track.id);
          });
          if (alreadyCued) {
            return false;
          }

          for (const objectId of world.objectIds) {
            const sensorHost = world.objects[objectId];
            if (!sensorHost || sensorHost.side !== c2Object.side || sensorHost.runtime.destroyed || !canObjectAct(world, sensorHost, timeSec)) {
              continue;
            }

            for (const sensor of sensorHost.components.sensors || []) {
              const sensorState = getSensorRuntimeState(sensorHost, sensor.id);
              if (!sensorState || sensorState.missionState !== "Scanning") {
                continue;
              }

              const cueDurationSec = Math.max(
                0.2,
                Number(sensor.classification?.latencySec || 0)
                  + Number(sensor.identification?.latencySec || 0)
                  + 0.1
              );
              sensorState.missionState = "Cued";
              sensorState.cuedTrackId = track.id;
              sensorState.busyUntilSec = round(timeSec + cueDurationSec, 2);
              sensorState.lastCueTimeSec = round(timeSec, 2);
              if (track.position) {
                sensor.headingDeg = round(angleDeg(sensorHost.runtime.position, track.position), 2);
              }

              services.logger.record(
                world,
                timeSec,
                "sensor",
                c2Object.name + " cued " + sensor.name + " toward " + track.id,
                {
                  c2ObjectId: c2Object.id,
                  objectId: sensorHost.id,
                  sensorId: sensor.id,
                  trackId: track.id,
                  targetId: track.realObjectId || null,
                  reason: "assessment-gap"
                }
              );

              services.events.scheduleDelay(timeSec, cueDurationSec, {
                type: "sensor.scan",
                priority: EVENT_PRIORITIES.sensor,
                payload: { objectId: sensorHost.id }
              }, { enforceMinimumDelay: cueDurationSec <= 0 });
              services.events.scheduleDelay(timeSec, cueDurationSec, {
                type: "sensor.releaseCue",
                priority: EVENT_PRIORITIES.sensor,
                payload: {
                  objectId: sensorHost.id,
                  sensorId: sensor.id,
                  trackId: track.id,
                  reason: "cue-window-complete"
                }
              }, { enforceMinimumDelay: cueDurationSec <= 0 });
              return true;
            }
          }

          return false;
        }

        buildThreatPicture(world, c2Object) {
          return getTracksForSide(world, c2Object.side)
            .filter((track) => {
              if (
                !track
                || track.status !== "Active"
                || track.trackType === "Ghost"
                || track.identificationStatus !== "Hostile"
                || track.owningSide !== c2Object.side
                || (track.interceptorsInbound > 0)
              ) {
                return false;
              }
              const target = getObject(world, track.realObjectId);
              return Boolean(target && !target.runtime.destroyed);
            })
            .map((track) => {
              const target = getObject(world, track.realObjectId);
              const speedMps = Number(track.currentSpeedMps ?? magnitude3D(getVelocityVector(track, target)));
              const projectedAsset = track.projectedTargetId
                ? getObject(world, track.projectedTargetId)
                : c2Object;
              const payloadScore = estimateTrackPayloadScore(track, target);
              const projectedAssetValue = projectedAsset
                ? Number(projectedAsset.components.health.assetValuePts || 1)
                : 1;
              const currentThreatDistanceXYM = projectedAsset
                ? (track.position ? distance2D(track.position, projectedAsset.runtime.position) : (track.effectiveThreatDistanceXYM ?? Infinity))
                : (track.effectiveThreatDistanceXYM ?? Infinity);
              const ttiSec = speedMps > 0
                ? Math.max(0.1, currentThreatDistanceXYM / speedMps)
                : Number.POSITIVE_INFINITY;
              const threatScore = Number.isFinite(ttiSec)
                ? round((payloadScore * projectedAssetValue) / ttiSec, 4)
                : 0;

              track.estimatedPayloadScore = payloadScore;
              track.currentSpeedMps = round(speedMps, 2);
              track.timeToImpactSec = Number.isFinite(ttiSec) ? round(ttiSec, 2) : null;
              track.threatScore = threatScore;

              return {
                track,
                target,
                payloadScore,
                projectedAsset,
                ttiSec,
                threatScore
              };
            })
            .sort((left, right) => right.threatScore - left.threatScore);
        }

        directStrikeAssets(world, c2Object, threatEntries, timeSec, services) {
          if (c2Object.side !== "Red" || !threatEntries.length) {
            return;
          }
          const targetEntry = threatEntries[0];
          const availableStrikers = getObjectsForSide(world, "Red")
            .filter((object) => object.id !== c2Object.id)
            .filter((object) => object.roles.includes("UAS") && object.components.movement)
            .filter((object) => !object.runtime.destroyed);
          availableStrikers.forEach((striker) => {
            if (!canObjectAct(world, striker, timeSec)) {
              if (striker.components.capability.canOperateAutonomously) {
                setObjectControlMode(world, striker, "AutonomousFallback", timeSec, services, "network-degraded");
              } else {
                setObjectControlMode(world, striker, "HeuristicFallback", timeSec, services, "network-lost");
              }
              return;
            }
            striker.runtime.c2AssignedTargetId = targetEntry.target.id;
            striker.runtime.behaviorTargetId = targetEntry.target.id;
            setObjectControlMode(world, striker, "C2Directed", timeSec, services, "red-c2-targeting");
          });
        }

        applyRedFallbackOnC2Loss(world, c2Object, timeSec, services, reason) {
          if (c2Object.side !== "Red") {
            return;
          }
          getObjectsForSide(world, "Red")
            .filter((object) => object.id !== c2Object.id)
            .filter((object) => object.roles.includes("UAS"))
            .filter((object) => object.components.capability.requiresC2)
            .filter((object) => !object.runtime.destroyed)
            .forEach((striker) => {
              striker.runtime.c2AssignedTargetId = null;
              if (striker.components.capability.canOperateAutonomously) {
                setObjectControlMode(world, striker, "AutonomousFallback", timeSec, services, reason);
                return;
              }
              striker.runtime.behaviorTargetId = null;
              setObjectControlMode(world, striker, "HeuristicFallback", timeSec, services, reason);
            });
        }

        process(event, world, services) {
          const c2Objects = world.objectIds
            .map((id) => world.objects[id])
            .filter((object) =>
              !object.runtime.destroyed
              && object.components.c2
              && hasOperationalPower(world, object)
            );

          for (const c2Object of c2Objects) {
            clearExpiredRuntimeEffects(world, c2Object, event.time, services);
            const networkState = getNetworkState(world, c2Object.side, event.time);
            if (networkState.status === "Jammed") {
              services.logger.record(
                world,
                event.time,
                "c2",
                c2Object.name + " could not act because the " + c2Object.side + " network is jammed",
                {
                  c2ObjectId: c2Object.id,
                  side: c2Object.side,
                  reason: "network-jammed"
                }
              );
              this.applyRedFallbackOnC2Loss(world, c2Object, event.time, services, "network-jammed");
              continue;
            }

            getTracksForSide(world, c2Object.side)
              .filter((track) => track.owningSide === c2Object.side && this.needsSensorCue(track))
              .forEach((track) => {
                this.cueSensor(world, c2Object, track, event.time, services);
              });

            const threatEntries = this.buildThreatPicture(world, c2Object);
            this.directStrikeAssets(world, c2Object, threatEntries, event.time, services);

            if (!(c2Object.components.effectors || []).length) {
              continue;
            }

            for (const entry of threatEntries) {
              const track = entry.track;
              if (track.pendingEngagement) {
                continue;
              }

              for (const effector of c2Object.components.effectors || []) {
                const effectorState = getEffectorRuntimeState(c2Object, effector.id);
                const ammoRemaining = c2Object.runtime.ammo[effector.id];
                const rangeM = distance3D(c2Object.runtime.position, entry.target.runtime.position);
                if (
                  !effectorState
                  || effectorState.missionState !== "Idle"
                  || ammoRemaining <= 0
                  || rangeM > effector.maxRangeM
                  || !canObjectAct(world, c2Object, event.time)
                ) {
                  continue;
                }

                effectorState.missionState = "Engaging";
                effectorState.lockedTrackId = track.id;
                effectorState.lockedTargetId = entry.target.id;
                track.pendingEngagement = true;
                world.metrics.c2Decisions += 1;

                services.logger.record(
                  world,
                  event.time,
                  "c2",
                  c2Object.name + " ordered engagement against " + entry.target.name + " (" + track.id + ")",
                  {
                    c2ObjectId: c2Object.id,
                    trackId: track.id,
                    effectorId: effector.id,
                    targetId: entry.target.id,
                    intent: track.intentStatus,
                    threatScore: entry.threatScore,
                    estimatedPayloadScore: entry.payloadScore,
                    timeToImpactSec: Number.isFinite(entry.ttiSec) ? round(entry.ttiSec, 2) : null,
                    projectedAssetId: entry.projectedAsset ? entry.projectedAsset.id : null,
                    threatNonClosingCount: track.threatNonClosingCount ?? 0,
                    threatReason: track.threatReason || "none"
                  }
                );

                services.events.scheduleDelay(event.time, effector.slewRateSec, {
                  type: "effector.fire",
                  priority: EVENT_PRIORITIES.effector,
                  payload: {
                    shooterId: c2Object.id,
                    effectorId: effector.id,
                    trackId: track.id,
                    targetId: entry.target.id
                  }
                }, { enforceMinimumDelay: effector.slewRateSec <= 0 });
                break;
              }
            }
          }

          const snapshotTrack = event.payload.trackId ? getTrack(world, event.payload.trackId) : null;
          if (snapshotTrack && snapshotTrack.status === "Active") {
            recordAssessmentSnapshot(world, snapshotTrack, event.time, event.payload.cycleId);
          }
        }
      }

      class NetworkSystem {
        restore(event, world, services) {
          const network = getInfrastructureForSide(world, event.payload.side)?.network;
          if (!network) {
            return;
          }
          if (event.time + 0.001 < Math.max(network.jammedUntilSec || 0, network.degradedUntilSec || 0)) {
            return;
          }
          network.jammedUntilSec = 0;
          network.degradedUntilSec = 0;
          network.sensorNoisePenaltyDb = 0;
          network.status = "Connected";
          services.logger.record(
            world,
            event.time,
            "network",
            event.payload.side + " network restored",
            {
              side: event.payload.side,
              networkId: network.id
            }
          );
        }
      }

      class EffectSystem {
        canContinueEngagement(world, shooter, effector, track, target, timeSec = 0) {
          if (!shooter || !effector || !track || !target || target.runtime.destroyed || track.status !== "Active") {
            return false;
          }

          const rangeM = distance3D(shooter.runtime.position, target.runtime.position);
          if (shooter.runtime.ammo[effector.id] <= 0 || rangeM > effector.maxRangeM || !canObjectAct(world, shooter, timeSec)) {
            return false;
          }

          return true;
        }

        getDeliveryModel(effector) {
          return normalizeDeliveryModel(effector?.deliveryModel, normalizeEffectorType(effector?.type));
        }

        getEffectMode(effector) {
          const effectorType = String(effector?.type || "").toUpperCase();
          if (effectorType === "JAMMER") {
            return "jammer";
          }
          if (effectorType === "SPOOFER") {
            return "spoofer";
          }
          if (effectorType === "CYBER") {
            return "cyber";
          }
          if (effectorType === "DIRECTEDENERGY") {
            return "directed-energy";
          }
          return this.getDeliveryModel(effector) === "Guided" ? "guided-child" : "ballistic";
        }

        computeNonKineticProbability(world, effector, target, rangeM) {
          const effectMode = this.getEffectMode(effector);
          const baseRangeFactor = effector.maxRangeM > 0
            ? clamp(1 - Math.pow((rangeM / effector.maxRangeM), 2), 0, 1)
            : 0;
          const rangeFloor = effectMode === "jammer" ? 0.9 : 0.45;
          const rangeFactor = effector.maxRangeM > 0
            ? clamp(rangeFloor + ((1 - rangeFloor) * baseRangeFactor), rangeFloor, 1)
            : 0;
          const environmentFactor = clamp(1 - (Math.abs(world.environment.baseNoiseDb) * 0.0025), 0.82, 1);
          const vulnerability = target.components.vulnerability || normalizeVulnerability({}, target.components.resistance);
          if (effectMode === "jammer") {
            return clamp(
              (Number(effector.basePe || 0.55) + world.randomization.pkBias)
                * rangeFactor
                * environmentFactor
                * clamp(1 - Number(vulnerability.commsResilience || 0), 0.05, 1),
              0,
              0.98
            );
          }
          if (effectMode === "spoofer") {
            return clamp(
              (Number(effector.basePe || 0.45) + world.randomization.pkBias)
                * rangeFactor
                * environmentFactor
                * clamp(1 - Number(vulnerability.navResilience || 0), 0.05, 1),
              0,
              0.98
            );
          }
          if (effectMode === "cyber") {
            return clamp(
              (Number(effector.basePe || 0.4) + world.randomization.pkBias)
                * rangeFactor
                * environmentFactor
                * clamp(1 - Number(vulnerability.cyberResilience || 0), 0.05, 1),
              0,
              0.98
            );
          }
          return 0;
        }

        spawnGuidedMunition(world, shooter, effector, track, target, effectivePk, timeSec, services) {
          const interceptorId = "Interceptor-" + world.objectIds.length + "-" + Math.floor(timeSec * 10);
          const childObject = {
            id: interceptorId,
            templateId: "Runtime-Child-Interceptor",
            name: shooter.name + " Guided Munition",
            side: shooter.side,
            roles: ["InterceptorChild"],
            missionProfile: normalizeMissionProfile({}),
            components: {
              health: { maxHealth: 1, assetValuePts: 0, isHQ: false },
              resistance: { kineticResistance: 0, ewResistance: 0, networkResistance: 0 },
              signature: { radarSignatureDb: -18 },
              capability: {
                usesGPS: false,
                usesNetwork: false,
                usesRF: false,
                requiresPower: false,
                requiresC2: false,
                canOperateAutonomously: true
              },
              powerConsumer: { powerConsumedKw: 0 },
              movement: {
                speedMps: Math.max(50, Number(effector.projectileSpeedMps || 250)),
                stepSec: 0.1,
                waypointToleranceM: Math.max(1, Number(effector.terminalRadiusM || 12)),
                maxAccel: Number(effector.maxAccel ?? effector.maxAccelMps2 ?? 9999),
                turnRate_dps: Number(effector.turnRate_dps ?? effector.turnRateDps ?? 720)
              },
              sensors: [],
              effectors: [],
              c2: null
            },
            runtime: {
              position: deepClone(shooter.runtime.position),
              initialPosition: deepClone(shooter.runtime.position),
              currentSpeedMps: 0,
              currentHeadingDeg: round(angleDeg(shooter.runtime.position, target.runtime.position), 2),
              health: 1,
              operationalStatus: "In Flight",
              destroyed: false,
              ammo: {},
              lastFireTimeSec: {},
              sensorStates: {},
              effectorStates: {},
              mission: {
                currentWaypointIndex: 0,
                waypoints: []
              },
            missionProfile: normalizeMissionProfile({}),
            behaviorState: "Pursuit",
            behaviorTargetId: target.id,
              lastCueLogTrackId: null,
              controlMode: "AutonomousFallback",
              c2AssignedTargetId: null,
              jammedUntilSec: 0,
              spoofedOffset: null,
              spoofedUntilSec: 0,
              telemetrySpoofed: false,
              telemetryOffsetXY: null,
              telemetrySpoofedUntilSec: 0,
              infrastructure: {
                networkId: null,
                powerGridId: null
              },
            interceptorChild: {
              parentLauncherId: shooter.id,
              sourceEffectorId: effector.id,
                sourceShooterId: shooter.id,
                targetTrackId: track.id,
                targetObjectId: target.id,
                guidanceType: effector.guidanceType || "Command",
                aimOffsetXY: shooter.side === "Blue" && target.runtime.telemetrySpoofed
                  ? deepClone(target.runtime.telemetryOffsetXY || { x: 0, y: 0 })
                  : null,
                spawnTimeSec: round(timeSec, 2),
                effectivePk,
                damagePoints: effector.damagePoints,
                terminalRadiusM: Number(effector.terminalRadiusM || 12),
                maxFlightTimeSec: Math.max(0.5, Number(effector.maxFlightTimeSec || 8))
              }
            }
          };
          world.objects[interceptorId] = childObject;
          world.objectIds.push(interceptorId);
          const effectorState = getEffectorRuntimeState(shooter, effector.id);
          if (effectorState) {
            effectorState.inFlightChildId = interceptorId;
          }
          if ((effector.guidanceType || "Command") === "Autonomous" && track) {
            track.interceptorsInbound = (track.interceptorsInbound || 0) + 1;
          }
          world.metrics.interceptorLaunches += 1;
          services.logger.record(
            world,
            timeSec,
            "effector",
            shooter.name + " launched guided munition at " + target.name,
            {
              shooterId: shooter.id,
              effectorId: effector.id,
              trackId: track.id,
              targetId: target.id,
              interceptorId
            }
          );
          services.captureFrame(world, timeSec, "interceptor-launch");
          services.events.scheduleDelay(timeSec, childObject.components.movement.stepSec, {
            type: "movement.step",
            priority: EVENT_PRIORITIES.movement,
            payload: { objectId: interceptorId }
          }, { enforceMinimumDelay: true });
        }

        spawnChildInterceptor(world, shooter, effector, track, target, effectivePk, timeSec, services) {
          return this.spawnGuidedMunition(world, shooter, effector, track, target, effectivePk, timeSec, services);
        }

        fire(event, world, services) {
          const shooter = getObject(world, event.payload.shooterId);
          const target = getObject(world, event.payload.targetId);
          const track = getTrack(world, event.payload.trackId);
          const effector = shooter
            ? (shooter.components.effectors || []).find((candidate) => candidate.id === event.payload.effectorId)
            : null;
          if (!shooter || !target || !track || !effector) {
            if (shooter) {
              clearEffectorAssignment(shooter, event.payload.effectorId, world);
            } else if (track) {
              track.pendingEngagement = false;
            }
            return;
          }

          const effectorState = getEffectorRuntimeState(shooter, effector.id);
          if (!effectorState || effectorState.missionState !== "Engaging" || effectorState.lockedTrackId !== track.id) {
            return;
          }

          if (!this.canContinueEngagement(world, shooter, effector, track, target, event.time)) {
            clearEffectorAssignment(shooter, effector.id, world);
            services.logger.record(
              world,
              event.time,
              "effector",
              shooter.name + " released " + effector.name + " without firing",
              {
                shooterId: shooter.id,
                trackId: track.id,
                targetId: target.id,
                reason: "target-invalid-or-out-of-range"
              }
            );
            return;
          }

          shooter.runtime.ammo[effector.id] -= 1;
          shooter.runtime.lastFireTimeSec[effector.id] = round(event.time, 2);
          world.metrics.shotsFired += 1;
          world.metrics.ammoExpended[shooter.templateId] = (world.metrics.ammoExpended[shooter.templateId] || 0) + 1;

          const trackAimPosition = deepClone(track.position || target.runtime.position);
          const rangeM = distance3D(shooter.runtime.position, target.runtime.position);
          const spoofSeparationM = distance3D(trackAimPosition, target.runtime.position);
          const spoofTerminalMissFactor = spoofSeparationM > Number(effector.terminalRadiusM || 12) ? 0 : 1;
          const rangeFactor = effector.maxRangeM > 0
            ? clamp(1 - Math.pow((rangeM / effector.maxRangeM), 2), 0, 1)
            : 0;
          const environmentFactor = clamp(1 - (Math.abs(world.environment.baseNoiseDb) * 0.0025), 0.82, 1);
          const effectMode = this.getEffectMode(effector);
          if (["jammer", "spoofer", "cyber"].includes(effectMode)) {
            const effectivePe = this.computeNonKineticProbability(world, effector, target, rangeM);
            services.logger.record(
              world,
              event.time,
              "effector",
              shooter.name + " activated " + effector.name + " against " + target.name,
              {
                shooterId: shooter.id,
                trackId: track.id,
                targetId: target.id,
                effectivePe: round(effectivePe, 2),
                rangeM: round(rangeM, 2)
              }
            );
            services.events.schedule({
              time: round(event.time, 3),
              type: "effect.resolve",
              priority: EVENT_PRIORITIES.effect,
              payload: {
                shooterId: shooter.id,
                targetId: target.id,
                trackId: track.id,
                effectivePk: effectivePe,
                interceptorId: null,
                sourceEffectorId: effector.id,
                effectDurationSec: effector.effectDurationSec,
                jamStrengthDb: effector.jamStrengthDb,
                affectedDomains: deepClone(effector.affectedDomains || []),
                effectMode
              }
            });
          } else if (effectMode === "directed-energy") {
            const targetModifier = clamp(1 - Number(target.components.resistance.kineticResistance || 0), 0.2, 1);
            const targetSpeedMps = Number.isFinite(target.runtime.currentSpeedMps)
              ? Number(target.runtime.currentSpeedMps)
              : magnitude3D(getVelocityVector(track, target));
            const maxTargetSpeedMps = Number(effector.effectorMaxTargetSpeed_mps || effector.effectorMaxTargetSpeedMps || 25);
            const effectivePk = clamp(
              (Number(effector.basePk || 0.7) + world.randomization.pkBias)
                * rangeFactor
                * environmentFactor
                * targetModifier
                * (targetSpeedMps > maxTargetSpeedMps ? 0.5 : 1),
              0,
              0.98
            );
            services.logger.record(
              world,
              event.time,
              "effector",
              shooter.name + " fired directed energy at " + target.name,
              {
                shooterId: shooter.id,
                trackId: track.id,
                targetId: target.id,
                effectivePk: round(effectivePk, 2),
                rangeM: round(rangeM, 2),
                targetSpeedMps: round(targetSpeedMps, 2),
                maxTargetSpeedMps
              }
            );
            services.events.schedule({
              time: round(event.time, 3),
              type: "effect.resolve",
              priority: EVENT_PRIORITIES.effect,
              payload: {
                shooterId: shooter.id,
                targetId: target.id,
                trackId: track.id,
                damagePoints: effector.damagePoints,
                effectivePk,
                interceptorId: null,
                sourceEffectorId: effector.id,
                effectMode
              }
            });
          } else if (effectMode === "ballistic") {
            const targetModifier = clamp(1 - target.components.resistance.kineticResistance, 0.35, 1);
            const projectileSpeedMps = Math.max(1, Number(effector.projectileSpeedMps || 900));
            const targetSpeedMps = Number.isFinite(target.runtime.currentSpeedMps)
              ? Number(target.runtime.currentSpeedMps)
              : magnitude3D(getVelocityVector(track, target));
            const targetHeadingDeg = Number.isFinite(target.runtime.currentHeadingDeg)
              ? Number(target.runtime.currentHeadingDeg)
              : (Number.isFinite(track?.headingDeg) ? Number(track.headingDeg) : angleDeg(shooter.runtime.position, trackAimPosition));
            const targetHeadingRad = targetHeadingDeg * (Math.PI / 180);
            let projectedTargetPosition = deepClone(trackAimPosition);
            let leadRangeM = distance3D(shooter.runtime.position, projectedTargetPosition);
            let timeToImpactSec = Math.max(0.05, leadRangeM / projectileSpeedMps);
            for (let iteration = 0; iteration < 2; iteration += 1) {
              projectedTargetPosition = {
                x: Number(trackAimPosition.x || 0) + (Math.cos(targetHeadingRad) * targetSpeedMps * timeToImpactSec),
                y: Number(trackAimPosition.y || 0) + (Math.sin(targetHeadingRad) * targetSpeedMps * timeToImpactSec),
                z: Number(trackAimPosition.z || 0)
              };
              leadRangeM = distance3D(shooter.runtime.position, projectedTargetPosition);
              timeToImpactSec = Math.max(0.05, leadRangeM / projectileSpeedMps);
            }
            const ballisticRangeFactor = effector.maxRangeM > 0
              ? clamp(1 - Math.pow((leadRangeM / effector.maxRangeM), 2), 0, 1)
              : 0;
            const effectivePk = clamp(
              (Number(effector.basePk || 0.7) + world.randomization.pkBias) * ballisticRangeFactor * environmentFactor * targetModifier * spoofTerminalMissFactor,
              0,
              0.98
            );
            services.logger.record(
              world,
              event.time,
              "effector",
              shooter.name + " fired ballistic projectile at " + target.name,
              {
                shooterId: shooter.id,
                trackId: track.id,
                targetId: target.id,
                effectivePk: round(effectivePk, 2),
                rangeM: round(leadRangeM, 2),
                flightTimeSec: round(timeToImpactSec, 2),
                spoofSeparationM: round(spoofSeparationM, 2)
              }
            );
            services.events.schedule({
              time: round(event.time + timeToImpactSec, 3),
              type: "effect.resolve",
              priority: EVENT_PRIORITIES.effect,
              payload: {
                shooterId: shooter.id,
                targetId: target.id,
                trackId: track.id,
                damagePoints: effector.damagePoints,
                effectivePk,
                interceptorId: null,
                sourceEffectorId: effector.id,
                effectMode: "ballistic"
              }
            });
          } else {
            const targetModifier = clamp(1 - target.components.resistance.kineticResistance, 0.35, 1);
            // Guided child interceptors already prove kinematic closure by reaching terminal range,
            // so launch distance should only lightly reduce terminal lethality.
            const interceptorRangeFactor = clamp(0.92 + (0.08 * rangeFactor), 0.92, 1);
            const guidedTerminalFloor = clamp(Number(effector.basePk || 0.75) * 0.95, 0.65, 0.9);
            const effectivePk = clamp(
              Math.max(
                (effector.basePk + world.randomization.pkBias) * interceptorRangeFactor * environmentFactor * targetModifier,
                guidedTerminalFloor * environmentFactor * clamp(0.85 + (0.15 * targetModifier), 0.85, 1)
              ),
                0,
                0.98
              );
            this.spawnGuidedMunition(world, shooter, effector, track, target, effectivePk, event.time, services);
          }

          services.events.scheduleDelay(event.time, effector.cooldownSec, {
            type: "effector.reset",
            priority: EVENT_PRIORITIES.effector,
            payload: {
              shooterId: shooter.id,
              effectorId: effector.id,
              trackId: track.id,
              targetId: target.id
            }
          }, { enforceMinimumDelay: effector.cooldownSec <= 0 });
        }

        resolve(event, world, services) {
          const target = getObject(world, event.payload.targetId);
          const track = getTrack(world, event.payload.trackId);
          const shooter = getObject(world, event.payload.shooterId);
          const effectMode = event.payload.effectMode || "guided-child";
          const trackId = track ? track.id : event.payload.trackId || null;
          const isNonKineticEffect = ["jammer", "spoofer", "cyber"].includes(effectMode);
          if (!target || (!track && !isNonKineticEffect)) {
            if (event.payload.interceptorId) {
              removeRuntimeObject(world, event.payload.interceptorId);
            }
            return;
          }

          if (["jammer", "spoofer", "cyber"].includes(effectMode)) {
            const hit = services.rng.chance(event.payload.effectivePk);
            world.metrics.ewEvents += 1;
            if (effectMode === "spoofer") {
              world.metrics.spoofEvents += 1;
            }
            if (effectMode === "cyber") {
              world.metrics.cyberEvents += 1;
            }
            services.logger.record(
              world,
              event.time,
              "effect",
              hit
                ? (effectMode.charAt(0).toUpperCase() + effectMode.slice(1) + " effect degraded " + target.name)
                : (effectMode.charAt(0).toUpperCase() + effectMode.slice(1) + " effect missed " + target.name),
              {
                shooterId: event.payload.shooterId,
                targetId: target.id,
                trackId,
                hit,
                effectivePe: round(event.payload.effectivePk, 2)
              }
            );
            if (hit) {
              if (effectMode === "jammer") {
                target.runtime.jammedUntilSec = Math.max(target.runtime.jammedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                target.components.vulnerability.navResilience = clamp(
                  Number(target.components.vulnerability.navResilience || 0.5) * 0.5,
                  0,
                  1
                );
                setObjectControlMode(world, target, "Jammed/Severed", event.time, services, "jammer-hit");
                services.logger.record(
                  world,
                  event.time,
                  "effect",
                  shooter.name + " successfully jammed " + target.name + ". Target executing lost-link protocol.",
                  {
                    shooterId: event.payload.shooterId,
                    targetId: target.id,
                    trackId
                  }
                );
                services.logger.record(
                  world,
                  event.time,
                  "effect",
                  shooter.name + " forced " + target.name + " to downgrade navigation systems. Spoofing vulnerability increased.",
                  {
                    shooterId: event.payload.shooterId,
                    targetId: target.id,
                    trackId,
                    navResilience: round(target.components.vulnerability.navResilience, 2)
                  }
                );
              } else if (effectMode === "spoofer") {
                target.runtime.spoofedOffset = buildRandomOffset(services, 500, true);
                target.runtime.spoofedUntilSec = Math.max(target.runtime.spoofedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                target.runtime.spoofRestored = false;
                services.logger.record(
                  world,
                  event.time,
                  "effect",
                  shooter.name + " successfully meaconed " + target.name + ". Target deviating from mission path.",
                  {
                    shooterId: event.payload.shooterId,
                    targetId: target.id,
                    trackId,
                    effect: {
                      offset: deepClone(target.runtime.spoofedOffset)
                    }
                  }
                );
              } else if (effectMode === "cyber") {
                target.runtime.spoofedOffset = buildRandomOffset(services, 420, true);
                target.runtime.spoofedUntilSec = Math.max(target.runtime.spoofedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                target.runtime.spoofRestored = false;
                target.runtime.telemetrySpoofed = true;
                target.runtime.telemetryOffsetXY = buildRandomOffset(services, 650, false);
                target.runtime.telemetrySpoofedUntilSec = Math.max(target.runtime.telemetrySpoofedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                target.runtime.telemetryRestored = false;
                services.logger.record(
                  world,
                  event.time,
                  "effect",
                  shooter.name + " successfully injected false telemetry into " + target.name + ". Track and operator navigation corrupted.",
                  {
                    shooterId: event.payload.shooterId,
                    targetId: target.id,
                    trackId,
                    telemetryOffsetXY: deepClone(target.runtime.telemetryOffsetXY)
                  }
                );
              }
              if (effectMode === "jammer" || ensureArray(event.payload.affectedDomains).includes("Network") || ensureArray(event.payload.affectedDomains).includes("C2")) {
                const hostileInfrastructure = getInfrastructureForSide(world, target.side)?.network;
                if (hostileInfrastructure) {
                hostileInfrastructure.status = "Jammed";
                hostileInfrastructure.jammedUntilSec = Math.max(hostileInfrastructure.jammedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                hostileInfrastructure.degradedUntilSec = Math.max(hostileInfrastructure.degradedUntilSec || 0, event.time + Number(event.payload.effectDurationSec || 6));
                hostileInfrastructure.sensorNoisePenaltyDb = Math.max(hostileInfrastructure.sensorNoisePenaltyDb || 0, Number(event.payload.jamStrengthDb || 8));
                world.metrics.networkJamEvents += 1;
                services.logger.record(
                  world,
                  event.time,
                  "network",
                  target.side + " network jammed by EW",
                  {
                    side: target.side,
                    targetId: target.id,
                    networkId: hostileInfrastructure.id
                  }
                );
                services.events.scheduleDelay(event.time, Number(event.payload.effectDurationSec || 6), {
                  type: "network.restore",
                  priority: EVENT_PRIORITIES.state,
                  payload: {
                    side: target.side
                  }
                }, { enforceMinimumDelay: true });
              }
              }
            }
            if (shooter && event.payload.sourceEffectorId) {
              clearEffectorAssignment(shooter, event.payload.sourceEffectorId, world);
            }
            return;
          }

          if (effectMode === "directed-energy") {
            const hit = services.rng.chance(event.payload.effectivePk);
            services.logger.record(
              world,
              event.time,
              "effect",
              hit ? "Directed energy hit " + target.name : "Directed energy missed " + target.name,
              {
                shooterId: event.payload.shooterId,
                targetId: target.id,
                trackId: track.id,
                hit,
                effectivePk: round(event.payload.effectivePk, 2)
              }
            );
            if (shooter && event.payload.sourceEffectorId) {
              clearEffectorAssignment(shooter, event.payload.sourceEffectorId, world);
            }
            services.events.scheduleDelay(event.time, 0, {
              type: "damage.resolve",
              priority: EVENT_PRIORITIES.damage,
              payload: {
                targetId: target.id,
                trackId: track.id,
                hit,
                damagePoints: event.payload.damagePoints
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          const hit = services.rng.chance(event.payload.effectivePk);
          services.logger.record(
            world,
            event.time,
            "effect",
            effectMode === "ballistic"
              ? (hit ? "Ballistic projectile hit " + target.name : "Ballistic projectile missed " + target.name)
              : (hit ? "Guided munition hit " + target.name : "Guided munition missed " + target.name),
            {
              shooterId: event.payload.shooterId,
              targetId: target.id,
              trackId: track.id,
              hit,
              effectivePk: round(event.payload.effectivePk, 2),
              interceptorId: event.payload.interceptorId || null
            }
          );
          if (event.payload.interceptorId) {
            const childState = getObject(world, event.payload.interceptorId)?.runtime?.interceptorChild || null;
            const interceptorTrack = childState ? getTrack(world, childState.targetTrackId) : null;
            if (childState?.guidanceType === "Autonomous" && interceptorTrack) {
              interceptorTrack.interceptorsInbound = Math.max(0, (interceptorTrack.interceptorsInbound || 1) - 1);
            }
          }
          if (event.payload.interceptorId) {
            removeRuntimeObject(world, event.payload.interceptorId);
          }
          if (shooter && event.payload.sourceEffectorId) {
            const effectorState = getEffectorRuntimeState(shooter, event.payload.sourceEffectorId);
            if (effectorState) {
              effectorState.inFlightChildId = null;
              if (effectorState.missionState === "Engaging" && event.time >= (shooter.runtime.lastFireTimeSec[event.payload.sourceEffectorId] || 0)) {
                clearEffectorAssignment(shooter, event.payload.sourceEffectorId, world);
              }
            }
          }

          services.events.scheduleDelay(event.time, 0, {
            type: "damage.resolve",
            priority: EVENT_PRIORITIES.damage,
            payload: {
              targetId: target.id,
              trackId: track.id,
              hit,
              damagePoints: event.payload.damagePoints
            }
          }, { enforceMinimumDelay: true });
        }

        reset(event, world, services) {
          const shooter = getObject(world, event.payload.shooterId);
          const effector = shooter
            ? (shooter.components.effectors || []).find((candidate) => candidate.id === event.payload.effectorId)
            : null;
          if (!shooter || !effector) {
            return;
          }

          const effectorState = getEffectorRuntimeState(shooter, effector.id);
          if (!effectorState || effectorState.missionState !== "Engaging") {
            return;
          }

          if (effectorState.inFlightChildId && getObject(world, effectorState.inFlightChildId)) {
            if (effector.guidanceType === "Command") {
              return;
            }
            effectorState.inFlightChildId = null;
            clearEffectorAssignment(shooter, effector.id, world);
            return;
          }

          const activeTrackId = effectorState.lockedTrackId || event.payload.trackId;
          const activeTargetId = effectorState.lockedTargetId || event.payload.targetId;
          const activeTrack = activeTrackId ? getTrack(world, activeTrackId) : null;
          const activeTarget = activeTargetId ? getObject(world, activeTargetId) : null;
          effectorState.inFlightChildId = null;
          if (effector.type !== "Interceptor" && this.canContinueEngagement(world, shooter, effector, activeTrack, activeTarget, event.time)) {
            services.logger.record(
              world,
              event.time,
              "effector",
              shooter.name + " maintained lock with " + effector.name + " and prepared to refire",
              {
                shooterId: shooter.id,
                trackId: activeTrackId,
                targetId: activeTargetId,
                reason: "cooldown-complete-target-still-valid"
              }
            );
            services.events.scheduleDelay(event.time, 0, {
              type: "effector.fire",
              priority: EVENT_PRIORITIES.effector,
              payload: {
                shooterId: shooter.id,
                effectorId: effector.id,
                trackId: activeTrackId,
                targetId: activeTargetId
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          const releasedTrackId = activeTrackId;
          const releasedTargetId = activeTargetId;
          clearEffectorAssignment(shooter, effector.id, world);
          services.logger.record(
            world,
            event.time,
            "effector",
            shooter.name + " reset " + effector.name + " to Idle",
            {
              shooterId: shooter.id,
              trackId: releasedTrackId,
              targetId: releasedTargetId,
              reason: "cooldown-complete"
            }
          );
        }
      }

      class DamageSystem {
        process(event, world, services) {
          applyDamageEvent(world, event.payload, event.time, services);
        }
      }

      class MonteCarloManager {
        constructor(simulationManager) {
          this.simulationManager = simulationManager;
        }

        run(iterations, options = {}) {
          const rows = [];
          for (let index = 0; index < iterations; index += 1) {
            const seed = options.baseSeed + index;
            const result = this.simulationManager.run({
              seed,
              captureFrames: false,
              scenario: options.scenario
            });
            rows.push(createCsvRow(index + 1, result.report));
            if (typeof options.onProgress === "function") {
              options.onProgress(index + 1, iterations);
            }
          }
          return rows;
        }
      }

      class SimulationManager {
        constructor() {
          this.logger = new LoggingSystem();
          this.environmentSystem = new EnvironmentSystem();
          this.movementSystem = new MovementSystem();
          this.sensorSystem = new SensorSystem();
          this.trackSystem = new TrackSystem();
          this.classificationSystem = new ClassificationSystem();
          this.identificationSystem = new IdentificationSystem();
          this.intentSystem = new IntentSystem();
          this.c2System = new C2System();
          this.networkSystem = new NetworkSystem();
          this.effectSystem = new EffectSystem();
          this.impactSystem = new ImpactSystem();
          this.damageSystem = new DamageSystem();
        }

        run(options = {}) {
          const seed = Number.isFinite(options.seed) ? options.seed : Math.floor((Date.now() % 2147483647));
          const scenario = normalizeScenario(options.scenario || buildBaselineScenario());
          const rng = new SeededRNG(seed);
          const runtime = this.createRuntimeWorld(scenario, rng, options.captureFrames !== false);

          const services = {
            rng,
            logger: this.logger,
            events: runtime.eventManager,
            captureFrame: (world, timeSec, reason) => {
              if (!world.captureFrames) {
                return;
              }
              world.frames.push(snapshotWorld(world, timeSec, reason));
            }
          };

          this.environmentSystem.initialize(runtime, services);

          runtime.objectIds.forEach((objectId) => {
            const object = runtime.objects[objectId];
            if (object.components.movement) {
              runtime.eventManager.schedule({
                time: 0,
                type: "movement.step",
                priority: EVENT_PRIORITIES.movement,
                payload: { objectId }
              });
            }
            if ((object.components.sensors || []).length > 0) {
              runtime.eventManager.schedule({
                time: 0,
                type: "sensor.scan",
                priority: EVENT_PRIORITIES.sensor,
                payload: { objectId }
              });
            }
          });

          services.captureFrame(runtime, 0, "initial");

          while (runtime.eventManager.hasEvents()) {
            const event = runtime.eventManager.next();
            runtime.currentTimeSec = event.time;
            if (runtime.currentTimeSec > runtime.config.maxTimeSec) {
              break;
            }

            switch (event.type) {
              case "movement.step":
                this.movementSystem.process(event, runtime, services);
                break;
              case "sensor.scan":
                this.sensorSystem.process(event, runtime, services);
                break;
              case "sensor.releaseCue":
                this.sensorSystem.releaseCue(event, runtime, services);
                break;
              case "environment.process":
                this.environmentSystem.process(event, runtime, services);
                break;
              case "track.process":
                this.trackSystem.process(event, runtime, services);
                break;
              case "track.age":
                this.trackSystem.age(event, runtime, services);
                break;
              case "classification.process":
                this.classificationSystem.process(event, runtime, services);
                break;
              case "identification.process":
                this.identificationSystem.process(event, runtime, services);
                break;
              case "intent.process":
                this.intentSystem.process(event, runtime, services);
                break;
              case "c2.decide":
                this.c2System.process(event, runtime, services);
                break;
              case "network.restore":
                this.networkSystem.restore(event, runtime, services);
                break;
              case "effector.fire":
                this.effectSystem.fire(event, runtime, services);
                break;
              case "effector.reset":
                this.effectSystem.reset(event, runtime, services);
                break;
              case "effect.resolve":
                this.effectSystem.resolve(event, runtime, services);
                break;
              case "damage.resolve":
                this.damageSystem.process(event, runtime, services);
                break;
              case "impact.resolve":
                this.impactSystem.resolve(event, runtime, services);
                break;
              default:
                break;
            }

            const allRedUasDestroyed = runtime.objectIds
              .map((id) => runtime.objects[id])
              .filter((object) => object.side === "Red" && object.roles.includes("UAS"))
              .every((object) => object.runtime.destroyed);
            if (allRedUasDestroyed) {
              runtime.currentTimeSec = round(event.time, 2);
              break;
            }
          }

          services.captureFrame(runtime, runtime.currentTimeSec, "final");
          return finalizeReport(runtime, seed);
        }

        createRuntimeWorld(scenario, rng, captureFrames) {
          const eventManager = new EventManager();
          const templateMap = {};
          scenario.templates.forEach((template) => {
            templateMap[template.id] = deepClone(template);
          });

          const objects = {};
          const objectIds = [];
          scenario.instances.forEach((instance) => {
            const template = templateMap[instance.templateId];
            if (!template) {
              return;
            }
            const object = {
              id: instance.id,
              templateId: template.id,
              name: instance.name,
              side: instance.side,
              roles: normalizeRoles(instance.roles, template.defaultRoles),
              missionProfile: deepClone(template.missionProfile || normalizeMissionProfile({})),
              components: deepClone(template.components),
              runtime: {
                position: { x: instance.posX, y: instance.posY, z: instance.posZ },
                initialPosition: { x: instance.posX, y: instance.posY, z: instance.posZ },
                spawnTimeSec: 0,
                health: template.components.health.maxHealth,
                operationalStatus: "Active",
                destroyed: false,
                ammo: {},
                lastFireTimeSec: {},
                sensorStates: {},
                effectorStates: {},
                mission: {
                  currentWaypointIndex: 0,
                  waypoints: deepClone(instance.missionWaypoints || [])
                },
                missionProfile: deepClone(template.missionProfile || normalizeMissionProfile({})),
                behaviorState: "Route",
                behaviorTargetId: null,
                lastCueLogTrackId: null,
                controlMode: instance.side === "Red"
                  ? (template.components.capability.requiresC2 ? "Networked" : "AutonomousFallback")
                  : (template.components.capability.requiresC2 ? "C2Directed" : "AutonomousFallback"),
                c2AssignedTargetId: null
                ,
                jammedUntilSec: 0,
                spoofedOffset: null,
                spoofedUntilSec: 0,
                telemetrySpoofed: false,
                telemetryOffsetXY: null,
                telemetrySpoofedUntilSec: 0
              }
            };

            if (object.components.movement) {
              const firstWaypoint = object.runtime.mission.waypoints[0] || null;
              const seededHeadingDeg = normalizeHeadingDeg(instance.headingDeg ?? 0);
              object.runtime.currentSpeedMps = 0;
              object.runtime.currentHeadingDeg = firstWaypoint
                ? round(angleDeg(object.runtime.position, firstWaypoint), 2)
                : seededHeadingDeg;
            } else {
              object.runtime.currentSpeedMps = null;
              object.runtime.currentHeadingDeg = normalizeHeadingDeg(instance.headingDeg ?? 0);
            }

            if (Number.isFinite(object.runtime.currentHeadingDeg)) {
              syncFpvSensorHeading(object, object.runtime.currentHeadingDeg);
            }

            (object.components.sensors || []).forEach((sensor) => {
              object.runtime.sensorStates[sensor.id] = {
                missionState: "Scanning",
                cuedTrackId: null,
                busyUntilSec: 0,
                lastCueTimeSec: null
              };
            });

            (object.components.effectors || []).forEach((effector) => {
              object.runtime.ammo[effector.id] = effector.ammoCapacity;
              object.runtime.lastFireTimeSec[effector.id] = 0;
              object.runtime.effectorStates[effector.id] = {
                missionState: "Idle",
                lockedTrackId: null,
                lockedTargetId: null,
                inFlightChildId: null
              };
            });

            objects[object.id] = object;
            objectIds.push(object.id);
          });

          const infrastructure = {
            Blue: {
              network: {
                id: "Blue-C2-Net-Default",
                name: "Blue Hidden C2 Network",
                side: "Blue",
                type: "RF",
                transmissionLatencySec: 0.25,
                status: "Connected",
                jammedUntilSec: 0,
                degradedUntilSec: 0,
                sensorNoisePenaltyDb: 0
              },
              power: {
                id: "Blue-Power-Default",
                name: "Blue Hidden Power Grid",
                side: "Blue",
                gridType: "Tactical",
                totalCapacityKw: 1000,
                currentLoadKw: 0,
                status: "Online"
              }
            },
            Red: {
              network: {
                id: "Red-C2-Net-Default",
                name: "Red Hidden C2 Network",
                side: "Red",
                type: "RF",
                transmissionLatencySec: 0.25,
                status: "Connected",
                jammedUntilSec: 0,
                degradedUntilSec: 0,
                sensorNoisePenaltyDb: 0
              },
              power: {
                id: "Red-Power-Default",
                name: "Red Hidden Power Grid",
                side: "Red",
                gridType: "Tactical",
                totalCapacityKw: 1000,
                currentLoadKw: 0,
                status: "Online"
              }
            }
          };
          objectIds.forEach((objectId) => {
            const object = objects[objectId];
            const sideInfrastructure = infrastructure[object.side];
            if (!sideInfrastructure) {
              return;
            }
            sideInfrastructure.power.currentLoadKw += Number(object.components.powerConsumer?.powerConsumedKw || 0);
            object.runtime.infrastructure = {
              networkId: sideInfrastructure.network.id,
              powerGridId: sideInfrastructure.power.id
            };
          });
          Object.values(infrastructure).forEach((entry) => {
            if (entry.power.currentLoadKw > entry.power.totalCapacityKw) {
              entry.power.status = "Overloaded";
            }
          });

          return {
            scenario: deepClone(scenario),
            objects,
            objectIds,
            infrastructure,
            blueTracks: {},
            redTracks: {},
            nextBlueTrackId: 1,
            nextRedTrackId: 1,
            logs: [],
            assessmentSnapshots: [],
            frames: [],
            config: deepClone(scenario.config),
            environment: {
              ...deepClone(scenario.environment),
              activeAnomalies: [],
              activeClutter: [],
              nextAnomalyIndex: 0,
              nextClutterIndex: 0
            },
            eventManager,
            captureFrames,
            currentTimeSec: 0,
            randomization: {
              classificationBias: clamp(rng.nextGaussian(0, 0.03), -0.08, 0.08),
              identificationBias: clamp(rng.nextGaussian(0, 0.03), -0.08, 0.08),
              intentBias: clamp(rng.nextGaussian(0, 0.02), -0.05, 0.05),
              pkBias: clamp(rng.nextGaussian(0, 0.05), -0.12, 0.12)
            },
            metrics: {
              detectionCandidates: 0,
              tracksCreated: 0,
              tracksDropped: 0,
              ghostTracksGenerated: 0,
              classifications: 0,
              identifications: 0,
              intentsAssessed: 0,
              c2Decisions: 0,
              shotsFired: 0,
              damageResolutions: 0,
              targetsDestroyed: 0,
              interceptorLaunches: 0,
             interceptorResolutions: 0,
             interceptorAborts: 0,
             terrainCollisions: 0,
             ewEvents: 0,
             spoofEvents: 0,
             cyberEvents: 0,
             networkJamEvents: 0,
             fallbackTransitions: 0,
             successfulStrikes: 0,
             firstDetectionTimeSec: null,
             firstDetectionRangeM: null,
             killTimeSec: null,
             ammoExpended: {}
            }
          };
        }
      }

      return {
        EVENT_PRIORITIES,
        clamp,
        round,
        deepClone,
        ensureArray,
        angleDeg,
        normalizeHeadingDeg,
        normalizeScenario,
        validateScenario,
        buildBaselineScenario,
        buildDemoScenario,
        buildScratchScenario,
        createCsvRow,
        rowsToCsv,
        SimulationManager,
        MonteCarloManager
      };
    }

    const SIMULATION_KERNEL = createSimulationKernel();

    function downloadText(filename, text, mimeType) {
      const blob = new Blob([text], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    }

    function buildSafeFileStem(name) {
      return String(name || "scenario")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        || "scenario";
    }

    async function copyTextToClipboard(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getNestedValue(source, path) {
      if (!source || !path) {
        return undefined;
      }
      return String(path)
        .split(".")
        .reduce((current, segment) => current == null ? undefined : current[segment], source);
    }

    function setNestedValue(target, path, value) {
      if (!target || !path) {
        return;
      }
      const parts = String(path).split(".");
      const lastPart = parts.pop();
      let current = target;
      parts.forEach((segment) => {
        if (current[segment] == null || typeof current[segment] !== "object") {
          current[segment] = {};
        }
        current = current[segment];
      });
      current[lastPart] = value;
    }

    function createMonteCarloWorker() {
      const workerSource = `
        const createSimulationKernel = ${createSimulationKernel.toString()};
        const kernel = createSimulationKernel();
        const simulationManager = new kernel.SimulationManager();
        const monteCarloManager = new kernel.MonteCarloManager(simulationManager);
        self.onmessage = function (event) {
          const message = event.data || {};
          if (message.type !== "runMonteCarlo") {
            return;
          }
          try {
            const rows = monteCarloManager.run(message.iterations, {
              baseSeed: message.baseSeed,
              scenario: message.scenario,
              onProgress: function (completed, total) {
                if (completed % 5 === 0 || completed === total) {
                  self.postMessage({ type: "progress", completed, total });
                }
              }
            });
            self.postMessage({ type: "complete", rows });
          } catch (error) {
            self.postMessage({ type: "error", message: error && error.message ? error.message : String(error) });
          }
        };
      `;
      const blob = new Blob([workerSource], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      return worker;
    }

    class MapRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.scenario = null;
        this.viewport = {
          zoom: 1,
          offsetX: 0,
          offsetY: 0
        };
        this.backgroundImage = null;
        this.isDragging = false;
        this.lastPointer = null;
        this.onViewportChange = null;
        this.selectedEntity = null;
        this.lastFrame = null;
        this.lastReport = null;
        this.bindInteractions();
      }

      bindInteractions() {
        this.canvas.addEventListener("wheel", (event) => {
          event.preventDefault();
          const delta = event.deltaY < 0 ? 1.08 : 0.92;
          this.viewport.zoom = SIMULATION_KERNEL.clamp(this.viewport.zoom * delta, 0.65, 2.8);
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        });
        this.canvas.addEventListener("pointerdown", (event) => {
          this.isDragging = true;
          this.lastPointer = { x: event.clientX, y: event.clientY };
          this.canvas.setPointerCapture(event.pointerId);
        });
        this.canvas.addEventListener("pointermove", (event) => {
          if (!this.isDragging || !this.lastPointer) {
            return;
          }
          this.viewport.offsetX += event.clientX - this.lastPointer.x;
          this.viewport.offsetY += event.clientY - this.lastPointer.y;
          this.lastPointer = { x: event.clientX, y: event.clientY };
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        });
        const endDrag = (event) => {
          this.isDragging = false;
          this.lastPointer = null;
          if (event?.pointerId != null) {
            this.canvas.releasePointerCapture(event.pointerId);
          }
        };
        this.canvas.addEventListener("pointerup", endDrag);
        this.canvas.addEventListener("pointerleave", endDrag);
      }

      setScenario(scenario) {
        this.scenario = scenario || null;
        const src = this.scenario?.environment?.backgroundImageBase64 || "";
        if (!src) {
          this.backgroundImage = null;
          return;
        }
        const image = new Image();
        image.onload = () => {
          if (typeof this.onViewportChange === "function") {
            this.onViewportChange();
          }
        };
        image.src = src;
        this.backgroundImage = image;
      }

      resetViewport() {
        this.viewport.zoom = 1;
        this.viewport.offsetX = 0;
        this.viewport.offsetY = 0;
      }

      setSelection(selection) {
        this.selectedEntity = selection || null;
      }

      getPixelsPerMeter() {
        const mapWidthMeters = Math.max(100, Number(this.scenario?.environment?.mapWidthMeters || 1080));
        return (this.width / mapWidthMeters) * this.viewport.zoom;
      }

      worldToCanvas(position) {
        const ppm = this.getPixelsPerMeter();
        return {
          x: (position.x * ppm) + this.viewport.offsetX,
          y: (position.y * ppm) + this.viewport.offsetY
        };
      }

      canvasToWorld(canvasPoint) {
        const ppm = this.getPixelsPerMeter();
        return {
          x: (canvasPoint.x - this.viewport.offsetX) / ppm,
          y: (canvasPoint.y - this.viewport.offsetY) / ppm,
          z: 0
        };
      }

      eventToCanvas(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / rect.width) * this.width,
          y: ((event.clientY - rect.top) / rect.height) * this.height
        };
      }

      hitTest(frame, event) {
        if (!frame) {
          return null;
        }
        const point = this.eventToCanvas(event);
        const candidates = [];
        (frame.objects || []).forEach((object) => {
          const canvasPoint = this.worldToCanvas({ x: object.x, y: object.y });
          candidates.push({
            type: "object",
            id: object.id,
            name: object.name,
            side: object.side,
            distancePx: Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y)
          });
        });
        (frame.tracks || []).forEach((track) => {
          if (track.x == null || track.y == null) {
            return;
          }
          const canvasPoint = this.worldToCanvas({ x: track.x, y: track.y });
          candidates.push({
            type: "track",
            id: track.id,
            name: track.id,
            side: "Blue",
            distancePx: Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y)
          });
        });
        return candidates
          .filter((candidate) => candidate.distancePx <= 24)
          .sort((left, right) => left.distancePx - right.distancePx)[0] || null;
      }

      draw(frame, report) {
        const ctx = this.context;
        this.lastFrame = frame || null;
        this.lastReport = report || null;
        ctx.clearRect(0, 0, this.width, this.height);
        this.drawTerrain(ctx);
        this.drawBackground(ctx);
        this.drawScale(ctx);
        if (!frame) {
          return;
        }

        frame.objects.forEach((object) => {
          if (object.side === "Blue") {
            this.drawBlueObject(ctx, object);
          } else {
            this.drawRedObject(ctx, object);
          }
        });

        frame.tracks.forEach((track) => {
          if (track.x === null || track.status === "Destroyed") {
            return;
          }
          this.drawTrack(ctx, track);
        });

        (frame.clutterPlaceholders || []).forEach((placeholder) => {
          this.drawClutterPlaceholder(ctx, placeholder);
        });

        this.drawSelection(ctx, frame);

        this.drawOverlay(ctx, frame, report);
      }

      drawSelection(ctx, frame) {
        if (!this.selectedEntity) {
          return;
        }
        const target = this.selectedEntity.type === "track"
          ? (frame.tracks || []).find((track) => track.id === this.selectedEntity.id)
          : (frame.objects || []).find((object) => object.id === this.selectedEntity.id);
        if (!target) {
          return;
        }
        const position = this.selectedEntity.type === "track"
          ? this.worldToCanvas({ x: target.x, y: target.y })
          : this.worldToCanvas({ x: target.x, y: target.y });
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      drawBackground(ctx) {
        if (!this.backgroundImage || !this.backgroundImage.complete) {
          return;
        }
        ctx.save();
        ctx.globalAlpha = 0.32;
        const aspectRatio = this.backgroundImage.height / Math.max(this.backgroundImage.width, 1);
        const drawWidth = this.width * this.viewport.zoom;
        const drawHeight = drawWidth * aspectRatio;
        ctx.drawImage(
          this.backgroundImage,
          this.viewport.offsetX,
          this.viewport.offsetY,
          drawWidth,
          drawHeight
        );
        ctx.restore();
      }

      drawTerrain(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, "rgba(63, 116, 138, 0.45)");
        gradient.addColorStop(0.55, "rgba(44, 86, 94, 0.26)");
        gradient.addColorStop(1, "rgba(68, 59, 37, 0.55)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= this.width; x += 90) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.height);
          ctx.stroke();
        }
        for (let y = 0; y <= this.height; y += 90) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.width, y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 220, 152, 0.08)";
        ctx.beginPath();
        ctx.moveTo(0, this.height * 0.82);
        ctx.lineTo(this.width * 0.22, this.height * 0.74);
        ctx.lineTo(this.width * 0.36, this.height * 0.85);
        ctx.lineTo(0, this.height);
        ctx.closePath();
        ctx.fill();

        (Array.isArray(this.scenario?.terrainObjects) ? this.scenario.terrainObjects : []).forEach((terrain) => {
          if (!terrain.areaPolygon || terrain.areaPolygon.length < 3) {
            return;
          }
          ctx.save();
          ctx.beginPath();
          terrain.areaPolygon.forEach((point, index) => {
            const canvasPoint = this.worldToCanvas(point);
            if (index === 0) {
              ctx.moveTo(canvasPoint.x, canvasPoint.y);
            } else {
              ctx.lineTo(canvasPoint.x, canvasPoint.y);
            }
          });
          ctx.closePath();
          if (terrain.interferenceType === "Noise") {
            ctx.fillStyle = "rgba(243, 180, 75, 0.16)";
            ctx.strokeStyle = "rgba(243, 180, 75, 0.75)";
            ctx.setLineDash([7, 5]);
          } else {
            ctx.fillStyle = "rgba(124, 214, 255, 0.15)";
            ctx.strokeStyle = "rgba(124, 214, 255, 0.72)";
          }
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          const centroid = terrain.areaPolygon.reduce((accumulator, point) => ({
            x: accumulator.x + point.x,
            y: accumulator.y + point.y
          }), { x: 0, y: 0 });
          const labelPoint = this.worldToCanvas({
            x: centroid.x / terrain.areaPolygon.length,
            y: centroid.y / terrain.areaPolygon.length
          });
          ctx.fillStyle = "#f7f0df";
          ctx.font = "12px Trebuchet MS";
          ctx.fillText(terrain.label, labelPoint.x + 8, labelPoint.y - 6);
          ctx.restore();
        });
      }

      drawScale(ctx) {
        const ppm = this.getPixelsPerMeter();
        const barMeters = 100;
        const barPixels = Math.max(24, barMeters * ppm);
        ctx.fillStyle = "rgba(10, 16, 20, 0.55)";
        ctx.fillRect(18, this.height - 42, barPixels, 18);
        ctx.fillStyle = "#f7f0df";
        ctx.fillRect(18, this.height - 42, barPixels / 2, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeRect(18, this.height - 42, barPixels, 18);
        ctx.fillStyle = "#f7f0df";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText("0", 18, this.height - 48);
        ctx.fillText(barMeters + "m", 18 + barPixels - 16, this.height - 48);
      }

      drawSector(ctx, position, rangeM, headingDeg, fovDeg, strokeStyle) {
        const center = this.worldToCanvas(position);
        const radius = Math.max(2, rangeM * this.getPixelsPerMeter());
        const start = (headingDeg - (fovDeg / 2)) * (Math.PI / 180);
        const end = (headingDeg + (fovDeg / 2)) * (Math.PI / 180);
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.fillStyle = strokeStyle.replace("0.22", "0.08");
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.arc(center.x, center.y, radius, start, end);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      drawRangeRing(ctx, position, rangeM, strokeStyle) {
        const center = this.worldToCanvas(position);
        const radius = Math.max(2, rangeM * this.getPixelsPerMeter());
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawBlueObject(ctx, object) {
        const worldPosition = { x: object.x, y: object.y };
        const position = this.worldToCanvas(worldPosition);
        if (object.isInterceptorChild) {
          ctx.save();
          ctx.fillStyle = "#7dffb1";
          ctx.beginPath();
          ctx.arc(position.x, position.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#eafff2";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        (object.sensors || []).forEach((sensor) => {
          if ((sensor.horizontalFovDeg || 360) >= 359) {
            this.drawRangeRing(ctx, worldPosition, sensor.maxRangeM, "rgba(89, 183, 207, 0.22)");
          } else {
            this.drawSector(ctx, worldPosition, sensor.maxRangeM, sensor.headingDeg || 0, sensor.horizontalFovDeg || 360, "rgba(89, 183, 207, 0.22)");
          }
        });
        (object.effectors || []).forEach((effector) => {
          this.drawRangeRing(ctx, worldPosition, effector.maxRangeM, "rgba(125, 255, 177, 0.24)");
        });

        ctx.fillStyle = "#59b7cf";
        ctx.beginPath();
        ctx.arc(position.x, position.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d9f2f8";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#d9f2f8";
        ctx.font = "bold 13px Trebuchet MS";
        ctx.fillText(object.name, position.x + 16, position.y - 10);
        ctx.restore();
      }

      drawRedObject(ctx, object) {
        const worldPosition = { x: object.x, y: object.y };
        const position = this.worldToCanvas(worldPosition);
        if (object.isInterceptorChild) {
          ctx.save();
          ctx.strokeStyle = "#ffe6dd";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(position.x, position.y - 6);
          ctx.lineTo(position.x + 6, position.y);
          ctx.lineTo(position.x, position.y + 6);
          ctx.lineTo(position.x - 6, position.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        ctx.fillStyle = object.destroyed ? "rgba(216, 91, 74, 0.35)" : "#d85b4a";
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - 12);
        ctx.lineTo(position.x + 14, position.y);
        ctx.lineTo(position.x, position.y + 12);
        ctx.lineTo(position.x - 14, position.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffd4c8";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (object.destroyed) {
          ctx.beginPath();
          ctx.moveTo(position.x - 16, position.y - 16);
          ctx.lineTo(position.x + 16, position.y + 16);
          ctx.moveTo(position.x + 16, position.y - 16);
          ctx.lineTo(position.x - 16, position.y + 16);
          ctx.stroke();
        }

        ctx.fillStyle = "#ffe6dd";
        ctx.font = "bold 13px Trebuchet MS";
        ctx.fillText(object.name, position.x + 16, position.y - 10);
        if (Number.isFinite(object.currentHeadingDeg)) {
          const headingRad = object.currentHeadingDeg * (Math.PI / 180);
          ctx.strokeStyle = "rgba(255, 212, 200, 0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(position.x, position.y);
          ctx.lineTo(position.x + (Math.cos(headingRad) * 36), position.y + (Math.sin(headingRad) * 36));
          ctx.stroke();
        }
        ctx.restore();
      }

      drawTrack(ctx, track) {
        const position = this.worldToCanvas({ x: track.x, y: track.y });
        ctx.save();
        if (track.status === "Dropped") {
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "rgba(214, 214, 214, 0.9)";
        } else {
          ctx.strokeStyle = "#ffcc71";
        }
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - 11);
        ctx.lineTo(position.x + 11, position.y);
        ctx.lineTo(position.x, position.y + 11);
        ctx.lineTo(position.x - 11, position.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = track.status === "Dropped" ? "#d7d7d7" : "#ffcc71";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText(track.id, position.x + 14, position.y + 4);
        if (Number.isFinite(track.headingDeg)) {
          const headingRad = track.headingDeg * (Math.PI / 180);
          ctx.strokeStyle = "rgba(255, 204, 113, 0.85)";
          ctx.beginPath();
          ctx.moveTo(position.x, position.y);
          ctx.lineTo(position.x + (Math.cos(headingRad) * 24), position.y + (Math.sin(headingRad) * 24));
          ctx.stroke();
        }
        ctx.restore();
      }

      drawClutterPlaceholder(ctx, placeholder) {
        const position = this.worldToCanvas({ x: placeholder.centerX, y: placeholder.centerY });
        ctx.save();
        ctx.strokeStyle = "rgba(168, 85, 255, 0.48)";
        ctx.fillStyle = "rgba(80, 216, 255, 0.08)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(position.x, position.y, placeholder.radiusM * this.getPixelsPerMeter(), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#caa7ff";
        ctx.font = "12px Trebuchet MS";
        ctx.fillText(placeholder.label || "Clutter Placeholder", position.x + 12, position.y - 10);
        ctx.restore();
      }

      drawOverlay(ctx, frame, report) {
        ctx.save();
        ctx.fillStyle = "rgba(12, 16, 20, 0.6)";
        ctx.fillRect(this.width - 280, 14, 262, 116);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.strokeRect(this.width - 280, 14, 262, 116);
        ctx.fillStyle = "#f7f0df";
        ctx.font = "bold 14px Trebuchet MS";
        ctx.fillText("Timeline Snapshot", this.width - 262, 36);
        ctx.font = "13px Trebuchet MS";
        ctx.fillText("Scenario: " + escapeHtml(report?.scenarioName || "Preview"), this.width - 262, 58);
        ctx.fillText("Time: " + SIMULATION_KERNEL.round(frame.timeSec, 2) + " s", this.width - 262, 78);
        ctx.fillText("Tracks: " + frame.tracks.length, this.width - 262, 98);
        ctx.fillText("Destroyed: " + (report && report.targetDestroyed ? "Yes" : "No"), this.width - 262, 118);
        ctx.restore();
      }
    }

    class UIManager {
      constructor() {
        this.screens = {
          "demo-tutorial": document.getElementById("screen-dashboard"),
          "template-editor": document.getElementById("screen-templates"),
          "environment-extractor": document.getElementById("screen-environment"),
          "scenario-editor": document.getElementById("screen-wizard"),
          "run-scenario": document.getElementById("screen-run"),
          "view-reports": document.getElementById("screen-report"),
          about: document.getElementById("screen-export")
        };
        this.defaultModule = "demo-tutorial";
      }

      showScreen(moduleId) {
        const aliases = {
          dashboard: "demo-tutorial",
          templates: "template-editor",
          wizard: "scenario-editor",
          run: "run-scenario",
          report: "view-reports",
          export: "about"
        };
        const resolvedId = aliases[moduleId] || moduleId;
        const targetId = this.screens[resolvedId] ? resolvedId : this.defaultModule;
        Object.entries(this.screens).forEach(([screenId, element]) => {
          if (!element) {
            return;
          }
          element.classList.toggle("active", screenId === targetId);
          element.classList.remove("sidebar-active");
          element.classList.remove("map-hidden");
        });
        document.querySelectorAll(".nav-button").forEach((button) => {
          button.classList.toggle("active", button.dataset.module === targetId);
        });
      }

      closePanels() {
        this.showScreen(this.defaultModule);
      }

      closeAllSideTrays() {
        this.showScreen(this.defaultModule);
      }
    }

    class AppController {
      constructor() {
        this.kernel = SIMULATION_KERNEL;
        this.uiManager = new UIManager();
        this.simulationManager = new this.kernel.SimulationManager();
        this.monteCarloManager = new this.kernel.MonteCarloManager(this.simulationManager);
        const bundledDemoScenario = globalThis.__CSUAS_SCENARIO_SOURCES?.["scenario:demo"];
        const initialScenario = bundledDemoScenario
          ? this.kernel.normalizeScenario(JSON.parse(JSON.stringify(bundledDemoScenario)))
          : this.kernel.buildDemoScenario();
        const initialStagedScenario = this.kernel.deepClone(initialScenario);
        this.renderer = new MapRenderer(document.getElementById("sim-canvas"));
        this.builderRenderer = new MapRenderer(document.getElementById("builder-canvas"));
        this.demoRenderer = new MapRenderer(document.getElementById("demo-canvas"));
        this.debriefRenderer = new MapRenderer(document.getElementById("debrief-canvas"));
        this.demoRenderer.canvas.style.pointerEvents = "none";
        this.renderer.onViewportChange = () => this.renderCurrentView();
        this.builderRenderer.onViewportChange = () => this.renderBuilderView();
        this.demoRenderer.onViewportChange = () => this.renderDemoPreview();
        this.debriefRenderer.onViewportChange = () => this.renderDebriefView();
        this.state = {
          currentScenario: initialScenario,
          currentScenarioSource: "demo",
          stagedScenario: initialStagedScenario,
          stagedScenarioSource: "demo",
          singleRun: null,
          monteCarloRows: [],
          currentFrame: null,
          currentReport: null,
          playbackTimer: null,
          playbackFrames: [],
          playbackIndex: 0,
          monteCarloWorker: null,
          selectedTemplateId: null,
          templateEditorSensors: [],
          templateEditorEffectors: [],
          activeTemplateSensorIndex: 0,
          activeTemplateEffectorIndex: 0,
          templateJsonDirty: false,
          templateSearch: "",
          dashboardTab: "demo",
          reportTab: "monte-carlo",
          exportTab: "report",
          exportPrettyJson: true,
          scenarioExportSource: "normalized",
          originalScenarioPayloadText: "",
          scenarioBuilderTab: "draft",
          scenarioSourceCache: {},
          wizardBlueAssets: [],
          wizardThreatGroups: [],
          activeWizardBlueAssetId: null,
          activeWizardThreatGroupId: null,
          mapInteraction: null,
          selectedMapEntity: null,
          selectedTutorialLessonId: "1",
          selectedRunTelemetry: null,
          selectedMonteCarloRowIndex: null,
          nextWizardBlueAssetId: 1,
          nextWizardThreatGroupId: 1,
          lastImportSummary: {
            source: "Built-in baseline",
            templateCount: 0,
            instanceCount: 0,
            normalizedChanged: false,
            dirty: false
          }
        };
        this.bindEvents();
        this.applyQueryParams();
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.clearResults();
        this.syncWizardDraftFromScenario();
        this.refreshScenarioEditors();
        this.uiManager.showScreen("demo-tutorial");
        this.renderDashboardTabs();
        this.renderReportTabs();
        this.updateMapSelectionChip();
        this.handleAutorun();
      }

      bindEvents() {
        const bindClick = (id, handler) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener("click", handler);
          }
        };
        const bindChange = (id, handler) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener("change", handler);
          }
        };
        const bindInput = (id, handler) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener("input", handler);
          }
        };

        document.querySelectorAll(".nav-button").forEach((button) => {
          button.addEventListener("click", () => {
            this.uiManager.showScreen(button.dataset.module);
          });
        });
        document.querySelectorAll(".dashboard-tab-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.setDashboardTab(button.dataset.dashboardTab);
          });
        });
        document.querySelectorAll(".scenario-builder-tab").forEach((button) => {
          button.addEventListener("click", () => {
            this.setScenarioBuilderTab(button.dataset.builderTab);
          });
        });
        document.querySelectorAll(".report-tab-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.setReportTab(button.dataset.reportTab);
          });
        });

        bindClick("new-scenario-btn", async () => {
          await this.resetToBaselineScenario();
        });
        bindClick("demo-load-scenario-btn", async () => {
          await this.loadDemoScenario(true);
          this.uiManager.showScreen("demo-tutorial");
        });
        bindClick("demo-load-scratch-btn", async () => {
          await this.loadScratchScenario(true);
          this.uiManager.showScreen("demo-tutorial");
        });
        bindClick("demo-open-builder-btn", () => {
          this.uiManager.showScreen("scenario-editor");
        });
        bindClick("open-scenario-sidebar-btn", () => {
          this.uiManager.showScreen("scenario-editor");
        });
        bindClick("open-scenario-builder-inline-btn", () => {
          this.uiManager.showScreen("scenario-editor");
        });
        bindClick("open-roster-inline-btn", () => {
          this.uiManager.showScreen("scenario-editor");
          document.getElementById("wizard-roster-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        bindClick("load-scenario-header-btn", () => {
          document.getElementById("scenario-file-input").click();
        });
        bindClick("environment-load-scenario-btn", () => {
          document.getElementById("environment-scenario-file-input").click();
        });
        bindClick("save-scenario-btn", () => {
          this.exportCurrentScenario();
        });
        bindClick("open-template-sidebar-btn", () => {
          this.uiManager.showScreen("template-editor");
        });
        bindClick("open-template-library-inline-btn", () => {
          this.uiManager.showScreen("template-editor");
        });
        bindClick("open-analysis-sidebar-btn", () => {
          this.uiManager.showScreen("view-reports");
        });
        bindClick("open-analysis-inline-btn", () => {
          this.uiManager.showScreen("view-reports");
        });
        bindClick("open-export-sidebar-btn", () => {
          this.uiManager.showScreen("view-reports");
        });
        bindClick("open-environment-extractor-btn", () => {
          window.open("external_util/Environment_Extractor.html", "_blank", "noopener");
        });
        bindClick("open-template-manager-btn", () => {
          window.open("external_util/Template_Manager.html", "_blank", "noopener");
        });
        bindClick("about-open-environment-extractor-btn", () => {
          window.open("external_util/Environment_Extractor.html", "_blank", "noopener");
        });
        bindClick("about-open-template-manager-btn", () => {
          window.open("external_util/Template_Manager.html", "_blank", "noopener");
        });
        bindClick("demo-play-btn", () => {
          this.runSingleScenario({ targetScreen: "demo-tutorial", targetRenderers: [this.demoRenderer] });
        });
        bindClick("add-instance-btn", () => {
          this.addRosterInstance();
        });
        bindClick("add-blue-instance-btn", () => {
          this.addRosterInstance("Blue");
        });
        bindClick("add-red-instance-btn", () => {
          this.addRosterInstance("Red");
        });
        bindClick("run-monte-carlo-header-btn", () => {
          this.runMonteCarlo();
        });
        bindClick("zoom-reset-btn", () => {
          this.renderer.resetViewport();
          this.renderCurrentView();
          this.setStatus("Map viewport reset");
        });
        bindClick("builder-zoom-reset-btn", () => {
          this.builderRenderer.resetViewport();
          this.renderBuilderView();
          this.setStatus("Builder map viewport reset");
        });
        document.querySelectorAll("[data-close-sidebar]").forEach((button) => {
          button.addEventListener("click", () => {
            this.uiManager.closePanels();
          });
        });

        bindClick("run-single-btn", () => {
          this.runSingleScenario();
        });

        bindClick("run-monte-carlo-btn", () => {
          this.runMonteCarlo();
        });

        bindClick("load-scenario-btn", () => {
          document.getElementById("scenario-file-input").click();
        });

        bindChange("scenario-file-input", (event) => {
          this.importScenarioFile(event, "both");
        });
        bindChange("environment-scenario-file-input", (event) => {
          this.importScenarioFile(event, "both");
        });
        bindChange("wizard-scenario-file-input", (event) => {
          this.importScenarioFile(event, "draft");
        });

        bindClick("wizard-load-demo-btn", async () => {
          await this.loadDemoScenario(false);
        });

        bindClick("wizard-load-scratch-btn", async () => {
          await this.loadScratchScenario(false);
        });

        bindClick("wizard-import-scenario-btn", () => {
          document.getElementById("wizard-scenario-file-input").click();
        });

        bindClick("wizard-load-preset-btn", async () => {
          await this.loadWizardGeneratorPattern(document.getElementById("wizard-preset").value);
          this.refreshWizardSummary();
          this.setStatus("Pre-built scenario loaded into draft");
        });

        bindClick("wizard-validate-scenario-btn", () => {
          this.refreshValidationSummary();
          this.refreshWizardSummary();
          this.setStatus("Draft scenario validated");
        });

        bindClick("wizard-stage-current-scenario-btn", () => {
          this.stageCurrentScenario();
        });
        bindClick("wizard-export-scenario-btn", () => {
          this.exportCurrentScenario();
        });

        bindClick("wizard-add-threat-group-btn", () => {
          this.addWizardThreatGroup();
        });
        bindClick("wizard-add-blue-group-btn", () => {
          this.addWizardBlueAsset();
        });
        bindClick("debrief-play-btn", () => {
          this.replayDebrief();
        });
        bindClick("back-btn", () => {
          this.stepPlayback(-1);
        });
        bindClick("play-btn", () => {
          this.resumePlayback();
        });
        bindClick("pause-btn", () => {
          this.pausePlayback();
        });
        bindClick("forward-btn", () => {
          this.stepPlayback(1);
        });
        document.querySelectorAll(".wizard-jump-btn").forEach((button) => {
          button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.wizardTarget || "");
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
        });

        bindInput("map-width-input", (event) => {
          this.state.currentScenario.environment.mapWidthMeters = Number(event.target.value || 1080);
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
        });
        bindClick("map-background-upload-btn", () => {
          document.getElementById("map-background-input").click();
        });
        bindChange("map-background-input", (event) => {
          this.importMapBackground(event);
        });
        bindClick("clear-map-background-btn", () => {
          this.state.currentScenario.environment.backgroundImageBase64 = "";
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
          this.setStatus("Map background cleared");
        });
        bindClick("add-block-terrain-btn", () => {
          this.addTerrainObject("Block");
        });
        bindClick("add-noise-terrain-btn", () => {
          this.addTerrainObject("Noise");
        });
        bindClick("add-network-btn", () => {
          this.addNetwork();
        });
        bindClick("add-power-grid-btn", () => {
          this.addPowerGrid();
        });

        const syncDraftScenarioMetadata = () => {
          this.state.currentScenario.metadata = this.state.currentScenario.metadata || {};
          this.state.currentScenario.metadata.name = document.getElementById("wizard-scenario-name").value.trim() || "Scenario Editor Draft";
          this.state.currentScenario.metadata.description = document.getElementById("wizard-scenario-description").value.trim();
          this.state.lastImportSummary = {
            ...(this.state.lastImportSummary || {}),
            dirty: true
          };
          this.refreshWizardSummary();
          this.refreshExportPreview();
          this.renderRunReminder();
        };
        ["wizard-scenario-name", "wizard-scenario-description"].forEach((id) => {
          document.getElementById(id).addEventListener("input", syncDraftScenarioMetadata);
          document.getElementById(id).addEventListener("change", syncDraftScenarioMetadata);
        });
        [
          "map-width-input",
          "wizard-ghost-enabled",
          "wizard-clutter-enabled",
          "wizard-preset"
        ].forEach((id) => {
          document.getElementById(id).addEventListener("input", () => {
            this.refreshWizardSummary();
          });
          document.getElementById(id).addEventListener("change", () => {
            this.refreshWizardSummary();
          });
        });

        document.getElementById("export-scenario-btn").addEventListener("click", () => {
          this.exportCurrentScenario();
        });

        document.getElementById("export-scenario-file-btn").addEventListener("click", () => {
          this.exportCurrentScenario();
        });

        document.getElementById("reset-view-btn").addEventListener("click", () => {
          this.stopPlayback();
          this.state.currentFrame = null;
          this.renderCurrentView();
          this.setPlaybackStatus("Idle");
          this.renderDebriefView();
          this.renderRunSelectedObjectInfo();
          this.setStatus("Run scenario view reset");
        });

        document.getElementById("export-single-btn").addEventListener("click", () => {
          if (!this.state.singleRun) {
            return;
          }
          this.state.exportTab = "report";
          const csv = this.kernel.rowsToCsv([this.kernel.createCsvRow(1, this.state.singleRun.report)]);
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.singleRun.report.scenarioName) + "_single_run.csv", csv, "text/csv;charset=utf-8");
        });

        document.getElementById("export-monte-carlo-btn").addEventListener("click", () => {
          if (!this.state.monteCarloRows.length) {
            return;
          }
          this.state.exportTab = "monteCarlo";
          const csv = this.kernel.rowsToCsv(this.state.monteCarloRows);
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.currentScenario.metadata.name) + "_monte_carlo.csv", csv, "text/csv;charset=utf-8");
        });

        document.getElementById("export-log-btn").addEventListener("click", () => {
          if (!this.state.singleRun) {
            return;
          }
          const json = JSON.stringify(this.state.singleRun.report.logs, null, 2);
          this.state.exportTab = "eventLog";
          this.refreshExportPreview();
          downloadText(buildSafeFileStem(this.state.singleRun.report.scenarioName) + "_event_log.json", json, "application/json;charset=utf-8");
        });
        bindClick("export-report-btn", () => {
          document.getElementById("export-single-btn")?.click();
        });
        bindClick("export-report-monte-carlo-btn", () => {
          document.getElementById("export-monte-carlo-btn")?.click();
        });
        bindClick("export-report-log-btn", () => {
          document.getElementById("export-log-btn")?.click();
        });

        document.querySelectorAll("[data-export-tab]").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.exportTab = button.dataset.exportTab;
            this.refreshExportPreview();
          });
        });

        document.getElementById("scenario-export-source").addEventListener("change", (event) => {
          this.state.scenarioExportSource = event.target.value;
          this.refreshExportPreview();
        });

        document.getElementById("export-pretty-toggle").addEventListener("change", (event) => {
          this.state.exportPrettyJson = !!event.target.checked;
          this.refreshExportPreview();
        });

        document.getElementById("copy-export-preview-btn").addEventListener("click", async () => {
          try {
            await copyTextToClipboard(document.getElementById("export-preview").value);
            this.setStatus("Export preview copied");
          } catch (error) {
            this.setStatus("Copy failed");
          }
        });

        document.getElementById("template-search").addEventListener("input", (event) => {
          this.state.templateSearch = event.target.value || "";
          this.renderTemplateBuilder();
        });

        document.getElementById("create-template-btn").addEventListener("click", () => {
          this.createTemplateFromPreset(document.getElementById("new-template-preset").value);
        });

        document.getElementById("save-template-form-btn").addEventListener("click", () => {
          this.saveSelectedTemplateForm();
        });

        document.getElementById("duplicate-template-btn").addEventListener("click", () => {
          this.duplicateSelectedTemplate();
        });

        document.getElementById("delete-template-btn").addEventListener("click", () => {
          this.deleteSelectedTemplate();
        });

        document.getElementById("apply-template-json-btn").addEventListener("click", () => {
          this.applyTemplateJsonEditor();
        });
        document.getElementById("export-selected-template-btn").addEventListener("click", () => {
          this.exportSelectedTemplate();
        });
        document.getElementById("import-template-btn").addEventListener("click", () => {
          document.getElementById("template-file-input").click();
        });
        document.getElementById("template-file-input").addEventListener("change", (event) => {
          this.importTemplateFile(event);
        });
        document.getElementById("template-json-editor").addEventListener("input", () => {
          this.state.templateJsonDirty = true;
        });
        document.getElementById("template-helper-static-asset-btn").addEventListener("click", () => {
          this.applyTemplateHelper("static-asset");
        });
        document.getElementById("template-helper-mobile-uas-btn").addEventListener("click", () => {
          this.applyTemplateHelper("mobile-uas");
        });
        document.getElementById("template-helper-add-radar-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-radar");
        });
        document.getElementById("template-helper-add-interceptor-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-interceptor");
        });
        document.getElementById("template-helper-add-jammer-btn").addEventListener("click", () => {
          this.applyTemplateHelper("add-jammer");
        });
        document.getElementById("add-template-sensor-btn").addEventListener("click", () => {
          this.addTemplateSensor();
        });
        document.getElementById("duplicate-template-sensor-btn").addEventListener("click", () => {
          this.duplicateTemplateSensor();
        });
        document.getElementById("remove-template-sensor-btn").addEventListener("click", () => {
          this.removeTemplateSensor();
        });
        document.getElementById("add-template-effector-btn").addEventListener("click", () => {
          this.addTemplateEffector();
        });
        document.getElementById("duplicate-template-effector-btn").addEventListener("click", () => {
          this.duplicateTemplateEffector();
        });
        document.getElementById("remove-template-effector-btn").addEventListener("click", () => {
          this.removeTemplateEffector();
        });
        [
          "template-sensor-enabled",
          "template-sensor-id-input",
          "template-sensor-name-input",
          "template-sensor-type-input",
          "template-sensor-range-input",
          "template-sensor-heading-input",
          "template-sensor-hfov-input",
          "template-sensor-vfov-input",
          "template-sensor-scan-input",
          "template-sensor-threshold-input",
          "template-sensor-transmit-input",
          "template-sensor-noise-floor-input",
          "template-sensor-noise-sigma-input",
          "template-sensor-classify-accuracy-input",
          "template-sensor-identify-accuracy-input"
        ].forEach((id) => {
          const element = document.getElementById(id);
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            this.updateTemplateSensorDraftFromForm();
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              this.updateTemplateSensorDraftFromForm();
            });
          }
        });
        [
          "template-effector-enabled",
          "template-effector-id-input",
          "template-effector-name-input",
          "template-effector-type-input",
          "template-effector-guidance-input",
          "template-effector-range-input",
          "template-effector-basepk-input",
          "template-effector-basepe-input",
          "template-effector-damage-input",
          "template-effector-ammo-input",
          "template-effector-slew-input",
          "template-effector-cooldown-input",
          "template-effector-speed-input",
          "template-effector-terminal-radius-input",
          "template-effector-flight-time-input",
          "template-effector-effect-duration-input",
          "template-effector-jam-strength-input",
          "template-effector-domains-input"
        ].forEach((id) => {
          const element = document.getElementById(id);
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            this.updateTemplateEffectorDraftFromForm();
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              this.updateTemplateEffectorDraftFromForm();
            });
          }
        });

        document.getElementById("dashboard-ghost-placeholder-toggle").addEventListener("change", (event) => {
          this.state.currentScenario.environment.placeholderGhostTrack.enabled = event.target.checked;
          this.state.stagedScenario.environment.placeholderGhostTrack.enabled = event.target.checked;
          this.syncPlaceholderCards();
          this.refreshValidationSummary();
          this.refreshWizardSummary();
          this.refreshExportPreview();
          this.renderScenarioSnapshot();
          this.renderDemoPreview();
          this.setStatus("Ghost placeholder " + (event.target.checked ? "enabled" : "disabled"));
        });

        document.getElementById("dashboard-clutter-placeholder-toggle").addEventListener("change", (event) => {
          this.state.currentScenario.environment.placeholderClutterField.enabled = event.target.checked;
          this.state.stagedScenario.environment.placeholderClutterField.enabled = event.target.checked;
          this.syncPlaceholderCards();
          this.refreshValidationSummary();
          this.refreshWizardSummary();
          this.refreshExportPreview();
          this.renderScenarioSnapshot();
          this.renderDemoPreview();
          this.setStatus("Clutter placeholder " + (event.target.checked ? "enabled" : "disabled"));
        });

        this.renderer.canvas.addEventListener("click", (event) => {
          this.handleMapClick(event, this.renderer);
        });
        this.builderRenderer.canvas.addEventListener("click", (event) => {
          this.handleMapClick(event, this.builderRenderer);
        });
        this.debriefRenderer.canvas.addEventListener("click", (event) => {
          this.handleMapClick(event, this.debriefRenderer);
        });
      }

      getActiveScenario() {
        return this.state.stagedScenario || this.state.currentScenario;
      }

      getTutorialLessons() {
        return [
          {
            id: "1",
            title: "Lesson 1: Kill Web Basics",
            description: "Load the demo, inspect the active scenario, and watch how Blue sensing, track formation, C2, and effectors connect into a single defensive kill web."
          },
          {
            id: "2",
            title: "Lesson 2: Sensors & Tracks",
            description: "Use Template Editor to compare sensor types, then use Run Scenario and View Reports to observe the resulting track quality, detection timing, and drop behavior."
          },
          {
            id: "3",
            title: "Lesson 3: Defeat Mechanisms",
            description: "Compare kinetic, interceptor, jammer, spoofer, and cyber outcomes by editing the draft scenario, staging it, and reviewing the report feeds and debrief surfaces."
          }
        ];
      }

      setDashboardTab(tabId) {
        this.state.dashboardTab = tabId === "tutorial" ? "tutorial" : "demo";
        this.renderDashboardTabs();
      }

      renderDashboardTabs() {
        const activeTab = this.state.dashboardTab || "demo";
        document.querySelectorAll(".dashboard-tab-btn").forEach((button) => {
          button.classList.toggle("active", button.dataset.dashboardTab === activeTab);
        });
        document.getElementById("dashboard-tab-demo")?.classList.toggle("active", activeTab === "demo");
        document.getElementById("dashboard-tab-tutorial")?.classList.toggle("active", activeTab === "tutorial");
        this.renderTutorialLessons();
      }

      renderTutorialLessons() {
        const list = document.getElementById("tutorial-lesson-list");
        const title = document.getElementById("tutorial-title");
        const description = document.getElementById("demo-scenario-tutorial");
        const lessons = this.getTutorialLessons();
        const selectedId = this.state.selectedTutorialLessonId || lessons[0].id;
        const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) || lessons[0];
        if (list) {
          list.innerHTML = lessons.map((lesson) => (
            "<div class=\"issue-card note tutorial-lesson-card" + (lesson.id === selectedLesson.id ? " active" : "") + "\" data-lesson-id=\"" + escapeHtml(lesson.id) + "\" style=\"cursor: pointer;\">" +
              "<div class=\"issue-severity\">Lesson " + escapeHtml(lesson.id) + "</div>" +
              "<h4>" + escapeHtml(lesson.title.replace(/^Lesson \d+:\s*/, "")) + "</h4>" +
            "</div>"
          )).join("");
          list.querySelectorAll(".tutorial-lesson-card").forEach((card) => {
            card.addEventListener("click", () => {
              this.state.selectedTutorialLessonId = card.dataset.lessonId;
              this.renderDashboardTabs();
            });
          });
        }
        if (title) {
          title.textContent = selectedLesson.title;
        }
        if (description) {
          description.textContent = selectedLesson.description;
        }
      }

      setReportTab(tabId) {
        this.state.reportTab = tabId === "single-run" ? "single-run" : "monte-carlo";
        this.renderReportTabs();
      }

      renderReportTabs() {
        const activeTab = this.state.reportTab || "monte-carlo";
        document.querySelectorAll(".report-tab-btn").forEach((button) => {
          button.classList.toggle("active", button.dataset.reportTab === activeTab);
        });
        document.getElementById("report-tab-monte-carlo")?.classList.toggle("active", activeTab === "monte-carlo");
        document.getElementById("report-tab-single-run")?.classList.toggle("active", activeTab === "single-run");
      }

      stageCurrentScenario() {
        const normalized = this.kernel.normalizeScenario(this.kernel.deepClone(this.state.currentScenario));
        this.state.currentScenario = normalized;
        this.state.stagedScenario = this.kernel.deepClone(normalized);
        this.state.stagedScenarioSource = this.state.currentScenarioSource || "draft";
        this.state.selectedMonteCarloRowIndex = null;
        this.state.selectedTemplateId = normalized.templates[0]?.id || this.state.selectedTemplateId;
        this.state.lastImportSummary = {
          ...(this.state.lastImportSummary || {}),
          templateCount: normalized.templates.length,
          instanceCount: normalized.instances.length,
          dirty: false
        };
        this.stopPlayback();
        this.clearResults({ clearSelection: false });
        this.refreshScenarioEditors();
        this.setStatus("Draft scenario staged for Run Scenario");
      }

      syncWizardDraftFromScenario(scenario = this.state.currentScenario) {
        const safeScenario = scenario || this.kernel.buildScratchScenario();
        const templatesById = new Map((safeScenario.templates || []).map((template) => [template.id, template]));
        const blueInstances = (safeScenario.instances || []).filter((instance) => instance.side === "Blue");
        const redInstances = (safeScenario.instances || []).filter((instance) => instance.side === "Red");

        this.state.wizardBlueAssets = blueInstances.map((instance) => {
          const template = templatesById.get(instance.templateId) || {};
          return this.createWizardBlueAsset({
            name: instance.name || template.name || "Blue Asset",
            templateRef: "template:" + instance.templateId,
            posX: Number(instance.posX || 0),
            posY: Number(instance.posY || 0),
            posZ: Number(instance.posZ || 0),
            isHQ: !!template.components?.health?.isHQ
          });
        });
        this.state.activeWizardBlueAssetId = this.state.wizardBlueAssets[0]?.localId || null;

        this.state.wizardThreatGroups = redInstances.map((instance, index) => {
          const template = templatesById.get(instance.templateId) || {};
          const firstWaypoint = this.kernel.ensureArray(instance.missionWaypoints || [])[0] || {
            x: Number(instance.posX || 0),
            y: Number(instance.posY || 0),
            z: Number(instance.posZ || 0)
          };
          const missionProfileType = template.missionProfile?.type || "SpecificAsset";
          const profile = missionProfileType === "Geographic"
            ? "isr"
            : (missionProfileType === "MaxDamage" ? "bomber" : "attack");
          return this.createWizardThreatGroup({
            localId: "threat-group-" + (index + 1),
            templateName: template.name || instance.name || ("Red Group " + (index + 1)),
            templateRef: "template:" + instance.templateId,
            instancePrefix: instance.name || template.name || ("Threat " + (index + 1)),
            profile,
            count: 1,
            speed: Number(template.components?.movement?.speedMps || 35),
            health: Number(template.components?.health?.maxHealth || 90),
            signature: Number(template.components?.signature?.radarSignatureDb || -14),
            routePattern: "direct",
            startX: Number(instance.posX || 0),
            startY: Number(instance.posY || 0),
            startZ: Number(instance.posZ || 0),
            endX: Number(firstWaypoint.x || instance.posX || 0),
            endY: Number(firstWaypoint.y || instance.posY || 0),
            endZ: Number(firstWaypoint.z || instance.posZ || 0),
            startSpacingY: 0,
            endSpacingY: 0
          });
        });
        this.state.activeWizardThreatGroupId = this.state.wizardThreatGroups[0]?.localId || null;

        document.getElementById("wizard-scenario-name").value = safeScenario.metadata?.name || "Scenario Editor Draft";
        document.getElementById("wizard-scenario-description").value = safeScenario.metadata?.description || "";
        document.getElementById("map-width-input").value = safeScenario.environment?.mapWidthMeters ?? 1080;
        document.getElementById("wizard-ghost-enabled").checked = !!safeScenario.environment?.placeholderGhostTrack?.enabled;
        document.getElementById("wizard-clutter-enabled").checked = !!safeScenario.environment?.placeholderClutterField?.enabled;
      }

      clearWizardGeneratedCandidate() {
        this.state.wizardGeneratedCandidate = null;
      }

      refreshScenarioEditors() {
        this.renderer.setScenario(this.getActiveScenario());
        this.builderRenderer.setScenario(this.state.currentScenario);
        this.demoRenderer.setScenario(this.getActiveScenario());
        this.debriefRenderer.setScenario(this.getActiveScenario());
        this.updateScenarioLabel();
        this.applyScenarioMetadataToDemoTutorial();
        this.syncPlaceholderControls();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.renderWizardBlueAssets();
        this.renderWizardThreatGroups();
        this.renderScenarioBuilderTabs();
        this.renderDashboardTabs();
        this.renderReportTabs();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderActiveScenarioSnapshot();
        this.renderDemoPreview();
        this.renderDebriefView();
        this.renderSelectedObjectEditor();
        this.renderRunReminder();
        this.renderRunSelectedObjectInfo();
        this.refreshExportPreview();
        this.renderAboutPanel();
      }

      setScenarioBuilderTab(tabId) {
        this.state.scenarioBuilderTab = ["environment", "draft", "blue-groups", "red-groups", "blue-instances", "red-instances"].includes(tabId) ? tabId : "draft";
        this.renderScenarioBuilderTabs();
      }

      renderScenarioBuilderTabs() {
        const activeTab = this.state.scenarioBuilderTab || "environment";
        document.querySelectorAll(".scenario-builder-tab").forEach((button) => {
          button.classList.toggle("active", button.dataset.builderTab === activeTab);
        });
        document.querySelectorAll(".builder-tab-panel").forEach((panel) => {
          panel.classList.toggle("active", panel.id === "builder-tab-" + activeTab);
        });
      }

      getBuiltInScenarioPaths() {
        return {
          demo: "src/scenario/demo.json",
          scratch: "src/scenario/scratch.json"
        };
      }

      getBuiltInWizardPresetPaths() {
        return {
          "blank-scratch": "src/scenario/presets/blank-scratch.json",
          "baseline-single": "src/scenario/presets/baseline-single.json",
          "lock-refire": "src/scenario/presets/lock-refire.json",
          "tewa-priority": "src/scenario/presets/tewa-priority.json"
        };
      }

      async loadJsonAsset(cacheKey, path) {
        if (this.state.scenarioSourceCache[cacheKey]) {
          return this.kernel.deepClone(this.state.scenarioSourceCache[cacheKey]);
        }
        const bundledSources = globalThis.__CSUAS_SCENARIO_SOURCES || null;
        if (bundledSources && bundledSources[cacheKey]) {
          this.state.scenarioSourceCache[cacheKey] = bundledSources[cacheKey];
          return this.kernel.deepClone(bundledSources[cacheKey]);
        }
        if (typeof fetch !== "function") {
          throw new Error("Fetch unavailable");
        }
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Request failed for " + path + " (" + response.status + ")");
        }
        const payload = await response.json();
        this.state.scenarioSourceCache[cacheKey] = payload;
        return this.kernel.deepClone(payload);
      }

      getFallbackWizardPresetData() {
        return {
          "blank-scratch": {
            scenarioName: "New Scenario",
            description: "Start from scratch, then add Blue assets, Red threat groups, and optional environment placeholders.",
            mapWidth: 1080,
            blueAssets: [{ name: "Blue Site", templateRef: "preset:blue-site", posX: 670, posY: 315, posZ: 20, isHQ: true }],
            threatGroups: [],
            ghost: false,
            clutter: false
          },
          "baseline-single": {
            scenarioName: "Editor Baseline",
            description: "Single-UAS baseline built from the quick-start wizard.",
            mapWidth: 1080,
            blueAssets: [{ name: "Blue Site 01", templateRef: "preset:blue-site", posX: 670, posY: 315, posZ: 20, isHQ: true }],
            threatGroups: [{ templateName: "Red Recon Strike UAS", templateRef: "preset:red-uas", instancePrefix: "Red UAS", profile: "recon-strike", count: 1, speed: 35, health: 90, signature: -14, routePattern: "direct", startX: 90, startY: 315, startZ: 120, endX: 980, endY: 315, endZ: 120, startSpacingY: 0, endSpacingY: 0 }],
            ghost: false,
            clutter: false
          },
          "lock-refire": {
            scenarioName: "Editor Lock Refire",
            description: "Two threats to review locked engagements and autonomous refire behavior.",
            mapWidth: 1080,
            blueAssets: [{ name: "Blue Lock Site", templateRef: "preset:blue-site", posX: 650, posY: 315, posZ: 20, isHQ: true }],
            threatGroups: [{ templateName: "Red Attack UAS", templateRef: "preset:red-uas", instancePrefix: "Raid UAS", profile: "attack", count: 2, speed: 34, health: 95, signature: -12, routePattern: "staggered", startX: 110, startY: 315, startZ: 120, endX: 930, endY: 315, endZ: 120, startSpacingY: 110, endSpacingY: 40 }],
            ghost: false,
            clutter: false
          },
          "tewa-priority": {
            scenarioName: "Editor TEWA Priority",
            description: "Two defended assets and mixed Red threats for TEWA priority review.",
            mapWidth: 1080,
            blueAssets: [
              { name: "Blue HQ Node", templateRef: "preset:blue-site", posX: 700, posY: 275, posZ: 20, isHQ: true },
              { name: "Water Tank", templateRef: "preset:asset", posX: 680, posY: 415, posZ: 10, isHQ: false }
            ],
            threatGroups: [
              { templateName: "Red Bomber UAS", templateRef: "preset:red-uas", instancePrefix: "Bomber", profile: "bomber", count: 1, speed: 38, health: 120, signature: -7, routePattern: "direct", startX: 70, startY: 260, startZ: 120, endX: 940, endY: 275, endZ: 120, startSpacingY: 0, endSpacingY: 0 },
              { templateName: "Red ISR UAS", templateRef: "preset:red-uas", instancePrefix: "ISR Decoy", profile: "isr", count: 1, speed: 22, health: 85, signature: -18, routePattern: "direct", startX: 100, startY: 385, startZ: 120, endX: 880, endY: 420, endZ: 120, startSpacingY: 0, endSpacingY: 0 }
            ],
            ghost: false,
            clutter: false
          }
        };
      }

      async loadScenarioSourceFromFile(kind, fallbackFactory) {
        const path = this.getBuiltInScenarioPaths()[kind];
        try {
          const payload = await this.loadJsonAsset("scenario:" + kind, path);
          return this.kernel.normalizeScenario(payload);
        } catch (error) {
          return this.kernel.deepClone(fallbackFactory());
        }
      }

      async loadWizardPresetData(preset) {
        const fallback = this.getFallbackWizardPresetData();
        const path = this.getBuiltInWizardPresetPaths()[preset];
        if (!path) {
          return this.kernel.deepClone(fallback["baseline-single"]);
        }
        try {
          return await this.loadJsonAsset("wizard-preset:" + preset, path);
        } catch (error) {
          return this.kernel.deepClone(fallback[preset] || fallback["baseline-single"]);
        }
      }

      applyScenarioMetadataToDemoTutorial() {
        const activeScenario = this.getActiveScenario();
        const notesNode = document.getElementById("demo-scenario-notes");
        const tutorialNode = document.getElementById("demo-scenario-tutorial");
        if (notesNode) {
          notesNode.textContent = activeScenario.metadata?.notes || "No scenario notes provided.";
        }
      }

      async resetToBaselineScenario() {
        await this.loadDemoScenario(true);
        this.uiManager.showScreen("demo-tutorial");
        this.setStatus("Demo scenario loaded");
      }

      async loadDemoScenario(stageBoth = false) {
        this.state.currentScenario = await this.loadScenarioSourceFromFile("demo", () => this.kernel.buildDemoScenario());
        this.state.currentScenarioSource = "demo";
        if (stageBoth) {
          this.state.stagedScenario = this.kernel.deepClone(this.state.currentScenario);
          this.state.stagedScenarioSource = "demo";
        }
        this.state.originalScenarioPayloadText = "";
        this.state.scenarioExportSource = "normalized";
        this.state.lastImportSummary = {
          source: "Built-in demo",
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          normalizedChanged: false,
          dirty: false
        };
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.state.selectedMonteCarloRowIndex = null;
        this.clearResults();
        this.syncWizardDraftFromScenario();
        this.refreshScenarioEditors();
      }

      async loadScratchScenario(stageBoth = false) {
        this.state.currentScenario = await this.loadScenarioSourceFromFile("scratch", () => this.kernel.buildScratchScenario());
        this.state.currentScenarioSource = "scratch";
        if (stageBoth) {
          this.state.stagedScenario = this.kernel.deepClone(this.state.currentScenario);
          this.state.stagedScenarioSource = "scratch";
        }
        this.state.originalScenarioPayloadText = "";
        this.state.scenarioExportSource = "normalized";
        this.state.lastImportSummary = {
          source: "Built-in scratch",
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          normalizedChanged: false,
          dirty: false
        };
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.state.selectedMonteCarloRowIndex = null;
        this.clearResults();
        this.syncWizardDraftFromScenario();
        this.refreshScenarioEditors();
      }

      async importMapBackground(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("Map load failed"));
            reader.readAsDataURL(file);
          });
          this.state.currentScenario.environment.backgroundImageBase64 = String(dataUrl || "");
          this.renderer.setScenario(this.state.currentScenario);
          this.renderScenarioSnapshot();
          this.refreshExportPreview();
          this.setStatus("Map background loaded");
        } catch (error) {
          this.setStatus("Map background load failed");
        } finally {
          event.target.value = "";
        }
      }

      exportSelectedTemplate() {
        const template = this.state.currentScenario.templates.find((candidate) => candidate.id === this.state.selectedTemplateId);
        if (!template) {
          this.setStatus("Select a template first");
          return;
        }
        const draftSnapshot = this.buildTemplateDraftSnapshot(template);
        downloadText(buildSafeFileStem(draftSnapshot.id) + ".json", JSON.stringify(draftSnapshot, null, 2), "application/json;charset=utf-8");
        this.setStatus("Template exported");
      }

      async importTemplateFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const template = this.kernel.normalizeScenario({
            metadata: { name: "Template import wrapper" },
            templates: [parsed],
            instances: []
          }).templates[0];
          const existingIndex = this.state.currentScenario.templates.findIndex((candidate) => candidate.id === template.id);
          if (existingIndex >= 0) {
            this.state.currentScenario.templates[existingIndex] = template;
          } else {
            this.state.currentScenario.templates.push(template);
          }
          this.state.selectedTemplateId = template.id;
          this.renderTemplateBuilder();
          this.refreshValidationSummary();
          this.refreshExportPreview();
          this.setStatus("Template imported");
        } catch (error) {
          this.setStatus("Template import failed");
        } finally {
          event.target.value = "";
        }
      }

      renderCurrentView() {
        if (this.state.currentFrame && this.state.currentReport) {
          this.renderer.draw(this.state.currentFrame, this.state.currentReport);
          this.renderBuilderView();
          return;
        }
        this.renderActiveScenarioSnapshot();
      }

      renderBuilderView() {
        this.renderScenarioSnapshot();
      }

      renderDemoPreview() {
        if (!this.demoRenderer) {
          return;
        }
        const scenario = this.getActiveScenario();
        const previewFrame = {
          timeSec: 0,
          reason: "demo-preview",
          objects: (scenario.instances || []).map((instance) => {
            const template = (scenario.templates || []).find((candidate) => candidate.id === instance.templateId);
            return {
              id: instance.id,
              name: instance.name,
              side: instance.side,
              roles: this.kernel.deepClone(instance.roles || []),
              x: instance.posX,
              y: instance.posY,
              z: instance.posZ,
              sensors: this.kernel.deepClone(template?.components?.sensors || []),
              effectors: this.kernel.deepClone(template?.components?.effectors || []),
              currentHeadingDeg: null,
              behaviorState: "Preview",
              destroyed: false,
              status: "Active"
            };
          }),
          tracks: []
        };
        this.demoRenderer.draw(previewFrame, {
          scenarioName: scenario.metadata?.name || "Scenario Preview",
          targetDestroyed: false
        });
      }

      renderDebriefView() {
        if (!this.debriefRenderer) {
          return;
        }
        if (this.state.currentFrame && this.state.currentReport) {
          this.debriefRenderer.draw(this.state.currentFrame, this.state.currentReport);
          return;
        }
        this.renderScenarioModel(this.getActiveScenario(), { preserveSelection: true, targetRenderers: [this.debriefRenderer], updateState: false });
      }

      renderRunReminder() {
        const reminder = document.getElementById("run-reminder");
        if (!reminder) {
          return;
        }
        reminder.innerHTML = this.isWizardBuildPending()
          ? "<div class=\"attention-card\"><strong>Run Scenario is using the last staged scenario.</strong> Stage the current draft in Scenario Editor when you want Run Scenario to use the latest edits.</div>"
          : "";
      }

      renderRunSelectedObjectInfo() {
        const container = document.getElementById("run-selected-object-info");
        if (!container) {
          return;
        }
        const selection = this.state.selectedMapEntity;
        const frame = this.state.currentFrame;
        if (!selection || !frame) {
          container.innerHTML = "<div class=\"empty-state\" style=\"padding: 10px;\">Click an object or track on the map during playback to view its live telemetry.</div>";
          return;
        }

        if (selection.type === "object") {
          const object = (frame.objects || []).find((candidate) => candidate.id === selection.id);
          if (!object) {
            container.innerHTML = "<div class=\"empty-state\" style=\"padding: 10px;\">Selected object is not present in the current frame.</div>";
            return;
          }
          const positionText = [object.x, object.y, object.z].map((value) => Number.isFinite(Number(value)) ? this.kernel.round(Number(value), 1) : "-").join(", ");
          const metrics = [
            { label: "Name", value: object.name || object.id },
            { label: "Side", value: object.side || "-" },
            { label: "Status", value: object.status || (object.destroyed ? "Destroyed" : "Active") },
            { label: "Position", value: positionText },
            { label: "Heading", value: Number.isFinite(Number(object.currentHeadingDeg)) ? this.kernel.round(Number(object.currentHeadingDeg), 1) + " deg" : "-" },
            { label: "Speed", value: Number.isFinite(Number(object.currentSpeedMps)) ? this.kernel.round(Number(object.currentSpeedMps), 2) + " m/s" : "-" },
            { label: "Control", value: object.controlMode || object.behaviorState || "-" },
            { label: "Target", value: object.behaviorTargetId || object.trackId || "-" }
          ];
          container.innerHTML = metrics.map((metric) => (
            "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(metric.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(String(metric.value)) + "</div></div>"
          )).join("");
          return;
        }

        const track = (frame.tracks || []).find((candidate) => candidate.id === selection.id);
        if (!track) {
          container.innerHTML = "<div class=\"empty-state\" style=\"padding: 10px;\">Selected track is not present in the current frame.</div>";
          return;
        }
        const positionText = [track.x, track.y, track.z].map((value) => Number.isFinite(Number(value)) ? this.kernel.round(Number(value), 1) : "-").join(", ");
        const metrics = [
          { label: "Track", value: track.id || "-" },
          { label: "Status", value: track.status || "-" },
          { label: "Position", value: positionText },
          { label: "Heading", value: Number.isFinite(Number(track.headingDeg)) ? this.kernel.round(Number(track.headingDeg), 1) + " deg" : "-" },
          { label: "Speed", value: Number.isFinite(Number(track.currentSpeedMps)) ? this.kernel.round(Number(track.currentSpeedMps), 2) + " m/s" : "-" },
          { label: "Classification", value: track.classification || "-" },
          { label: "Intent", value: track.intentStatus || track.intent || "-" },
          { label: "Target", value: track.projectedAssetId || track.realObjectId || "-" }
        ];
        container.innerHTML = metrics.map((metric) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(metric.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(String(metric.value)) + "</div></div>"
        )).join("");
      }

      renderAboutPanel() {
        const versionNode = document.getElementById("about-version");
        if (!versionNode) {
          return;
        }
        versionNode.textContent = "v2.6.2 | Vite modular shell | standalone helper utilities";
      }

      updateMapSelectionChip() {
        const chip = document.getElementById("map-selection-chip");
        if (!chip) {
          return;
        }
        if (this.state.mapInteraction) {
          const modeLabels = {
            "blue-asset-position": "Placing Blue asset",
            "group-start": "Placing Red start",
            "group-end": "Placing Red end",
            "selected-object-move": "Moving selected object",
            "selected-object-waypoint": "Setting route waypoint",
            "terrain-draw": "Drawing terrain polygon"
          };
          chip.textContent = modeLabels[this.state.mapInteraction.mode] || "Map interaction active";
          return;
        }
        if (!this.state.selectedMapEntity) {
          chip.textContent = "No map selection";
          return;
        }
        chip.textContent = this.state.selectedMapEntity.name + " selected";
      }

      handleMapClick(event, activeRenderer = this.renderer) {
        const canvasPoint = activeRenderer.eventToCanvas(event);
        const worldPoint = activeRenderer.canvasToWorld(canvasPoint);
        if (this.state.mapInteraction) {
          if (this.state.mapInteraction.mode === "blue-asset-position") {
            const asset = this.state.wizardBlueAssets.find((item) => item.localId === this.state.mapInteraction.blueAssetId);
            if (asset) {
              asset.posX = this.kernel.round(worldPoint.x, 1);
              asset.posY = this.kernel.round(worldPoint.y, 1);
              this.state.activeWizardBlueAssetId = asset.localId;
            }
            this.state.mapInteraction = null;
            this.syncBlueGroupToDraft(asset.localId);
            this.renderWizardBlueAssets();
            this.refreshWizardSummary();
            this.renderScenarioSnapshot();
            this.setStatus("Blue asset position updated from map");
            this.updateMapSelectionChip();
            return;
          }
          const group = this.state.wizardThreatGroups.find((item) => item.localId === this.state.mapInteraction.threatGroupId);
          if (group) {
            if (this.state.mapInteraction.mode === "group-start") {
              group.startX = this.kernel.round(worldPoint.x, 1);
              group.startY = this.kernel.round(worldPoint.y, 1);
            } else if (this.state.mapInteraction.mode === "group-end") {
              group.endX = this.kernel.round(worldPoint.x, 1);
              group.endY = this.kernel.round(worldPoint.y, 1);
            }
            this.state.activeWizardThreatGroupId = group.localId;
            this.state.mapInteraction = null;
            this.syncRedGroupToDraft(group.localId);
            this.renderWizardThreatGroups();
            this.refreshWizardSummary();
            this.renderScenarioSnapshot();
            this.setStatus("Threat-group route updated from map");
            this.updateMapSelectionChip();
            return;
          }
          if (this.state.mapInteraction.mode === "selected-object-move") {
            const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === this.state.mapInteraction.instanceId);
            if (instance) {
              instance.posX = this.kernel.round(worldPoint.x, 1);
              instance.posY = this.kernel.round(worldPoint.y, 1);
              this.state.mapInteraction = null;
              this.updateScenarioState("Moved selected object");
              this.updateMapSelectionChip();
              return;
            }
          }
          if (this.state.mapInteraction.mode === "selected-object-waypoint") {
            const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === this.state.mapInteraction.instanceId);
            if (instance) {
              const waypointZ = Number.isFinite(Number(this.state.mapInteraction.waypointZ))
                ? Number(this.state.mapInteraction.waypointZ)
                : Number(instance.posZ || 0);
              const waypoint = {
                x: this.kernel.round(worldPoint.x, 1),
                y: this.kernel.round(worldPoint.y, 1),
                z: this.kernel.round(waypointZ, 1)
              };
              instance.missionWaypoints = [waypoint];
              this.state.mapInteraction = null;
              this.updateScenarioState("Updated first route waypoint");
              this.updateMapSelectionChip();
              return;
            }
          }
          if (this.state.mapInteraction.mode === "terrain-draw") {
            const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === this.state.mapInteraction.terrainId);
            if (terrain) {
              terrain.areaPolygon.push({
                x: this.kernel.round(worldPoint.x, 1),
                y: this.kernel.round(worldPoint.y, 1)
              });
              this.renderTerrainEditor();
              this.renderScenarioSnapshot();
              this.refreshExportPreview();
              this.setStatus("Terrain vertex added");
              return;
            }
          }
        }

        const hit = activeRenderer.hitTest(activeRenderer.lastFrame || this.state.currentFrame, event);
        this.state.selectedMapEntity = hit ? {
          type: hit.type,
          id: hit.id,
          name: hit.name,
          side: hit.side
        } : null;
        this.renderer.setSelection(this.state.selectedMapEntity);
        this.builderRenderer.setSelection(this.state.selectedMapEntity);
        this.renderCurrentView();
        this.updateMapSelectionChip();
        this.renderSelectedObjectEditor();
        this.renderRunSelectedObjectInfo();
      }

      setBusy(isBusy) {
        [
          "new-scenario-btn",
          "open-scenario-sidebar-btn",
          "load-scenario-header-btn",
          "save-scenario-btn",
          "open-template-sidebar-btn",
          "open-analysis-sidebar-btn",
          "open-export-sidebar-btn",
          "run-monte-carlo-header-btn",
          "run-single-btn",
          "run-monte-carlo-btn",
          "load-scenario-btn",
          "export-scenario-btn",
          "reset-view-btn",
          "zoom-reset-btn",
          "open-scenario-builder-inline-btn",
          "open-template-library-inline-btn",
          "open-analysis-inline-btn",
          "open-roster-inline-btn",
          "wizard-load-preset-btn",
          "wizard-validate-scenario-btn",
          "wizard-stage-current-scenario-btn",
          "wizard-export-scenario-btn",
          "wizard-import-scenario-btn",
          "wizard-add-blue-group-btn",
          "create-template-btn",
          "save-template-form-btn",
          "duplicate-template-btn",
          "delete-template-btn",
          "export-selected-template-btn",
          "import-template-btn",
          "apply-template-json-btn",
          "add-block-terrain-btn",
          "add-noise-terrain-btn",
          "add-blue-instance-btn",
          "add-red-instance-btn",
          "copy-export-preview-btn",
          "export-single-btn",
          "export-monte-carlo-btn",
          "export-log-btn",
          "export-scenario-file-btn",
          "export-report-btn",
          "export-report-monte-carlo-btn",
          "export-report-log-btn",
          "debrief-play-btn",
          "back-btn",
          "play-btn",
          "pause-btn",
          "forward-btn"
        ].forEach((id) => {
          const element = document.getElementById(id);
          if (element) {
            element.disabled = isBusy;
          }
        });
      }

      setStatus(text) {
        document.getElementById("status-text").textContent = text;
      }

      setPlaybackStatus(text) {
        document.getElementById("playback-text").textContent = text;
      }

      updateScenarioLabel() {
        document.getElementById("scenario-text").textContent = this.getActiveScenario().metadata.name;
      }

      applyQueryParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("ghostPlaceholder") === "1") {
          this.state.currentScenario.environment.placeholderGhostTrack.enabled = true;
          this.state.stagedScenario.environment.placeholderGhostTrack.enabled = true;
        }
        if (params.get("clutterPlaceholder") === "1") {
          this.state.currentScenario.environment.placeholderClutterField.enabled = true;
          this.state.stagedScenario.environment.placeholderClutterField.enabled = true;
        }
      }

      handleAutorun() {
        const params = new URLSearchParams(window.location.search);
        const autorun = params.get("autorun");
        if (autorun === "single") {
          window.setTimeout(() => {
            this.runSingleScenario();
          }, 60);
        } else if (autorun === "montecarlo") {
          const iterations = Number(params.get("iterations"));
          if (Number.isFinite(iterations) && iterations > 0) {
            document.getElementById("monte-carlo-count").value = String(Math.min(250, iterations));
          }
          window.setTimeout(() => {
            this.runMonteCarlo();
          }, 60);
        }
      }

      syncPlaceholderControls() {
        const activeScenario = this.getActiveScenario();
        const ghostToggle = document.getElementById("dashboard-ghost-placeholder-toggle");
        const clutterToggle = document.getElementById("dashboard-clutter-placeholder-toggle");
        if (ghostToggle) {
          ghostToggle.checked = !!activeScenario.environment.placeholderGhostTrack?.enabled;
        }
        if (clutterToggle) {
          clutterToggle.checked = !!activeScenario.environment.placeholderClutterField?.enabled;
        }
        this.syncPlaceholderCards();
      }

      syncPlaceholderCards() {
        const activeScenario = this.getActiveScenario();
        const ghost = activeScenario.environment.placeholderGhostTrack;
        const clutter = activeScenario.environment.placeholderClutterField;
        const ghostCard = document.getElementById("ghost-placeholder-card");
        const clutterCard = document.getElementById("clutter-placeholder-card");
        if (ghostCard) {
          ghostCard.textContent = ghost.enabled
            ? (ghost.label || "Ghost Track Placeholder") + " active at T+" + ghost.spawnTimeSec + "s"
            : "Ghost placeholder inactive";
        }
        if (clutterCard) {
          clutterCard.textContent = clutter.enabled
            ? (clutter.label || "Clutter Placeholder") + " active around (" + clutter.centerX + ", " + clutter.centerY + ")"
            : "Clutter placeholder inactive";
        }
      }

      buildUniqueId(baseId, existingIds) {
        const safeBase = String(baseId || "Item").replace(/[^A-Za-z0-9_-]+/g, "-") || "Item";
        let candidate = safeBase;
        let index = 2;
        while (existingIds.has(candidate)) {
          candidate = safeBase + "-" + index;
          index += 1;
        }
        return candidate;
      }

      getTemplateById(templateId) {
        return this.state.currentScenario.templates.find((template) => template.id === templateId) || null;
      }

      ensureSelectedTemplate() {
        const templates = this.state.currentScenario.templates;
        if (!templates.length) {
          this.state.selectedTemplateId = null;
          return null;
        }
        const existing = this.getTemplateById(this.state.selectedTemplateId);
        if (existing) {
          return existing;
        }
        this.state.selectedTemplateId = templates[0].id;
        return templates[0];
      }

      getTemplateUsage(templateId) {
        return this.state.currentScenario.instances.filter((instance) => instance.templateId === templateId);
      }

      syncWizardTemplateRefs(oldTemplateId, newTemplateId) {
        if (!oldTemplateId || !newTemplateId || oldTemplateId === newTemplateId) {
          return;
        }
        const oldRef = "template:" + oldTemplateId;
        const newRef = "template:" + newTemplateId;
        this.state.wizardBlueAssets.forEach((asset) => {
          if (asset.templateRef === oldRef) {
            asset.templateRef = newRef;
          }
        });
        this.state.wizardThreatGroups.forEach((group) => {
          if (group.templateRef === oldRef) {
            group.templateRef = newRef;
          }
        });
      }

      getWizardTemplateBindingUsage(templateId) {
        const templateRef = "template:" + templateId;
        const usage = [];
        this.state.wizardBlueAssets.forEach((asset, index) => {
          if (asset.templateRef === templateRef) {
            usage.push({
              kind: "Blue asset",
              name: asset.name || ("Blue Asset " + (index + 1))
            });
          }
        });
        this.state.wizardThreatGroups.forEach((group, index) => {
          if (group.templateRef === templateRef) {
            usage.push({
              kind: "Threat group",
              name: group.name || group.templateName || ("Threat Group " + (index + 1))
            });
          }
        });
        return usage;
      }

      getTemplateBoundInputs() {
        return Array.from(document.querySelectorAll("[data-template-bind]"));
      }

      readTemplateBoundFieldsIntoDraft(draft) {
        this.getTemplateBoundInputs().forEach((input) => {
          const path = input.dataset.templateBind;
          if (!path) {
            return;
          }
          const value = input.type === "checkbox"
            ? !!input.checked
            : (input.type === "number"
              ? Number(input.value || 0)
              : input.value);
          setNestedValue(draft, path, value);
        });
      }

      writeTemplateBoundFieldsFromTemplate(template) {
        this.getTemplateBoundInputs().forEach((input) => {
          const path = input.dataset.templateBind;
          if (!path) {
            return;
          }
          const value = getNestedValue(template, path);
          if (input.type === "checkbox") {
            input.checked = !!value;
          } else {
            input.value = value ?? (input.type === "number" ? 0 : "");
          }
        });
      }

      buildTemplateDraftSnapshot(template, options = {}) {
        if (!template) {
          return null;
        }
        this.updateTemplateSensorDraftFromForm();
        this.updateTemplateEffectorDraftFromForm();
        const currentTemplateId = template.id || "Template";
        const requestedTemplateId = document.getElementById("template-id-input").value.trim() || currentTemplateId;
        const existingIds = new Set(
          this.state.currentScenario.templates
            .map((item) => item.id)
            .filter((id) => id !== currentTemplateId)
        );
        const nextTemplateId = options.enforceUniqueId
          ? this.buildUniqueId(requestedTemplateId, existingIds)
          : requestedTemplateId;
        const roles = document.getElementById("template-roles-input").value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const c2Enabled = document.getElementById("template-c2-enabled").checked;
        const firstC2 = template.components?.c2 || {};
        const draft = this.kernel.deepClone(template);
        draft.id = nextTemplateId;
        draft.name = document.getElementById("template-name-input").value.trim() || nextTemplateId;
        draft.category = document.getElementById("template-category-input").value.trim() || "Generic";
        draft.defaultRoles = roles;
        draft.components = draft.components || {};
        draft.components.health = draft.components.health || {};
        draft.components.resistance = draft.components.resistance || {};
        draft.components.signature = draft.components.signature || {};
        draft.components.vulnerability = draft.components.vulnerability || {};
        draft.components.payload = draft.components.payload || {};
        draft.components.capability = draft.components.capability || {};
        draft.components.powerConsumer = draft.components.powerConsumer || {};
        draft.components.powerProducer = draft.components.powerProducer || {};
        this.readTemplateBoundFieldsIntoDraft(draft);
        draft.components.powerConsumer = draft.components.powerConsumer || {};
        draft.components.movement = document.getElementById("template-movement-enabled").checked ? {
          speedMps: Number(document.getElementById("template-speed-input").value || 0),
          stepSec: Number(document.getElementById("template-step-input").value || 1),
          waypointToleranceM: Number(document.getElementById("template-waypoint-tolerance-input").value || 10)
        } : null;
        draft.components.sensors = this.kernel.deepClone(this.state.templateEditorSensors || []);
        draft.components.effectors = this.kernel.deepClone(this.state.templateEditorEffectors || []);
        draft.components.c2 = c2Enabled ? {
          trackCapacity: Number(document.getElementById("template-c2-capacity-input").value || firstC2.trackCapacity || 0),
          processingLatencySec: Number(document.getElementById("template-c2-latency-input").value || firstC2.processingLatencySec || 0.25)
        } : null;
        return this.kernel.normalizeScenario({
          metadata: { name: "Template Draft Snapshot" },
          templates: [draft],
          instances: []
        }).templates[0];
      }

      syncTemplateJsonEditorFromDraft(force = false) {
        const editor = document.getElementById("template-json-editor");
        if (!editor) {
          return;
        }
        if (!force && this.state.templateJsonDirty) {
          return;
        }
        const template = this.ensureSelectedTemplate();
        if (!template) {
          editor.value = "";
          this.state.templateJsonDirty = false;
          return;
        }
        const draftSnapshot = this.buildTemplateDraftSnapshot(template);
        editor.value = JSON.stringify(draftSnapshot, null, 2);
        this.state.templateJsonDirty = false;
      }

      selectTemplate(templateId, screenId = null) {
        if (!this.getTemplateById(templateId)) {
          return;
        }
        this.state.selectedTemplateId = templateId;
        this.renderTemplateBuilder();
        if (screenId) {
          this.uiManager.showScreen(screenId);
        }
      }

      refreshImportSummary() {
        const summary = this.state.lastImportSummary || {};
        const container = document.getElementById("import-summary");
        if (!container) {
          return;
        }
        const cards = [
          { label: "Source", value: summary.source || "Built-in baseline" },
          { label: "Templates", value: this.state.currentScenario.templates.length },
          { label: "Instances", value: this.state.currentScenario.instances.length },
          { label: "Normalized", value: summary.normalizedChanged ? "Adjusted" : "No change" },
          { label: "Dirty", value: summary.dirty ? "Edited in UI" : "Clean" }
        ];
        container.innerHTML = cards.map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.15rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");
      }

      getOrCreateRoster(side) {
        let roster = (this.state.currentScenario.rosters || []).find((candidate) => candidate.side === side);
        if (!roster) {
          roster = {
            id: "Roster-" + side,
            side,
            items: []
          };
          this.state.currentScenario.rosters.push(roster);
        }
        return roster;
      }

      renderTerrainEditor() {
        const container = document.getElementById("terrain-object-list");
        const terrainObjects = this.state.currentScenario.terrainObjects || [];
        if (!terrainObjects.length) {
          container.innerHTML = "<div class=\"empty-state\">No terrain objects yet. Add a block or noise polygon, then click the map to add vertices.</div>";
          return;
        }
        container.innerHTML = terrainObjects.map((terrain) => {
          const isActive = this.state.mapInteraction?.mode === "terrain-draw" && this.state.mapInteraction?.terrainId === terrain.id;
          return (
            "<div class=\"timeline-card\">" +
              "<div class=\"toolbar-row\" style=\"justify-content:space-between; align-items:flex-start;\">" +
                "<div><h4>" + escapeHtml(terrain.label) + "</h4><div class=\"summary-meta\">" + escapeHtml(terrain.interferenceType) + " terrain | " + terrain.areaPolygon.length + " vertices</div></div>" +
                "<button class=\"button-link remove-terrain-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">Remove</button>" +
              "</div>" +
              "<div class=\"form-grid tight\" style=\"margin-top:10px;\">" +
                "<div class=\"field-stack\"><label>Label</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"label\" type=\"text\" value=\"" + escapeHtml(terrain.label) + "\"></div>" +
                "<div class=\"field-stack\"><label>Type</label><select class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"interferenceType\">" +
                  ["Block", "Noise", "No"].map((type) => (
                    "<option value=\"" + escapeHtml(type) + "\"" + (terrain.interferenceType === type ? " selected" : "") + ">" + escapeHtml(type) + "</option>"
                  )).join("") +
                "</select></div>" +
                "<div class=\"field-stack\"><label>Height Z</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"heightZ\" type=\"number\" value=\"" + escapeHtml(String(terrain.heightZ)) + "\"></div>" +
                "<div class=\"field-stack\"><label>Clutter Penalty (dB)</label><input class=\"terrain-field\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\" data-field=\"clutterPenaltyDb\" type=\"number\" step=\"0.1\" value=\"" + escapeHtml(String(terrain.clutterPenaltyDb)) + "\"></div>" +
              "</div>" +
              "<div class=\"controls\" style=\"margin-top:10px;\">" +
                "<button class=\"terrain-draw-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">" + (isActive ? "Stop Drawing" : "Draw Polygon") + "</button>" +
                "<button class=\"terrain-clear-btn\" data-terrain-id=\"" + escapeHtml(terrain.id) + "\">Clear Polygon</button>" +
              "</div>" +
            "</div>"
          );
        }).join("");

        container.querySelectorAll(".terrain-field").forEach((input) => {
          input.addEventListener("change", () => {
            this.updateTerrainField(input.dataset.terrainId, input.dataset.field, input.value);
          });
        });
        container.querySelectorAll(".terrain-draw-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.toggleTerrainDraw(button.dataset.terrainId);
          });
        });
        container.querySelectorAll(".terrain-clear-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.clearTerrainPolygon(button.dataset.terrainId);
          });
        });
        container.querySelectorAll(".remove-terrain-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeTerrainObject(button.dataset.terrainId);
          });
        });
      }

      addTerrainObject(interferenceType) {
        const terrainId = this.buildUniqueId("Terrain", new Set((this.state.currentScenario.terrainObjects || []).map((item) => item.id)));
        this.state.currentScenario.terrainObjects.push({
          id: terrainId,
          label: interferenceType + " Terrain",
          interferenceType,
          clutterPenaltyDb: interferenceType === "Noise" ? 6 : 0,
          heightZ: interferenceType === "Block" ? 80 : 60,
          areaPolygon: []
        });
        this.updateScenarioState("Terrain object added");
      }

      updateTerrainField(terrainId, field, value) {
        const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === terrainId);
        if (!terrain) {
          return;
        }
        terrain[field] = ["heightZ", "clutterPenaltyDb"].includes(field)
          ? Number(value || 0)
          : value;
        this.updateScenarioState("Updated terrain");
      }

      toggleTerrainDraw(terrainId) {
        if (this.state.mapInteraction?.mode === "terrain-draw" && this.state.mapInteraction?.terrainId === terrainId) {
          this.state.mapInteraction = null;
          this.setStatus("Terrain draw complete");
        } else {
          this.state.mapInteraction = { mode: "terrain-draw", terrainId };
          this.setStatus("Click the map to add terrain vertices");
        }
        this.renderTerrainEditor();
        this.updateMapSelectionChip();
      }

      clearTerrainPolygon(terrainId) {
        const terrain = (this.state.currentScenario.terrainObjects || []).find((candidate) => candidate.id === terrainId);
        if (!terrain) {
          return;
        }
        terrain.areaPolygon = [];
        this.updateScenarioState("Cleared terrain polygon");
      }

      removeTerrainObject(terrainId) {
        this.state.currentScenario.terrainObjects = (this.state.currentScenario.terrainObjects || []).filter((candidate) => candidate.id !== terrainId);
        if (this.state.mapInteraction?.terrainId === terrainId) {
          this.state.mapInteraction = null;
        }
        this.updateScenarioState("Removed terrain");
      }

      renderRosterEditor() {
        const templates = this.state.currentScenario.templates || [];
        const rosterRows = (this.state.currentScenario.instances || []).map((instance) => ({
          instance,
          template: templates.find((template) => template.id === instance.templateId) || null
        }));
        const renderSideRoster = (side, selectId, summaryId, listId) => {
          const sideRows = rosterRows.filter((row) => row.instance.side === side);
          const select = document.getElementById(selectId);
          if (select) {
            select.innerHTML = templates
              .filter((template) => {
                const roles = this.kernel.ensureArray(template.defaultRoles || []);
                return side === "Blue" ? !roles.includes("UAS") : (roles.includes("UAS") || String(template.category || "").toUpperCase() === "UAS");
              })
              .map((template) => "<option value=\"" + escapeHtml(template.id) + "\">" + escapeHtml(template.name) + "</option>")
              .join("");
          }
          const summaryNode = document.getElementById(summaryId);
          if (summaryNode) {
            summaryNode.innerHTML = [
              { label: side + " Instances", value: sideRows.length },
              { label: "Templates", value: templates.length },
              { label: "Selected", value: sideRows.some((row) => row.instance.id === this.state.selectedMapEntity?.id) ? "Yes" : "No" }
            ].map((card) => (
              "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.05rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
            )).join("");
          }
          const rosterList = document.getElementById(listId);
          if (!rosterList) {
            return;
          }
          rosterList.innerHTML = sideRows.length
            ? sideRows.map((row) => (
                "<div class=\"timeline-card\">" +
                  "<div class=\"toolbar-row\" style=\"justify-content:space-between; align-items:flex-start;\">" +
                    "<div><h4>" + escapeHtml(row.instance.name) + "</h4><div class=\"summary-meta\">" + escapeHtml(row.instance.id + " | " + row.instance.side) + "</div></div>" +
                    "<div class=\"toolbar-row\">" +
                      "<button class=\"button-link select-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Select</button>" +
                      "<button class=\"button-link pick-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Pick On Map</button>" +
                      "<button class=\"button-link remove-roster-instance-btn\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\">Remove</button>" +
                    "</div>" +
                  "</div>" +
                  "<div class=\"form-grid tight\" style=\"margin-top:10px;\">" +
                    "<div class=\"field-stack\"><label>Template</label><select class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"templateId\">" +
                      templates.map((template) => (
                        "<option value=\"" + escapeHtml(template.id) + "\"" + (template.id === row.instance.templateId ? " selected" : "") + ">" + escapeHtml(template.name) + "</option>"
                      )).join("") +
                    "</select></div>" +
                    "<div class=\"field-stack\"><label>Name</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"name\" type=\"text\" value=\"" + escapeHtml(row.instance.name) + "\"></div>" +
                    "<div class=\"field-stack\"><label>X</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posX\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posX)) + "\"></div>" +
                    "<div class=\"field-stack\"><label>Y</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posY\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posY)) + "\"></div>" +
                    "<div class=\"field-stack\"><label>Z</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"posZ\" type=\"number\" value=\"" + escapeHtml(String(row.instance.posZ)) + "\"></div>" +
                    "<div class=\"field-stack\"><label>Heading</label><input class=\"roster-instance-field\" data-instance-id=\"" + escapeHtml(row.instance.id) + "\" data-instance-field=\"headingDeg\" type=\"number\" value=\"" + escapeHtml(String(row.instance.headingDeg ?? 0)) + "\"></div>" +
                  "</div>" +
                  "<div class=\"summary-meta\" style=\"margin-top:8px;\">" + escapeHtml(row.template ? row.template.name : "Missing template") + "</div>" +
                "</div>"
              )).join("")
            : "<div class=\"empty-state\">No " + escapeHtml(side) + " instances yet. Add one, then use Pick On Map for placement.</div>";
        };

        renderSideRoster("Blue", "instance-template-select-blue", "roster-summary-blue", "roster-item-list-blue");
        renderSideRoster("Red", "instance-template-select-red", "roster-summary-red", "roster-item-list-red");

        document.querySelectorAll(".select-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.selectRosterInstance(button.dataset.instanceId);
          });
        });
        document.querySelectorAll(".pick-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.selectRosterInstance(button.dataset.instanceId, { armMapMove: true });
          });
        });
        document.querySelectorAll(".remove-roster-instance-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeRosterInstance(button.dataset.instanceId);
          });
        });
        document.querySelectorAll(".roster-instance-field").forEach((element) => {
          element.addEventListener("change", () => {
            this.updateRosterInstanceField(element.dataset.instanceId, element.dataset.instanceField, element.value);
          });
          element.addEventListener("input", () => {
            this.updateRosterInstanceField(element.dataset.instanceId, element.dataset.instanceField, element.value, { rerender: false });
          });
        });

        const networkList = document.getElementById("network-list");
        networkList.innerHTML = [
          { side: "Blue", id: "Blue-C2-Net-Default", type: "RF", latency: "0.25s", note: "Used automatically for Blue sensors, C2, effectors, and directed child-interceptor launches." },
          { side: "Red", id: "Red-C2-Net-Default", type: "RF", latency: "0.25s", note: "Used automatically for Red C2-directed strike behavior, with autonomous and heuristic fallback when degraded." }
        ].map((network) => (
          "<div class=\"timeline-card\"><h4>" + escapeHtml(network.side + " Network") + "</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(network.id + " | " + network.type + " | " + network.latency) + "</div>" +
          "<div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(network.note) + "</div></div>"
        )).join("");

        const powerGridList = document.getElementById("power-grid-list");
        powerGridList.innerHTML = [
          { side: "Blue", id: "Blue-Power-Default", type: "Tactical", note: "Hidden Blue power grid stays online unless a future power effect degrades it." },
          { side: "Red", id: "Red-Power-Default", type: "Tactical", note: "Hidden Red power grid supports Red C2 linkage and EW systems in the current model." }
        ].map((grid) => (
          "<div class=\"timeline-card\"><h4>" + escapeHtml(grid.side + " Power") + "</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(grid.id + " | " + grid.type) + "</div>" +
          "<div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(grid.note) + "</div></div>"
        )).join("");
      }

      addRosterInstance(forcedSide = null) {
        const side = forcedSide || document.getElementById("instance-side-select")?.value || "Blue";
        const templateId = forcedSide
          ? document.getElementById(side === "Blue" ? "instance-template-select-blue" : "instance-template-select-red")?.value
          : document.getElementById("instance-template-select")?.value;
        if (!templateId) {
          this.setStatus("Choose a template first");
          return;
        }
        const template = this.state.currentScenario.templates.find((candidate) => candidate.id === templateId);
        if (!template) {
          this.setStatus("Choose a valid template first");
          return;
        }
        const existingNames = new Set((this.state.currentScenario.instances || []).map((item) => item.name));
        const existingIds = new Set((this.state.currentScenario.instances || []).map((item) => item.id));
        const instance = {
          id: this.buildUniqueId(side + "-Instance", existingIds),
          templateId,
          name: this.buildUniqueId((template.name || "Instance") + " " + side, existingNames),
          side,
          origin: "roster",
          roles: this.kernel.ensureArray(template.defaultRoles || []),
          networkId: null,
          connectedPowerGridId: null,
          posX: side === "Blue" ? 600 : 100,
          posY: side === "Blue" ? 320 : 220,
          posZ: side === "Blue" ? 20 : 120,
          headingDeg: 0,
          missionWaypoints: []
        };
        this.state.currentScenario.instances.push(instance);
        this.state.selectedMapEntity = this.buildObjectSelection(instance);
        this.state.mapInteraction = { mode: "selected-object-move", instanceId: instance.id };
        this.updateScenarioState("Added instance. Click the map to place it.");
      }

      updateRosterInstanceField(instanceId, field, value, options = {}) {
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === instanceId);
        if (!instance) {
          return;
        }
        this.detachGroupManagedInstance(instance);
        const rerender = options.rerender !== false;
        const numericFields = new Set(["posX", "posY", "posZ", "headingDeg"]);
        if (field === "templateId") {
          instance.templateId = value;
        } else if (field === "side") {
          instance.side = value === "Red" ? "Red" : "Blue";
        } else if (field === "name") {
          instance.name = value || instance.name;
        } else if (numericFields.has(field)) {
          instance[field] = field === "headingDeg"
            ? this.kernel.normalizeHeadingDeg(value)
            : (Number.isFinite(Number(value)) ? Number(value) : instance[field]);
        }
        if (this.state.selectedMapEntity?.id === instanceId) {
          this.state.selectedMapEntity = this.buildObjectSelection(instance);
        }
        if (rerender) {
          this.renderRosterEditor();
        }
        this.updateScenarioState("Updated instance");
      }

      removeRosterInstance(instanceId) {
        const instances = this.state.currentScenario.instances || [];
        const index = instances.findIndex((candidate) => candidate.id === instanceId);
        if (index < 0) {
          return;
        }
        instances.splice(index, 1);
        if (this.state.selectedMapEntity?.id === instanceId) {
          this.state.selectedMapEntity = null;
          this.renderer.setSelection(null);
          this.builderRenderer.setSelection(null);
        }
        if (this.state.mapInteraction?.instanceId === instanceId) {
          this.state.mapInteraction = null;
        }
        this.updateScenarioState("Removed instance");
      }

      buildObjectSelection(instance) {
        return {
          type: "object",
          id: instance.id,
          name: instance.name,
          side: instance.side
        };
      }

      isGroupManagedInstance(instance) {
        return !!instance && (!!instance.builderGroupId || String(instance.id || "").startsWith("BuilderGroup-"));
      }

      detachGroupManagedInstance(instance) {
        if (!this.isGroupManagedInstance(instance)) {
          return;
        }
        const existingIds = new Set((this.state.currentScenario.instances || []).map((candidate) => candidate.id).filter((id) => id !== instance.id));
        instance.id = this.buildUniqueId(
          String(instance.id || (instance.name || "Instance"))
            .replace(/^BuilderGroup-[^-]+-[^-]+-/, (instance.side || "Instance") + "-Detached-"),
          existingIds
        );
        delete instance.builderGroupId;
        delete instance.builderGroupSide;
        delete instance.builderGroupIndex;
        instance.origin = "manual-detached";
        if (this.state.mapInteraction?.instanceId && this.state.mapInteraction.instanceId !== instance.id) {
          this.state.mapInteraction.instanceId = instance.id;
        }
        if (this.state.selectedMapEntity?.type === "object") {
          this.state.selectedMapEntity = this.buildObjectSelection(instance);
        }
      }

      selectRosterInstance(instanceId, options = {}) {
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === instanceId);
        if (!instance) {
          return;
        }
        this.state.selectedMapEntity = this.buildObjectSelection(instance);
        this.state.mapInteraction = options.armMapMove ? { mode: "selected-object-move", instanceId } : null;
        this.renderer.setSelection(this.state.selectedMapEntity);
        this.builderRenderer.setSelection(this.state.selectedMapEntity);
        this.renderRosterEditor();
        this.renderSelectedObjectEditor();
        this.renderScenarioSnapshot();
        this.updateMapSelectionChip();
        if (options.armMapMove) {
          this.setStatus("Click the map to place the selected instance");
        }
      }

      addNetwork() {
        this.state.currentScenario.networks.push({
          id: this.buildUniqueId("Network", new Set((this.state.currentScenario.networks || []).map((item) => item.id))),
          name: "New Network",
          type: "RF",
          transmissionLatencySec: 0.25
        });
        this.updateScenarioState("Added network");
      }

      updateNetworkField(index, field, value) {
        const network = (this.state.currentScenario.networks || [])[index];
        if (!network) {
          return;
        }
        network[field] = field === "transmissionLatencySec" ? Number(value || 0) : value;
        this.updateScenarioState("Updated network");
      }

      removeNetwork(index) {
        this.state.currentScenario.networks.splice(index, 1);
        this.state.currentScenario.instances.forEach((instance) => {
          if (instance.networkId && !(this.state.currentScenario.networks || []).some((network) => network.id === instance.networkId)) {
            instance.networkId = null;
          }
        });
        this.updateScenarioState("Removed network");
      }

      addPowerGrid() {
        this.state.currentScenario.powerGrids.push({
          id: this.buildUniqueId("PowerGrid", new Set((this.state.currentScenario.powerGrids || []).map((item) => item.id))),
          name: "New Power Grid",
          type: "Tactical"
        });
        this.updateScenarioState("Added power grid");
      }

      updatePowerGridField(index, field, value) {
        const grid = (this.state.currentScenario.powerGrids || [])[index];
        if (!grid) {
          return;
        }
        grid[field] = value;
        this.updateScenarioState("Updated power grid");
      }

      removePowerGrid(index) {
        this.state.currentScenario.powerGrids.splice(index, 1);
        this.state.currentScenario.instances.forEach((instance) => {
          if (instance.connectedPowerGridId && !(this.state.currentScenario.powerGrids || []).some((grid) => grid.id === instance.connectedPowerGridId)) {
            instance.connectedPowerGridId = null;
          }
        });
        this.updateScenarioState("Removed power grid");
      }

      renderSelectedObjectEditor() {
        const blueContainer = document.getElementById("selected-object-editor-blue");
        const redContainer = document.getElementById("selected-object-editor-red");
        const resetContainers = (blueHtml, redHtml) => {
          if (blueContainer) {
            blueContainer.innerHTML = blueHtml;
          }
          if (redContainer) {
            redContainer.innerHTML = redHtml;
          }
        };
        const selection = this.state.selectedMapEntity;
        if (!selection) {
          resetContainers(
            "<div class=\"empty-state\">Select a placed object on the map to adjust coordinates and review its hidden C2 / power posture.</div>",
            "<div class=\"empty-state\">Select a placed object on the map to adjust coordinates and review its hidden C2 / power posture.</div>"
          );
          return;
        }
        if (selection.type !== "object") {
          resetContainers(
            "<div class=\"empty-state\">Track selected. Tracks are review-only here; select a physical object to edit placement.</div>",
            "<div class=\"empty-state\">Track selected. Tracks are review-only here; select a physical object to edit placement.</div>"
          );
          return;
        }
        const instance = (this.state.currentScenario.instances || []).find((candidate) => candidate.id === selection.id);
        if (!instance) {
          resetContainers(
            "<div class=\"empty-state\">Selected object is part of preview-only state. Build the scenario first to edit persistent object assignments.</div>",
            "<div class=\"empty-state\">Selected object is part of preview-only state. Build the scenario first to edit persistent object assignments.</div>"
          );
          return;
        }
        const template = this.getTemplateById(instance.templateId);
        const sensorSummary = (template?.components?.sensors || []).map((sensor) => sensor.type).filter(Boolean);
        const effectorSummary = (template?.components?.effectors || []).map((effector) => effector.type).filter(Boolean);
        const supportsRouteEditing = Boolean(template?.components?.movement);
        const firstWaypoint = this.kernel.ensureArray(instance.missionWaypoints || [])[0] || {
          x: instance.posX,
          y: instance.posY,
          z: instance.posZ
        };
        const quickCapabilityNotes = [
          sensorSummary.length ? sensorSummary.join(", ") : "No sensors",
          effectorSummary.length ? effectorSummary.join(", ") : "No effectors",
          template?.components?.c2 ? "Includes C2" : "No C2",
          "Asset value " + Number(template?.components?.health?.assetValuePts || 0),
          (template?.components?.capability?.canOperateAutonomously === false ? "C2-dependent" : "Autonomy-capable"),
          (this.isGroupManagedInstance(instance) ? "Managed by " + String(instance.builderGroupSide || instance.side) + " group" : "Manually managed")
        ];
        const html =
          "<div class=\"summary-grid\" style=\"margin-bottom:12px;\">" +
            "<div class=\"summary-card\"><div class=\"label\">Object</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(instance.name) + "</div></div>" +
            "<div class=\"summary-card\"><div class=\"label\">Side / Template</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(instance.side + " / " + (template?.name || instance.templateId)) + "</div></div>" +
            "<div class=\"summary-card\"><div class=\"label\">Quick Capability View</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(quickCapabilityNotes.join(" | ")) + "</div></div>" +
          "</div>" +
          "<div class=\"form-grid tight\">" +
            "<div class=\"field-stack\"><label>X</label><input id=\"selected-object-x\" type=\"number\" value=\"" + escapeHtml(String(instance.posX)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Y</label><input id=\"selected-object-y\" type=\"number\" value=\"" + escapeHtml(String(instance.posY)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Z</label><input id=\"selected-object-z\" type=\"number\" value=\"" + escapeHtml(String(instance.posZ)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Heading</label><input id=\"selected-object-heading\" type=\"number\" value=\"" + escapeHtml(String(instance.headingDeg ?? 0)) + "\"></div>" +
            "<div class=\"field-stack\"><label>Hidden C2 / Power</label><div class=\"summary-meta\" style=\"padding-top:10px; color: var(--text);\">" + escapeHtml(instance.side + " implicit network + power grid") + "</div></div>" +
          "</div>" +
          (supportsRouteEditing
            ? "<div class=\"form-grid tight\" style=\"margin-top:12px;\">" +
                "<div class=\"field-stack\"><label>Waypoint 1 X</label><input id=\"selected-object-waypoint-x\" type=\"number\" value=\"" + escapeHtml(String(firstWaypoint.x)) + "\"></div>" +
                "<div class=\"field-stack\"><label>Waypoint 1 Y</label><input id=\"selected-object-waypoint-y\" type=\"number\" value=\"" + escapeHtml(String(firstWaypoint.y)) + "\"></div>" +
                "<div class=\"field-stack\"><label>Waypoint 1 Z</label><input id=\"selected-object-waypoint-z\" type=\"number\" value=\"" + escapeHtml(String(firstWaypoint.z)) + "\"></div>" +
                "<div class=\"field-stack\"><label>Route</label><div class=\"summary-meta\" style=\"padding-top:10px; color: var(--text);\">" + escapeHtml(instance.missionWaypoints?.length ? "First waypoint armed" : "No waypoint yet") + "</div></div>" +
              "</div>"
            : "") +
          "<div class=\"controls\" style=\"margin-top:12px;\">" +
            "<button id=\"save-selected-object-btn\">Save Object</button>" +
            "<button id=\"move-selected-object-btn\">Move On Map</button>" +
            (supportsRouteEditing ? "<button id=\"set-selected-waypoint-btn\">Set Waypoint On Map</button>" : "") +
            "<button id=\"open-selected-template-btn\">Open Template</button>" +
          "</div>";
        resetContainers(
          instance.side === "Blue" ? html : "<div class=\"empty-state\">Select a Blue object to edit placement here.</div>",
          instance.side === "Red" ? html : "<div class=\"empty-state\">Select a Red object to edit placement here.</div>"
        );

        document.getElementById("save-selected-object-btn").addEventListener("click", () => {
          this.detachGroupManagedInstance(instance);
          instance.posX = Number(document.getElementById("selected-object-x").value || instance.posX);
          instance.posY = Number(document.getElementById("selected-object-y").value || instance.posY);
          instance.posZ = Number(document.getElementById("selected-object-z").value || instance.posZ);
          instance.headingDeg = this.kernel.normalizeHeadingDeg(document.getElementById("selected-object-heading").value || instance.headingDeg || 0);
          if (supportsRouteEditing) {
            instance.missionWaypoints = [{
              x: Number(document.getElementById("selected-object-waypoint-x").value || firstWaypoint.x),
              y: Number(document.getElementById("selected-object-waypoint-y").value || firstWaypoint.y),
              z: Number(document.getElementById("selected-object-waypoint-z").value || firstWaypoint.z)
            }];
          }
          this.updateScenarioState("Updated selected object");
        });
        document.getElementById("move-selected-object-btn").addEventListener("click", () => {
          this.state.mapInteraction = { mode: "selected-object-move", instanceId: instance.id };
          this.setStatus("Click the map to move the selected object");
          this.updateMapSelectionChip();
        });
        if (supportsRouteEditing) {
          document.getElementById("set-selected-waypoint-btn").addEventListener("click", () => {
            this.state.mapInteraction = {
              mode: "selected-object-waypoint",
              instanceId: instance.id,
              waypointZ: Number(document.getElementById("selected-object-waypoint-z").value || firstWaypoint.z)
            };
            this.setStatus("Click the map to place waypoint 1");
            this.updateMapSelectionChip();
          });
        }
        document.getElementById("open-selected-template-btn").addEventListener("click", () => {
          this.selectTemplate(instance.templateId, "template-editor");
        });
      }

      updateScenarioState(statusText) {
        this.state.currentScenario = this.kernel.normalizeScenario(this.state.currentScenario);
        this.state.lastImportSummary = {
          ...(this.state.lastImportSummary || {}),
          templateCount: this.state.currentScenario.templates.length,
          instanceCount: this.state.currentScenario.instances.length,
          dirty: true
        };
        this.stopPlayback();
        this.clearResults({ clearSelection: false });
        this.updateScenarioLabel();
        this.syncPlaceholderControls();
        this.ensureSelectedTemplate();
        this.refreshValidationSummary();
        this.refreshImportSummary();
        this.renderTemplateBuilder();
        this.renderRosterEditor();
        this.renderTerrainEditor();
        this.refreshWizardSummary();
        this.renderScenarioSnapshot();
        this.renderSelectedObjectEditor();
        this.refreshExportPreview();
        if (statusText) {
          this.setStatus(statusText);
        }
        this.renderRunReminder();
      }

      buildTemplatePreset(preset) {
        if (preset === "red-uas") {
          return {
            id: "Template-Red-UAS",
            name: "Red UAS",
            category: "UAS",
            defaultRoles: ["UAS"],
            components: {
              health: { maxHealth: 90, assetValuePts: 8, isHQ: false },
              resistance: { kineticResistance: 0.18 },
              signature: { radarSignatureDb: -14 },
              movement: { speedMps: 32, stepSec: 1, waypointToleranceM: 10 },
              sensors: [],
              effectors: []
            }
          };
        }
        if (preset === "sensor-node") {
          return {
            id: "Template-Blue-Sensor",
            name: "Blue Sensor Node",
            category: "Sensor",
            defaultRoles: ["Sensor", "Asset"],
            components: {
              health: { maxHealth: 80, assetValuePts: 12, isHQ: false },
              resistance: { kineticResistance: 0.1 },
              signature: { radarSignatureDb: -6 },
              sensors: [{
                id: "Sensor-1",
                name: "Wide-Area Radar",
                type: "Radar",
                maxRangeM: 550,
                horizontalFovDeg: 360,
                verticalFovDeg: 120,
                headingDeg: 0,
                transmitPowerDb: 53,
                noiseFloorDb: -94,
                noiseSigmaDb: 1.2,
                detectionThresholdDb: 17,
                scanIntervalSec: 1,
                classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.82 },
                identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.74 }
              }],
              effectors: [],
              c2: null
            }
          };
        }
        if (preset === "effector-node") {
          return {
            id: "Template-Blue-Effector",
            name: "Blue Effector Node",
            category: "Effector",
            defaultRoles: ["Effector", "Asset", "C2"],
            components: {
              health: { maxHealth: 90, assetValuePts: 18, isHQ: false },
              resistance: { kineticResistance: 0.12 },
              signature: { radarSignatureDb: -4 },
              sensors: [],
              effectors: [{
                id: "Effector-1",
                name: "Kinetic Interceptor",
                type: "Kinetic",
                maxRangeM: 240,
                basePk: 0.72,
                basePe: 0,
                damagePoints: 140,
                ammoCapacity: 3,
                slewRateSec: 0.2,
                cooldownSec: 2,
                projectileSpeedMps: 900
              }],
              c2: { trackCapacity: 6, processingLatencySec: 0.3 }
            }
          };
        }
        if (preset === "asset") {
          return {
            id: "Template-Blue-Asset",
            name: "Blue Defended Asset",
            category: "Asset",
            defaultRoles: ["Asset"],
            components: {
              health: { maxHealth: 110, assetValuePts: 40, isHQ: false },
              resistance: { kineticResistance: 0.08 },
              signature: { radarSignatureDb: -8 },
              sensors: [],
              effectors: [],
              c2: null
            }
          };
        }
        return {
          id: "Template-Blue-Site",
          name: "Blue Site",
          category: "Defense",
          defaultRoles: ["Asset", "Sensor", "Effector", "C2"],
          components: {
            health: { maxHealth: 120, assetValuePts: 100, isHQ: true },
            resistance: { kineticResistance: 0.15 },
            signature: { radarSignatureDb: -2 },
            sensors: [{
              id: "Sensor-1",
              name: "EO / RF Sensor",
              type: "EO_IR",
              maxRangeM: 420,
              horizontalFovDeg: 140,
              verticalFovDeg: 90,
              headingDeg: 180,
              transmitPowerDb: 53,
              noiseFloorDb: -94,
              noiseSigmaDb: 1.2,
              detectionThresholdDb: 17,
              scanIntervalSec: 1,
              classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.84 },
              identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.76 }
            }],
            effectors: [{
              id: "Effector-1",
              name: "Interceptor Launcher",
              type: "Kinetic",
              maxRangeM: 230,
              basePk: 0.74,
              basePe: 0,
              damagePoints: 150,
              ammoCapacity: 3,
              slewRateSec: 0.2,
              cooldownSec: 2,
              projectileSpeedMps: 900
            }],
            c2: { trackCapacity: 8, processingLatencySec: 0.3 }
          }
        };
      }

      createTemplateFromPreset(preset) {
        const template = this.kernel.deepClone(this.buildTemplatePreset(preset));
        const existingIds = new Set(this.state.currentScenario.templates.map((item) => item.id));
        template.id = this.buildUniqueId(template.id, existingIds);
        template.name = template.name + " " + this.state.currentScenario.templates.length;
        this.state.currentScenario.templates.push(template);
        this.state.selectedTemplateId = template.id;
        this.updateScenarioState("Added template " + template.name);
        this.uiManager.showScreen("templates");
      }

      createDefaultSensorDraft(index = 0) {
        return {
          id: "Sensor-" + (index + 1),
          name: "Sensor " + (index + 1),
          type: "Radar",
          maxRangeM: 420,
          horizontalFovDeg: 360,
          verticalFovDeg: 120,
          headingDeg: 0,
          transmitPowerDb: 53,
          noiseFloorDb: -94,
          noiseSigmaDb: 1.2,
          detectionThresholdDb: 17,
          scanIntervalSec: 1,
          classification: { canClassify: true, latencySec: 0.25, accuracyBase: 0.8 },
          identification: { canIdentify: true, latencySec: 0.35, accuracyBase: 0.72 }
        };
      }

      createDefaultEffectorDraft(index = 0, type = "Kinetic") {
        const effectorType = type || "Kinetic";
        const affectedDomains = ({
          Jammer: ["Sensor", "Network", "C2"],
          Spoofer: ["Navigation"],
          Cyber: ["Track", "Telemetry", "C2"]
        }[effectorType] || []);
        return {
          id: "Effector-" + (index + 1),
          name: effectorType + " " + (index + 1),
          type: effectorType,
          deliveryModel: effectorType === "Interceptor" ? "Guided" : (effectorType === "Kinetic" ? "Ballistic" : "Instant"),
          guidanceType: effectorType === "Interceptor" ? "Command" : "Command",
          maxRangeM: effectorType === "Kinetic" ? 230 : 520,
          basePk: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 0.72 : 0,
          basePe: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 0 : 0.65,
          damagePoints: effectorType === "Kinetic" || effectorType === "DirectedEnergy" || effectorType === "Interceptor" ? 140 : 0,
          ammoCapacity: 3,
          slewRateSec: 0.2,
          cooldownSec: 2,
          projectileSpeedMps: effectorType === "Kinetic" || effectorType === "Interceptor" ? 900 : 0,
          terminalRadiusM: 12,
          maxFlightTimeSec: 8,
          effectDurationSec: 6,
          jamStrengthDb: 8,
          affectedDomains
        };
      }

      renderTemplateHelperSummary(template) {
        const container = document.getElementById("template-helper-summary");
        if (!template) {
          container.innerHTML = "<div class=\"empty-state\">Select a template to see helper guidance and quick actions.</div>";
          return;
        }
        const roles = this.kernel.ensureArray(template.defaultRoles || []);
        const sensorCount = this.state.templateEditorSensors.length;
        const effectorCount = this.state.templateEditorEffectors.length;
        const cards = [
          {
            label: "Design Profile",
            value: roles.includes("UAS")
              ? "Mobile threat template. Movement, payload, and lost-link helpers matter most."
              : (roles.includes("Effector")
                ? "Defensive shooter template. Coverage, ammo, and effector mix are the main tuning points."
                : "Fixed or support template. Signature, survivability, and C2 support dominate.")
          },
          {
            label: "Subcomponents",
            value: sensorCount + " sensor(s), " + effectorCount + " effector(s), " + (template.components.c2 ? "C2 enabled" : "no C2")
          },
          {
            label: "Suggested Next Step",
            value: sensorCount > 1 || effectorCount > 1
              ? "Use the subcomponent lists below to tune each sensor/effector individually."
              : "Use helper buttons to seed common bundles, then tune the selected subcomponent."
          }
        ];
        container.innerHTML = cards.map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(card.value) + "</div></div>"
        )).join("");
      }

      renderTemplateSubcomponentEditor(template) {
        const structure = document.getElementById("template-structure-summary");
        const sensorList = document.getElementById("template-sensor-list");
        const effectorList = document.getElementById("template-effector-list");
        this.renderTemplateHelperSummary(template);
        if (!template) {
          structure.innerHTML = "<div class=\"empty-state\">Select a template to edit structure.</div>";
          sensorList.innerHTML = "<div class=\"empty-state\">No sensor editor active.</div>";
          effectorList.innerHTML = "<div class=\"empty-state\">No effector editor active.</div>";
          return;
        }
        const movementEnabled = !!template.components.movement;
        structure.innerHTML = [
          { label: "Movement", value: movementEnabled ? "Enabled" : "Static" },
          { label: "Sensors", value: this.state.templateEditorSensors.length },
          { label: "Effectors", value: this.state.templateEditorEffectors.length },
          { label: "Power / C2", value: (template.components.powerConsumer?.powerConsumedKw ?? 0) + " kW | " + (template.components.c2 ? "C2 enabled" : "No C2") }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top:8px; color: var(--text);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");

        sensorList.innerHTML = this.state.templateEditorSensors.length
          ? this.state.templateEditorSensors.map((sensor, index) => (
              "<div class=\"subcomponent-card" + (index === this.state.activeTemplateSensorIndex ? " active" : "") + "\" data-template-sensor-index=\"" + escapeHtml(String(index)) + "\">" +
                "<h4>" + escapeHtml(sensor.name || ("Sensor " + (index + 1))) + "</h4>" +
                "<div class=\"summary-meta\">" + escapeHtml(sensor.id || ("Sensor-" + (index + 1))) + "</div>" +
                "<div class=\"summary-meta\">" + escapeHtml(sensor.type || "Radar") + " | " + escapeHtml(String(sensor.maxRangeM ?? 0)) + " m</div>" +
              "</div>"
            )).join("")
          : "<div class=\"empty-state\">No sensors yet. Add one to start component-level editing.</div>";
        effectorList.innerHTML = this.state.templateEditorEffectors.length
          ? this.state.templateEditorEffectors.map((effector, index) => (
              "<div class=\"subcomponent-card" + (index === this.state.activeTemplateEffectorIndex ? " active" : "") + "\" data-template-effector-index=\"" + escapeHtml(String(index)) + "\">" +
                "<h4>" + escapeHtml(effector.name || ("Effector " + (index + 1))) + "</h4>" +
                "<div class=\"summary-meta\">" + escapeHtml(effector.id || ("Effector-" + (index + 1))) + "</div>" +
                "<div class=\"summary-meta\">" + escapeHtml(effector.type || "Kinetic") + " | " + escapeHtml(String(effector.maxRangeM ?? 0)) + " m</div>" +
              "</div>"
            )).join("")
          : "<div class=\"empty-state\">No effectors yet. Add one to start component-level editing.</div>";

        sensorList.querySelectorAll("[data-template-sensor-index]").forEach((node) => {
          node.addEventListener("click", () => {
            this.updateTemplateSensorDraftFromForm();
            this.state.activeTemplateSensorIndex = Number(node.dataset.templateSensorIndex || 0);
            this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
            this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
          });
        });
        effectorList.querySelectorAll("[data-template-effector-index]").forEach((node) => {
          node.addEventListener("click", () => {
            this.updateTemplateEffectorDraftFromForm();
            this.state.activeTemplateEffectorIndex = Number(node.dataset.templateEffectorIndex || 0);
            this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
            this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
          });
        });
      }

      addTemplateSensor() {
        this.updateTemplateSensorDraftFromForm();
        const sensor = this.createDefaultSensorDraft(this.state.templateEditorSensors.length);
        this.state.templateEditorSensors.push(sensor);
        this.state.activeTemplateSensorIndex = this.state.templateEditorSensors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor slot added to template editor");
      }

      duplicateTemplateSensor() {
        if (!this.state.templateEditorSensors.length) {
          this.addTemplateSensor();
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        const source = this.kernel.deepClone(this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || this.state.templateEditorSensors[0]);
        source.id = this.buildUniqueId((source.id || "Sensor") + "-Copy", new Set(this.state.templateEditorSensors.map((item) => item.id)));
        source.name = (source.name || "Sensor") + " Copy";
        this.state.templateEditorSensors.push(source);
        this.state.activeTemplateSensorIndex = this.state.templateEditorSensors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor duplicated in template editor");
      }

      removeTemplateSensor() {
        if (!this.state.templateEditorSensors.length) {
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        this.state.templateEditorSensors.splice(this.state.activeTemplateSensorIndex, 1);
        this.state.activeTemplateSensorIndex = Math.max(0, Math.min(this.state.activeTemplateSensorIndex, this.state.templateEditorSensors.length - 1));
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Sensor removed from template editor");
      }

      addTemplateEffector(type = "Kinetic") {
        this.updateTemplateEffectorDraftFromForm();
        const effector = this.createDefaultEffectorDraft(this.state.templateEditorEffectors.length, type);
        this.state.templateEditorEffectors.push(effector);
        this.state.activeTemplateEffectorIndex = this.state.templateEditorEffectors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector slot added to template editor");
      }

      duplicateTemplateEffector() {
        if (!this.state.templateEditorEffectors.length) {
          this.addTemplateEffector();
          return;
        }
        this.updateTemplateEffectorDraftFromForm();
        const source = this.kernel.deepClone(this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || this.state.templateEditorEffectors[0]);
        source.id = this.buildUniqueId((source.id || "Effector") + "-Copy", new Set(this.state.templateEditorEffectors.map((item) => item.id)));
        source.name = (source.name || "Effector") + " Copy";
        this.state.templateEditorEffectors.push(source);
        this.state.activeTemplateEffectorIndex = this.state.templateEditorEffectors.length - 1;
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector duplicated in template editor");
      }

      removeTemplateEffector() {
        if (!this.state.templateEditorEffectors.length) {
          return;
        }
        this.updateTemplateEffectorDraftFromForm();
        this.state.templateEditorEffectors.splice(this.state.activeTemplateEffectorIndex, 1);
        this.state.activeTemplateEffectorIndex = Math.max(0, Math.min(this.state.activeTemplateEffectorIndex, this.state.templateEditorEffectors.length - 1));
        this.populateTemplateEditor(this.ensureSelectedTemplate(), { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Effector removed from template editor");
      }

      updateTemplateSensorDraftFromForm() {
        const enabled = document.getElementById("template-sensor-enabled").checked;
        if (!enabled) {
          this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
          return;
        }
        if (!this.state.templateEditorSensors.length) {
          this.state.templateEditorSensors.push(this.createDefaultSensorDraft(0));
          this.state.activeTemplateSensorIndex = 0;
        }
        const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || this.state.templateEditorSensors[0];
        if (!sensor) {
          return;
        }
        sensor.id = document.getElementById("template-sensor-id-input").value.trim() || sensor.id || "Sensor-1";
        sensor.name = document.getElementById("template-sensor-name-input").value.trim() || sensor.name || "Sensor";
        sensor.type = document.getElementById("template-sensor-type-input").value || "Radar";
        sensor.maxRangeM = Number(document.getElementById("template-sensor-range-input").value || 0);
        sensor.headingDeg = Number(document.getElementById("template-sensor-heading-input").value || 0);
        sensor.horizontalFovDeg = Number(document.getElementById("template-sensor-hfov-input").value || 360);
        sensor.verticalFovDeg = Number(document.getElementById("template-sensor-vfov-input").value || 180);
        sensor.scanIntervalSec = Number(document.getElementById("template-sensor-scan-input").value || 1);
        sensor.detectionThresholdDb = Number(document.getElementById("template-sensor-threshold-input").value || 17);
        sensor.transmitPowerDb = Number(document.getElementById("template-sensor-transmit-input").value || 0);
        sensor.noiseFloorDb = Number(document.getElementById("template-sensor-noise-floor-input").value || -94);
        sensor.noiseSigmaDb = Number(document.getElementById("template-sensor-noise-sigma-input").value || 1.2);
        sensor.classification = sensor.classification || { canClassify: true, latencySec: 0.25, accuracyBase: 0.8 };
        sensor.identification = sensor.identification || { canIdentify: true, latencySec: 0.35, accuracyBase: 0.72 };
        sensor.classification.accuracyBase = Number(document.getElementById("template-sensor-classify-accuracy-input").value || sensor.classification.accuracyBase || 0.8);
        sensor.identification.accuracyBase = Number(document.getElementById("template-sensor-identify-accuracy-input").value || sensor.identification.accuracyBase || 0.72);
        this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
      }

      updateTemplateEffectorDraftFromForm() {
        const enabled = document.getElementById("template-effector-enabled").checked;
        if (!enabled) {
          this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
          return;
        }
        if (!this.state.templateEditorEffectors.length) {
          this.state.templateEditorEffectors.push(this.createDefaultEffectorDraft(0));
          this.state.activeTemplateEffectorIndex = 0;
        }
        const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || this.state.templateEditorEffectors[0];
        if (!effector) {
          return;
        }
        effector.id = document.getElementById("template-effector-id-input").value.trim() || effector.id || "Effector-1";
        effector.name = document.getElementById("template-effector-name-input").value.trim() || effector.name || "Effector";
        effector.type = document.getElementById("template-effector-type-input").value || "Kinetic";
        effector.guidanceType = document.getElementById("template-effector-guidance-input").value || "Command";
        effector.maxRangeM = Number(document.getElementById("template-effector-range-input").value || 0);
        effector.basePk = Number(document.getElementById("template-effector-basepk-input").value || 0);
        effector.basePe = Number(document.getElementById("template-effector-basepe-input").value || 0);
        effector.damagePoints = Number(document.getElementById("template-effector-damage-input").value || 0);
        effector.ammoCapacity = Number(document.getElementById("template-effector-ammo-input").value || 0);
        effector.slewRateSec = Number(document.getElementById("template-effector-slew-input").value || 0.2);
        effector.cooldownSec = Number(document.getElementById("template-effector-cooldown-input").value || 1.5);
        effector.projectileSpeedMps = Number(document.getElementById("template-effector-speed-input").value || 0);
        effector.terminalRadiusM = Number(document.getElementById("template-effector-terminal-radius-input").value || 12);
        effector.maxFlightTimeSec = Number(document.getElementById("template-effector-flight-time-input").value || 8);
        effector.effectDurationSec = Number(document.getElementById("template-effector-effect-duration-input").value || 6);
        effector.jamStrengthDb = Number(document.getElementById("template-effector-jam-strength-input").value || 8);
        effector.affectedDomains = document.getElementById("template-effector-domains-input").value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        this.renderTemplateSubcomponentEditor(this.ensureSelectedTemplate());
      }

      applyTemplateHelper(helperId) {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        this.updateTemplateSensorDraftFromForm();
        this.updateTemplateEffectorDraftFromForm();
        if (helperId === "static-asset") {
          document.getElementById("template-movement-enabled").checked = false;
          document.getElementById("template-roles-input").value = "Asset";
          document.getElementById("template-power-consumed-input").value = 2;
        } else if (helperId === "mobile-uas") {
          document.getElementById("template-movement-enabled").checked = true;
          document.getElementById("template-speed-input").value = 32;
          document.getElementById("template-step-input").value = 1;
          document.getElementById("template-waypoint-tolerance-input").value = 10;
          document.getElementById("template-roles-input").value = "UAS";
          document.getElementById("template-power-consumed-input").value = 5;
        } else if (helperId === "add-radar") {
          this.addTemplateSensor();
          const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex];
          sensor.type = "Radar";
          sensor.name = "Wide-Area Radar";
          sensor.maxRangeM = 550;
          sensor.horizontalFovDeg = 360;
          sensor.verticalFovDeg = 120;
          sensor.transmitPowerDb = 53;
          sensor.detectionThresholdDb = 17;
        } else if (helperId === "add-interceptor") {
          this.addTemplateEffector("Interceptor");
          const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex];
          effector.name = "Interceptor Launcher";
          effector.maxRangeM = 230;
          effector.basePk = 0.74;
          effector.damagePoints = 150;
          effector.projectileSpeedMps = 900;
        } else if (helperId === "add-jammer") {
          this.addTemplateEffector("Jammer");
          const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex];
          effector.name = "Stand-In Jammer";
          effector.maxRangeM = 520;
          effector.basePe = 0.92;
          effector.damagePoints = 0;
          effector.jamStrengthDb = 14;
          effector.effectDurationSec = 8;
          effector.affectedDomains = ["Sensor", "Network", "C2"];
        }
        this.populateTemplateEditor(template, { preserveDrafts: true, preserveSelection: true });
        this.setStatus("Template helper applied");
      }

      renderTemplateBuilder() {
        const summary = document.getElementById("template-library-summary");
        const list = document.getElementById("template-list");
        const templates = this.state.currentScenario.templates;
        const search = String(this.state.templateSearch || "").trim().toLowerCase();
        const filtered = templates.filter((template) => {
          const haystack = [
            template.id,
            template.name,
            template.category,
            ...(template.defaultRoles || [])
          ].join(" ").toLowerCase();
          return !search || haystack.includes(search);
        });
        if (filtered.length && !filtered.some((template) => template.id === this.state.selectedTemplateId)) {
          this.state.selectedTemplateId = filtered[0].id;
        }
        const selected = this.ensureSelectedTemplate();
        summary.innerHTML = [
          { label: "Templates", value: templates.length },
          { label: "Filtered", value: filtered.length },
          { label: "In Use", value: templates.filter((template) => this.getTemplateUsage(template.id).length > 0).length }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.05rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");
        list.innerHTML = filtered.length
          ? filtered.map((template) => {
              const usage = this.getTemplateUsage(template.id);
              const hasSensor = (template.components.sensors || []).length > 0 ? "Sensor" : "No Sensor";
              const hasEffector = (template.components.effectors || []).length > 0 ? "Effector" : "No Effector";
              return (
                "<div class=\"template-card" + (template.id === selected?.id ? " active" : "") + "\" data-template-id=\"" + escapeHtml(template.id) + "\">" +
                  "<h4>" + escapeHtml(template.name) + "</h4>" +
                  "<div class=\"template-meta\">" + escapeHtml(template.id) + "</div>" +
                  "<div class=\"template-meta\">" + escapeHtml(template.category || "Generic") + " | " + escapeHtml((template.defaultRoles || []).join(", ") || "No roles") + "</div>" +
                  "<div class=\"template-meta\">Used by " + usage.length + " instance(s) | " + hasSensor + " | " + hasEffector + "</div>" +
                "</div>"
              );
            }).join("")
          : "<div class=\"empty-state\">No templates match the current filter.</div>";
        list.querySelectorAll("[data-template-id]").forEach((node) => {
          node.addEventListener("click", () => {
            this.selectTemplate(node.dataset.templateId);
          });
        });
        this.populateTemplateEditor(selected);
      }

      populateTemplateEditor(template, options = {}) {
        const usageSummary = document.getElementById("template-usage-summary");
        if (!template) {
          usageSummary.innerHTML = "<div class=\"empty-state\">Select or create a template to edit it.</div>";
          document.getElementById("template-helper-summary").innerHTML = "<div class=\"empty-state\">Select a template to see helper guidance and quick actions.</div>";
          document.getElementById("template-structure-summary").innerHTML = "";
          document.getElementById("template-sensor-list").innerHTML = "<div class=\"empty-state\">No sensor editor active.</div>";
          document.getElementById("template-effector-list").innerHTML = "<div class=\"empty-state\">No effector editor active.</div>";
          document.getElementById("template-json-editor").value = "";
          this.state.templateJsonDirty = false;
          return;
        }
        const preserveDrafts = !!options.preserveDrafts;
        const preserveSelection = !!options.preserveSelection;
        if (!preserveDrafts) {
          this.state.templateEditorSensors = this.kernel.deepClone(template.components.sensors || []);
          this.state.templateEditorEffectors = this.kernel.deepClone(template.components.effectors || []);
        }
        this.state.activeTemplateSensorIndex = preserveSelection
          ? Math.max(0, Math.min(this.state.activeTemplateSensorIndex, Math.max(this.state.templateEditorSensors.length - 1, 0)))
          : 0;
        this.state.activeTemplateEffectorIndex = preserveSelection
          ? Math.max(0, Math.min(this.state.activeTemplateEffectorIndex, Math.max(this.state.templateEditorEffectors.length - 1, 0)))
          : 0;
        const usage = this.getTemplateUsage(template.id);
        const sensor = this.state.templateEditorSensors[this.state.activeTemplateSensorIndex] || null;
        const effector = this.state.templateEditorEffectors[this.state.activeTemplateEffectorIndex] || null;
        const c2 = template.components.c2 || null;
        usageSummary.innerHTML = [
          { label: "Used by", value: usage.length ? usage.map((item) => item.name).join(", ") : "No instances yet" },
          { label: "Extra components", value: Math.max(this.state.templateEditorSensors.length - 1, 0) + " extra sensor(s), " + Math.max(this.state.templateEditorEffectors.length - 1, 0) + " extra effector(s)" },
          { label: "Editor mode", value: "Component workbench + selected-template JSON" }
        ].map((card) => (
          "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"summary-meta\" style=\"margin-top: 8px; color: var(--text);\">" + escapeHtml(String(card.value)) + "</div></div>"
        )).join("");

        document.getElementById("template-id-input").value = template.id;
        document.getElementById("template-name-input").value = template.name || "";
        document.getElementById("template-category-input").value = template.category || "";
        document.getElementById("template-roles-input").value = (template.defaultRoles || []).join(", ");
        this.writeTemplateBoundFieldsFromTemplate(template);
        document.getElementById("template-movement-enabled").checked = !!template.components.movement;
        document.getElementById("template-speed-input").value = template.components.movement?.speedMps ?? 0;
        document.getElementById("template-step-input").value = template.components.movement?.stepSec ?? 1;
        document.getElementById("template-waypoint-tolerance-input").value = template.components.movement?.waypointToleranceM ?? 10;
        document.getElementById("template-sensor-enabled").checked = !!sensor;
        document.getElementById("template-sensor-id-input").value = sensor?.id || "";
        document.getElementById("template-sensor-name-input").value = sensor?.name || "";
        document.getElementById("template-sensor-type-input").value = sensor?.type || "";
        document.getElementById("template-sensor-range-input").value = sensor?.maxRangeM ?? 0;
        document.getElementById("template-sensor-heading-input").value = sensor?.headingDeg ?? 0;
        document.getElementById("template-sensor-hfov-input").value = sensor?.horizontalFovDeg ?? 360;
        document.getElementById("template-sensor-vfov-input").value = sensor?.verticalFovDeg ?? 180;
        document.getElementById("template-sensor-scan-input").value = sensor?.scanIntervalSec ?? 1;
        document.getElementById("template-sensor-threshold-input").value = sensor?.detectionThresholdDb ?? 17;
        document.getElementById("template-sensor-transmit-input").value = sensor?.transmitPowerDb ?? 53;
        document.getElementById("template-sensor-noise-floor-input").value = sensor?.noiseFloorDb ?? -94;
        document.getElementById("template-sensor-noise-sigma-input").value = sensor?.noiseSigmaDb ?? 1.2;
        document.getElementById("template-sensor-classify-accuracy-input").value = sensor?.classification?.accuracyBase ?? 0.8;
        document.getElementById("template-sensor-identify-accuracy-input").value = sensor?.identification?.accuracyBase ?? 0.72;
        document.getElementById("template-effector-enabled").checked = !!effector;
        document.getElementById("template-effector-id-input").value = effector?.id || "";
        document.getElementById("template-effector-name-input").value = effector?.name || "";
        document.getElementById("template-effector-type-input").value = effector?.type || "";
        document.getElementById("template-effector-guidance-input").value = effector?.guidanceType || "Command";
        document.getElementById("template-effector-range-input").value = effector?.maxRangeM ?? 0;
        document.getElementById("template-effector-basepk-input").value = effector?.basePk ?? 0;
        document.getElementById("template-effector-basepe-input").value = effector?.basePe ?? 0;
        document.getElementById("template-effector-damage-input").value = effector?.damagePoints ?? 0;
        document.getElementById("template-effector-ammo-input").value = effector?.ammoCapacity ?? 0;
        document.getElementById("template-effector-slew-input").value = effector?.slewRateSec ?? 0.2;
        document.getElementById("template-effector-cooldown-input").value = effector?.cooldownSec ?? 1.5;
        document.getElementById("template-effector-speed-input").value = effector?.projectileSpeedMps ?? 0;
        document.getElementById("template-effector-terminal-radius-input").value = effector?.terminalRadiusM ?? 12;
        document.getElementById("template-effector-flight-time-input").value = effector?.maxFlightTimeSec ?? 8;
        document.getElementById("template-effector-effect-duration-input").value = effector?.effectDurationSec ?? 6;
        document.getElementById("template-effector-jam-strength-input").value = effector?.jamStrengthDb ?? 8;
        document.getElementById("template-effector-domains-input").value = this.kernel.ensureArray(effector?.affectedDomains || []).join(", ");
        document.getElementById("template-c2-enabled").checked = !!c2;
        document.getElementById("template-c2-capacity-input").value = c2?.trackCapacity ?? 0;
        document.getElementById("template-c2-latency-input").value = c2?.processingLatencySec ?? 0.25;
        this.renderTemplateSubcomponentEditor(template);
        this.syncTemplateJsonEditorFromDraft(true);
      }

      saveSelectedTemplateForm() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const oldTemplateId = template.id;
        const nextTemplate = this.buildTemplateDraftSnapshot(template, { enforceUniqueId: true });
        const index = this.state.currentScenario.templates.findIndex((item) => item.id === oldTemplateId);
        if (index < 0) {
          this.setStatus("Selected template no longer exists");
          return;
        }
        this.state.currentScenario.templates[index] = nextTemplate;
        if (oldTemplateId !== nextTemplate.id) {
          this.state.currentScenario.instances.forEach((instance) => {
            if (instance.templateId === oldTemplateId) {
              instance.templateId = nextTemplate.id;
            }
          });
          this.syncWizardTemplateRefs(oldTemplateId, nextTemplate.id);
        }
        this.state.selectedTemplateId = nextTemplate.id;
        this.updateScenarioState("Saved template " + nextTemplate.name);
        this.uiManager.showScreen("templates");
      }

      duplicateSelectedTemplate() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const duplicate = this.buildTemplateDraftSnapshot(template);
        const existingIds = new Set(this.state.currentScenario.templates.map((item) => item.id));
        duplicate.id = this.buildUniqueId(duplicate.id + "-Copy", existingIds);
        duplicate.name = duplicate.name + " Copy";
        this.state.currentScenario.templates.push(duplicate);
        this.state.selectedTemplateId = duplicate.id;
        this.updateScenarioState("Duplicated template " + duplicate.name);
        this.uiManager.showScreen("templates");
      }

      deleteSelectedTemplate() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        const usage = this.getTemplateUsage(template.id);
        const wizardUsage = this.getWizardTemplateBindingUsage(template.id);
        if (usage.length || wizardUsage.length) {
          this.setStatus("Cannot delete a template that is still used by instances or Scenario Editor group bindings");
          return;
        }
        this.state.currentScenario.templates = this.state.currentScenario.templates.filter((item) => item.id !== template.id);
        this.state.selectedTemplateId = this.state.currentScenario.templates[0]?.id || null;
        this.updateScenarioState("Deleted template " + template.name);
        this.uiManager.showScreen("templates");
      }

      applyTemplateJsonEditor() {
        const template = this.ensureSelectedTemplate();
        if (!template) {
          return;
        }
        try {
          this.syncTemplateJsonEditorFromDraft(false);
          const parsed = JSON.parse(document.getElementById("template-json-editor").value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Template JSON must be an object.");
          }
          const oldTemplateId = template.id;
          const index = this.state.currentScenario.templates.findIndex((item) => item.id === oldTemplateId);
          if (index < 0) {
            throw new Error("Selected template no longer exists.");
          }
          this.state.currentScenario.templates[index] = parsed;
          this.state.currentScenario = this.kernel.normalizeScenario(this.state.currentScenario);
          const replacement = this.state.currentScenario.templates[index];
          if (replacement && oldTemplateId !== replacement.id) {
            this.state.currentScenario.instances.forEach((instance) => {
              if (instance.templateId === oldTemplateId) {
                instance.templateId = replacement.id;
              }
            });
            this.syncWizardTemplateRefs(oldTemplateId, replacement.id);
          }
          this.state.selectedTemplateId = replacement?.id || oldTemplateId;
          this.state.templateJsonDirty = false;
          this.updateScenarioState("Applied advanced template JSON");
          this.uiManager.showScreen("templates");
        } catch (error) {
          this.setStatus("Template JSON error: " + String(error && error.message ? error.message : error));
        }
      }

      async loadWizardGeneratorPattern(preset) {
        const values = await this.loadWizardPresetData(preset);
        document.getElementById("wizard-preset").value = preset;
        document.getElementById("wizard-scenario-name").value = values.scenarioName;
        document.getElementById("wizard-scenario-description").value = values.description;
        document.getElementById("map-width-input").value = values.mapWidth || 1080;
        this.state.currentScenario.metadata = {
          ...(this.state.currentScenario.metadata || {}),
          notes: values.notes || "",
          tutorial: values.tutorial || ""
        };
        this.state.wizardBlueAssets = (values.blueAssets || []).map((asset) => this.createWizardBlueAsset(asset));
        this.state.activeWizardBlueAssetId = this.state.wizardBlueAssets[0]?.localId || null;
        this.renderWizardBlueAssets();
        this.state.wizardThreatGroups = (values.threatGroups || []).map((group) => this.createWizardThreatGroup(group));
        this.state.activeWizardThreatGroupId = this.state.wizardThreatGroups[0]?.localId || null;
        this.renderWizardThreatGroups();
        document.getElementById("wizard-ghost-enabled").checked = values.ghost;
        document.getElementById("wizard-clutter-enabled").checked = values.clutter;
        this.buildScenarioFromWizard();
      }

      loadWizardPreset(preset) {
        this.loadWizardGeneratorPattern(preset);
      }

      createWizardBlueAsset(overrides = {}) {
        const asset = {
          localId: "blue-asset-" + this.state.nextWizardBlueAssetId,
          name: "Blue Group",
          templateRef: "preset:blue-site",
          count: 1,
          posX: 670,
          posY: 315,
          posZ: 20,
          spacingX: 0,
          spacingY: 40,
          isHQ: false
        };
        this.state.nextWizardBlueAssetId += 1;
        return {
          ...asset,
          ...this.kernel.deepClone(overrides)
        };
      }

      getWizardBlueTemplateOptions() {
        const templateOptions = this.state.currentScenario.templates
          .filter((template) => {
            const roles = this.kernel.ensureArray(template.defaultRoles || []);
            return !roles.includes("UAS");
          })
          .map((template) => ({
            value: "template:" + template.id,
            label: template.name + " (Current Template)"
          }));
        return [
          { value: "preset:blue-site", label: "Preset: Blue Site" },
          { value: "preset:sensor-node", label: "Preset: Sensor Node" },
          { value: "preset:effector-node", label: "Preset: Effector Node" },
          { value: "preset:asset", label: "Preset: Defended Asset" },
          ...templateOptions
        ];
      }

      renderWizardBlueAssets() {
        const container = document.getElementById("wizard-blue-asset-list");
        const assets = this.state.wizardBlueAssets;
        if (!assets.length) {
          container.innerHTML = "<div class=\"empty-state\">No Blue assets yet. Add one to define template binding and placement.</div>";
        }
        const templateOptions = this.getWizardBlueTemplateOptions();
        const groupSelect = document.getElementById("wizard-template-select-blue-group");
        if (groupSelect) {
          groupSelect.innerHTML = templateOptions.map((option) => (
            "<option value=\"" + escapeHtml(option.value) + "\">" + escapeHtml(option.label) + "</option>"
          )).join("");
        }
        if (!assets.length) {
          return;
        }
        container.innerHTML = assets.map((asset, index) => (
          "<div class=\"threat-group-card" + (this.state.activeWizardBlueAssetId === asset.localId ? " active" : "") + "\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">" +
            "<div class=\"threat-group-header\">" +
              "<div>" +
                "<h4>Blue Group " + escapeHtml(String(index + 1)) + "</h4>" +
                "<div class=\"threat-group-subtitle\">" + escapeHtml(asset.name || "Blue Group") + " | " + escapeHtml(templateOptions.find((option) => option.value === asset.templateRef)?.label || asset.templateRef) + " | " + escapeHtml(String(asset.count || 1)) + " instance(s)" + (asset.isHQ ? " | HQ lead" : "") + "</div>" +
              "</div>" +
              "<div class=\"toolbar-row\">" +
                "<button class=\"button-link wizard-select-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Select</button>" +
                "<button class=\"button-link wizard-pick-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Pick On Map</button>" +
                "<button class=\"button-link wizard-remove-blue-asset-btn\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">Remove Group</button>" +
              "</div>" +
            "</div>" +
            "<div class=\"form-grid tight\">" +
              "<div class=\"field-stack\"><label>Name</label><input data-blue-asset-field=\"name\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"text\" value=\"" + escapeHtml(asset.name) + "\"></div>" +
              "<div class=\"field-stack\"><label>Template</label><select data-blue-asset-field=\"templateRef\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\">" +
                templateOptions.map((option) => (
                  "<option value=\"" + escapeHtml(option.value) + "\"" + (asset.templateRef === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>"
                )).join("") +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Count</label><input data-blue-asset-field=\"count\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" min=\"1\" max=\"8\" value=\"" + escapeHtml(String(asset.count || 1)) + "\"></div>" +
              "<div class=\"field-stack\"><label>X</label><input data-blue-asset-field=\"posX\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Y</label><input data-blue-asset-field=\"posY\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Z</label><input data-blue-asset-field=\"posZ\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.posZ)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Spacing X</label><input data-blue-asset-field=\"spacingX\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.spacingX || 0)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Spacing Y</label><input data-blue-asset-field=\"spacingY\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(asset.spacingY || 0)) + "\"></div>" +
              "<div class=\"field-stack inline-check\"><input data-blue-asset-field=\"isHQ\" data-blue-asset-id=\"" + escapeHtml(asset.localId) + "\" type=\"checkbox\"" + (asset.isHQ ? " checked" : "") + "><label>Mark as HQ / defended primary asset</label></div>" +
            "</div>" +
          "</div>"
        )).join("");

        container.querySelectorAll("[data-blue-asset-field]").forEach((element) => {
          const eventName = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
          element.addEventListener(eventName, () => {
            const value = element.type === "checkbox" ? element.checked : element.value;
            this.updateWizardBlueAssetField(element.dataset.blueAssetId, element.dataset.blueAssetField, value, { rerender: eventName !== "input" });
          });
          if (eventName === "input") {
            element.addEventListener("change", () => {
              const value = element.type === "checkbox" ? element.checked : element.value;
              this.updateWizardBlueAssetField(element.dataset.blueAssetId, element.dataset.blueAssetField, value, { rerender: true });
            });
          }
        });
        container.querySelectorAll(".wizard-remove-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeWizardBlueAsset(button.dataset.blueAssetId);
          });
        });
        container.querySelectorAll(".wizard-select-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardBlueAssetId = button.dataset.blueAssetId;
            this.renderWizardBlueAssets();
            this.setStatus("Blue asset selected");
          });
        });
        container.querySelectorAll(".wizard-pick-blue-asset-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardBlueAssetId = button.dataset.blueAssetId;
            this.state.mapInteraction = { mode: "blue-asset-position", blueAssetId: button.dataset.blueAssetId };
            this.renderWizardBlueAssets();
            this.updateMapSelectionChip();
            this.setStatus("Click the map to place Blue asset");
          });
        });
      }

      addWizardBlueAsset(overrides = {}) {
        const selectedTemplateRef = document.getElementById("wizard-template-select-blue-group")?.value;
        const asset = this.createWizardBlueAsset({
          ...(selectedTemplateRef ? { templateRef: selectedTemplateRef } : {}),
          ...overrides
        });
        this.state.wizardBlueAssets.push(asset);
        this.state.activeWizardBlueAssetId = asset.localId;
        this.syncBlueGroupToDraft(asset.localId);
        this.renderWizardBlueAssets();
        this.refreshWizardSummary();
        this.setStatus("Blue asset added");
      }

      removeWizardBlueAsset(localId) {
        this.state.wizardBlueAssets = this.state.wizardBlueAssets.filter((asset) => asset.localId !== localId);
        this.removeGroupManagedDraftInstances(localId, "Blue");
        if (this.state.activeWizardBlueAssetId === localId) {
          this.state.activeWizardBlueAssetId = this.state.wizardBlueAssets[0]?.localId || null;
        }
        this.renderWizardBlueAssets();
        this.refreshWizardSummary();
        this.updateScenarioState("Blue group removed");
        this.setStatus("Blue asset removed");
      }

      updateWizardBlueAssetField(localId, field, value, options = {}) {
        const asset = this.state.wizardBlueAssets.find((item) => item.localId === localId);
        if (!asset) {
          return;
        }
        const rerender = options.rerender !== false;
        const numericFields = new Set(["count", "posX", "posY", "posZ", "spacingX", "spacingY"]);
        if (field === "isHQ") {
          asset.isHQ = !!value;
        } else if (numericFields.has(field)) {
          asset[field] = Number.isFinite(Number(value)) ? Number(value) : asset[field];
          if (field === "count") {
            asset.count = Math.max(1, Math.min(8, Math.floor(asset.count || 1)));
          }
        } else {
          asset[field] = value;
        }
        if (rerender) {
          this.renderWizardBlueAssets();
        }
        this.syncBlueGroupToDraft(localId);
        this.refreshWizardSummary();
      }

      createWizardThreatGroup(overrides = {}) {
        const group = {
          localId: "threat-group-" + this.state.nextWizardThreatGroupId,
          templateName: "Red UAS",
          templateRef: "preset:red-uas",
          instancePrefix: "Red UAS",
          profile: "recon-strike",
          count: 1,
          speed: 35,
          health: 90,
          signature: -14,
          routePattern: "direct",
          startX: 90,
          startY: 315,
          startZ: 120,
          endX: 980,
          endY: 315,
          endZ: 120,
          startSpacingY: 0,
          endSpacingY: 0
        };
        this.state.nextWizardThreatGroupId += 1;
        return {
          ...group,
          ...this.kernel.deepClone(overrides)
        };
      }

      getWizardRedTemplateOptions() {
        const templateOptions = this.state.currentScenario.templates
          .filter((template) => {
            const roles = this.kernel.ensureArray(template.defaultRoles || []);
            return roles.includes("UAS") || String(template.category || "").toUpperCase() === "UAS";
          })
          .map((template) => ({
            value: "template:" + template.id,
            label: template.name + " (Current Template)"
          }));
        return [
          { value: "preset:red-uas", label: "Preset: Red UAS" },
          ...templateOptions
        ];
      }

      getWizardThreatProfileDefaults(profile) {
        const defaults = {
          "recon-strike": {
            templateName: "Red Recon Strike UAS",
            instancePrefix: "Red UAS",
            speed: 35,
            health: 90,
            signature: -14
          },
          attack: {
            templateName: "Red Attack UAS",
            instancePrefix: "Attack UAS",
            speed: 34,
            health: 95,
            signature: -12
          },
          bomber: {
            templateName: "Red Bomber UAS",
            instancePrefix: "Bomber",
            speed: 38,
            health: 120,
            signature: -7
          },
          isr: {
            templateName: "Red ISR UAS",
            instancePrefix: "ISR UAS",
            speed: 22,
            health: 85,
            signature: -18
          }
        };
        return defaults[profile] || defaults["recon-strike"];
      }

      addWizardThreatGroup(overrides = {}) {
        const selectedTemplateRef = document.getElementById("wizard-template-select-red-group")?.value;
        const group = this.createWizardThreatGroup({
          ...(selectedTemplateRef ? { templateRef: selectedTemplateRef } : {}),
          ...overrides
        });
        this.state.wizardThreatGroups.push(group);
        this.state.activeWizardThreatGroupId = group.localId;
        this.syncRedGroupToDraft(group.localId);
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.setStatus("Threat group added");
      }

      removeWizardThreatGroup(localId) {
        this.state.wizardThreatGroups = this.state.wizardThreatGroups.filter((group) => group.localId !== localId);
        this.removeGroupManagedDraftInstances(localId, "Red");
        if (this.state.activeWizardThreatGroupId === localId) {
          this.state.activeWizardThreatGroupId = this.state.wizardThreatGroups[0]?.localId || null;
        }
        this.renderWizardThreatGroups();
        this.refreshWizardSummary();
        this.updateScenarioState("Threat group removed");
        this.setStatus("Threat group removed");
      }

      renderWizardThreatGroups() {
        const container = document.getElementById("wizard-threat-group-list");
        const groups = this.state.wizardThreatGroups;
        if (!groups.length) {
          container.innerHTML = "<div class=\"empty-state\">No threat groups yet. Add one to define a Red template, count, and route.</div>";
        }
        const templateOptions = this.getWizardRedTemplateOptions();
        const groupSelect = document.getElementById("wizard-template-select-red-group");
        if (groupSelect) {
          groupSelect.innerHTML = templateOptions.map((option) => (
            "<option value=\"" + escapeHtml(option.value) + "\">" + escapeHtml(option.label) + "</option>"
          )).join("");
        }
        if (!groups.length) {
          return;
        }
        container.innerHTML = groups.map((group, index) => (
          "<div class=\"threat-group-card" + (this.state.activeWizardThreatGroupId === group.localId ? " active" : "") + "\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
            "<div class=\"threat-group-header\">" +
              "<div>" +
                "<h4>Threat Group " + escapeHtml(String(index + 1)) + "</h4>" +
                "<div class=\"threat-group-subtitle\">" + escapeHtml(group.templateName || "Red UAS") + " | " + escapeHtml(templateOptions.find((option) => option.value === group.templateRef)?.label || group.templateRef) + " | " + escapeHtml(group.routePattern) + " pattern | " + escapeHtml(String(group.count)) + " instance(s)</div>" +
              "</div>" +
              "<div class=\"toolbar-row\">" +
                "<button class=\"button-link wizard-select-group-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Select</button>" +
                "<button class=\"button-link wizard-pick-start-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Pick Start</button>" +
                "<button class=\"button-link wizard-pick-end-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Pick End</button>" +
                "<button class=\"button-link wizard-remove-group-btn\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">Remove Group</button>" +
              "</div>" +
            "</div>" +
            "<div class=\"form-grid tight\">" +
              "<div class=\"field-stack\"><label>Template Name</label><input data-group-field=\"templateName\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"text\" value=\"" + escapeHtml(group.templateName) + "\"></div>" +
              "<div class=\"field-stack\"><label>Template</label><select data-group-field=\"templateRef\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                templateOptions.map((option) => (
                  "<option value=\"" + escapeHtml(option.value) + "\"" + (group.templateRef === option.value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>"
                )).join("") +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Instance Prefix</label><input data-group-field=\"instancePrefix\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"text\" value=\"" + escapeHtml(group.instancePrefix) + "\"></div>" +
              "<div class=\"field-stack\"><label>Threat Profile</label><select data-group-field=\"profile\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                "<option value=\"recon-strike\"" + (group.profile === "recon-strike" ? " selected" : "") + ">Recon Strike</option>" +
                "<option value=\"attack\"" + (group.profile === "attack" ? " selected" : "") + ">Attack</option>" +
                "<option value=\"bomber\"" + (group.profile === "bomber" ? " selected" : "") + ">Bomber</option>" +
                "<option value=\"isr\"" + (group.profile === "isr" ? " selected" : "") + ">ISR Decoy</option>" +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Route Pattern</label><select data-group-field=\"routePattern\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\">" +
                "<option value=\"direct\"" + (group.routePattern === "direct" ? " selected" : "") + ">Direct</option>" +
                "<option value=\"staggered\"" + (group.routePattern === "staggered" ? " selected" : "") + ">Staggered Lanes</option>" +
                "<option value=\"fan-in\"" + (group.routePattern === "fan-in" ? " selected" : "") + ">Fan In</option>" +
              "</select></div>" +
              "<div class=\"field-stack\"><label>Count</label><input data-group-field=\"count\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" min=\"1\" max=\"6\" value=\"" + escapeHtml(String(group.count)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Speed (m/s)</label><input data-group-field=\"speed\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.speed)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Health</label><input data-group-field=\"health\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.health)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Signature (dB)</label><input data-group-field=\"signature\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.signature)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start X</label><input data-group-field=\"startX\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Y</label><input data-group-field=\"startY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Z</label><input data-group-field=\"startZ\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startZ)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End X</label><input data-group-field=\"endX\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endX)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Y</label><input data-group-field=\"endY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Z</label><input data-group-field=\"endZ\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endZ)) + "\"></div>" +
              "<div class=\"field-stack\"><label>Start Spacing Y</label><input data-group-field=\"startSpacingY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.startSpacingY)) + "\"></div>" +
              "<div class=\"field-stack\"><label>End Spacing Y</label><input data-group-field=\"endSpacingY\" data-threat-group-id=\"" + escapeHtml(group.localId) + "\" type=\"number\" value=\"" + escapeHtml(String(group.endSpacingY)) + "\"></div>" +
            "</div>" +
          "</div>"
        )).join("");

        container.querySelectorAll("[data-group-field]").forEach((element) => {
          element.addEventListener("input", () => {
            this.updateWizardThreatGroupField(element.dataset.threatGroupId, element.dataset.groupField, element.value, { rerender: false });
          });
          element.addEventListener("change", () => {
            this.updateWizardThreatGroupField(element.dataset.threatGroupId, element.dataset.groupField, element.value, { rerender: true });
          });
        });
        container.querySelectorAll(".wizard-remove-group-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.removeWizardThreatGroup(button.dataset.threatGroupId);
          });
        });
        container.querySelectorAll(".wizard-select-group-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.renderWizardThreatGroups();
            this.setStatus("Threat group selected");
          });
        });
        container.querySelectorAll(".wizard-pick-start-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.state.mapInteraction = { mode: "group-start", threatGroupId: button.dataset.threatGroupId };
            this.renderWizardThreatGroups();
            this.setStatus("Click the map to place threat-group start");
          });
        });
        container.querySelectorAll(".wizard-pick-end-btn").forEach((button) => {
          button.addEventListener("click", () => {
            this.state.activeWizardThreatGroupId = button.dataset.threatGroupId;
            this.state.mapInteraction = { mode: "group-end", threatGroupId: button.dataset.threatGroupId };
            this.renderWizardThreatGroups();
            this.setStatus("Click the map to place threat-group end");
          });
        });
      }

      updateWizardThreatGroupField(localId, field, value, options = {}) {
        const group = this.state.wizardThreatGroups.find((item) => item.localId === localId);
        if (!group) {
          return;
        }
        const rerender = options.rerender !== false;
        const numericFields = new Set(["count", "speed", "health", "signature", "startX", "startY", "startZ", "endX", "endY", "endZ", "startSpacingY", "endSpacingY"]);
        if (field === "profile") {
          group.profile = value;
          const defaults = this.getWizardThreatProfileDefaults(value);
          group.templateName = defaults.templateName;
          group.instancePrefix = defaults.instancePrefix;
          group.speed = defaults.speed;
          group.health = defaults.health;
          group.signature = defaults.signature;
        } else if (numericFields.has(field)) {
          group[field] = Number.isFinite(Number(value)) ? Number(value) : group[field];
          if (field === "count") {
            group.count = Math.max(1, Math.min(6, Math.floor(group.count)));
          }
        } else {
          group[field] = value;
        }
        if (rerender) {
          this.renderWizardThreatGroups();
        }
        this.syncRedGroupToDraft(localId);
        this.refreshWizardSummary();
      }

      buildGroupTemplateId(side, localId) {
        return "BuilderGroupTemplate-" + side + "-" + String(localId || "");
      }

      buildGroupInstancePrefix(side, localId) {
        return "BuilderGroup-" + side + "-" + String(localId || "") + "-";
      }

      removeGroupManagedDraftInstances(localId, side) {
        const prefix = this.buildGroupInstancePrefix(side, localId);
        this.state.currentScenario.instances = (this.state.currentScenario.instances || []).filter((instance) => !String(instance.id || "").startsWith(prefix));
        const templateId = this.buildGroupTemplateId(side, localId);
        this.state.currentScenario.templates = (this.state.currentScenario.templates || []).filter((template) => template.id !== templateId);
      }

      materializeGroupTemplate(side, localId, templateRef, fallbackPreset, mutator) {
        const templateId = this.buildGroupTemplateId(side, localId);
        const template = this.resolveWizardTemplateRef(templateRef, fallbackPreset, { strict: false });
        const normalized = this.kernel.normalizeScenario({
          metadata: { name: "Group Template Materialization" },
          templates: [{ ...(mutator ? mutator(template) : template), id: templateId }],
          instances: []
        }).templates[0];
        const existingIndex = (this.state.currentScenario.templates || []).findIndex((candidate) => candidate.id === templateId);
        if (existingIndex >= 0) {
          this.state.currentScenario.templates[existingIndex] = normalized;
        } else {
          this.state.currentScenario.templates.push(normalized);
        }
        return templateId;
      }

      syncBlueGroupToDraft(localId) {
        const asset = this.state.wizardBlueAssets.find((item) => item.localId === localId);
        if (!asset) {
          return;
        }
        this.removeGroupManagedDraftInstances(localId, "Blue");
        const templateId = this.materializeGroupTemplate("Blue", localId, asset.templateRef, "blue-site", (template) => {
          const nextTemplate = this.kernel.deepClone(template);
          nextTemplate.name = asset.name || nextTemplate.name || "Blue Group";
          nextTemplate.components = nextTemplate.components || {};
          nextTemplate.components.health = nextTemplate.components.health || { maxHealth: 100, assetValuePts: 40, isHQ: false };
          nextTemplate.components.health.isHQ = !!asset.isHQ;
          return nextTemplate;
        });
        const count = Math.max(1, Math.min(8, Math.floor(Number(asset.count || 1))));
        const centerIndex = (count - 1) / 2;
        for (let index = 0; index < count; index += 1) {
          this.state.currentScenario.instances.push({
            id: this.buildGroupInstancePrefix("Blue", localId) + String(index + 1).padStart(2, "0"),
            templateId,
            name: (asset.name || "Blue Group") + " " + (index + 1),
            side: "Blue",
            builderGroupId: localId,
            builderGroupSide: "Blue",
            builderGroupIndex: index,
            roles: ["Asset"],
            networkId: null,
            connectedPowerGridId: null,
            posX: Number(asset.posX || 0) + ((index - centerIndex) * Number(asset.spacingX || 0)),
            posY: Number(asset.posY || 0) + ((index - centerIndex) * Number(asset.spacingY || 0)),
            posZ: Number(asset.posZ || 0),
            headingDeg: 0,
            missionWaypoints: []
          });
        }
        this.updateScenarioState("Updated Blue group in draft");
      }

      syncRedGroupToDraft(localId) {
        const group = this.state.wizardThreatGroups.find((item) => item.localId === localId);
        if (!group) {
          return;
        }
        this.removeGroupManagedDraftInstances(localId, "Red");
        const templateId = this.materializeGroupTemplate("Red", localId, group.templateRef, "red-uas", (template) => {
          const nextTemplate = this.kernel.deepClone(template);
          nextTemplate.name = group.templateName || nextTemplate.name || "Red UAS Group";
          nextTemplate.components = nextTemplate.components || {};
          nextTemplate.components.health = nextTemplate.components.health || { maxHealth: 90, assetValuePts: 8, isHQ: false };
          nextTemplate.components.signature = nextTemplate.components.signature || {};
          nextTemplate.components.movement = nextTemplate.components.movement || { speedMps: 35, stepSec: 1, waypointToleranceM: 10 };
          nextTemplate.components.health.maxHealth = Number(group.health || nextTemplate.components.health.maxHealth || 90);
          nextTemplate.components.signature.radarSignatureDb = Number(group.signature || nextTemplate.components.signature.radarSignatureDb || -14);
          nextTemplate.components.movement.speedMps = Number(group.speed || nextTemplate.components.movement.speedMps || 35);
          nextTemplate.missionProfile = group.profile === "isr"
            ? { type: "Geographic", targetTemplateId: null }
            : (group.profile === "attack"
              ? { type: "SpecificAsset", targetTemplateId: this.getPrimaryDraftBlueTemplateId() }
              : { type: "MaxDamage", targetTemplateId: null });
          return nextTemplate;
        });
        const count = Math.max(1, Math.min(6, Math.floor(Number(group.count || 1))));
        const centerIndex = (count - 1) / 2;
        for (let index = 0; index < count; index += 1) {
          let startYOffset = 0;
          let endYOffset = 0;
          if (group.routePattern === "staggered") {
            startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
            endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0);
          } else if (group.routePattern === "fan-in") {
            startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
            endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0) * 0.2;
          }
          const startPosition = {
            x: Number(group.startX || 0),
            y: Number(group.startY || 0) + startYOffset
          };
          const endPosition = {
            x: Number(group.endX || 0),
            y: Number(group.endY || 0) + endYOffset
          };
          this.state.currentScenario.instances.push({
            id: this.buildGroupInstancePrefix("Red", localId) + String(index + 1).padStart(2, "0"),
            templateId,
            name: (group.instancePrefix || group.templateName || "Threat") + " " + (index + 1),
            side: "Red",
            builderGroupId: localId,
            builderGroupSide: "Red",
            builderGroupIndex: index,
            roles: ["UAS"],
            networkId: null,
            connectedPowerGridId: null,
            posX: startPosition.x,
            posY: startPosition.y,
            posZ: Number(group.startZ || 0),
            headingDeg: this.kernel.normalizeHeadingDeg(this.kernel.angleDeg(startPosition, endPosition)),
            missionWaypoints: [{
              x: endPosition.x,
              y: endPosition.y,
              z: Number(group.endZ || 0)
            }]
          });
        }
        this.updateScenarioState("Updated Red group in draft");
      }

      getPrimaryDraftBlueTemplateId() {
        const blueInstance = (this.state.currentScenario.instances || []).find((instance) => instance.side === "Blue");
        return blueInstance?.templateId || null;
      }

      getWizardInputNumber(id, fallback = 0) {
        const value = Number(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
      }

      resolveWizardTemplateRef(templateRef, fallbackPreset, options = {}) {
        const normalizedRef = String(templateRef || fallbackPreset || "").trim();
        if (normalizedRef.startsWith("template:")) {
          const templateId = normalizedRef.slice("template:".length);
          const match = this.state.currentScenario.templates.find((template) => template.id === templateId);
          if (match) {
            return this.kernel.deepClone(match);
          }
          if (options.strict) {
            throw new Error("Scenario Editor references missing template " + templateId);
          }
        }
        const preset = normalizedRef.startsWith("preset:")
          ? normalizedRef.slice("preset:".length)
          : (fallbackPreset || "asset");
        return this.kernel.deepClone(this.buildTemplatePreset(preset));
      }

      isWizardBuildPending() {
        try {
          return JSON.stringify(this.kernel.normalizeScenario(this.state.currentScenario)) !== JSON.stringify(this.getActiveScenario());
        } catch (error) {
          return false;
        }
      }

      updateWizardBuildReminder() {
        const wizardContainer = document.getElementById("wizard-reminder");
        const runContainer = document.getElementById("run-reminder");
        const needsBuild = this.isWizardBuildPending();
        const reminderHtml = needsBuild
          ? "<div class=\"attention-card\"><strong>The draft scenario differs from the staged active scenario.</strong> Click <strong>Stage Current Scenario</strong> when you want Run Scenario to use the latest draft edits.</div>"
          : "<div class=\"summary-meta\">The current draft matches the staged scenario used by Run Scenario.</div>";
        wizardContainer.innerHTML = reminderHtml;
        runContainer.innerHTML = needsBuild
          ? "<div class=\"attention-card\"><strong>Reminder:</strong> Run Scenario is using the last staged scenario. Stage the current draft in Scenario Editor to run the latest edits.</div>"
          : "";
      }

      buildScenarioFromWizardInputs() {
        const scenarioName = document.getElementById("wizard-scenario-name").value.trim() || "Scenario Editor Draft";
        const description = document.getElementById("wizard-scenario-description").value.trim();
        const baseEnvironment = this.state.currentScenario.environment || {};

        const scenario = {
          metadata: {
            name: scenarioName,
            description,
            notes: this.state.currentScenario.metadata?.notes || "",
            tutorial: this.state.currentScenario.metadata?.tutorial || ""
          },
          config: {
            maxTimeSec: 55,
            trackStaleAfterSec: 4,
            attackRunRangeM: 240,
            projectedPathToleranceM: 50
          },
          environment: {
            baseNoiseDb: Number(baseEnvironment.baseNoiseDb ?? 1.8),
            mapWidthMeters: this.getWizardInputNumber("map-width-input", 1080),
            backgroundImageBase64: baseEnvironment.backgroundImageBase64 || "",
            placeholderGhostTrack: {
              enabled: document.getElementById("wizard-ghost-enabled").checked,
              spawnTimeSec: Number(baseEnvironment.placeholderGhostTrack?.spawnTimeSec ?? 7),
              posX: Number(baseEnvironment.placeholderGhostTrack?.posX ?? 505),
              posY: Number(baseEnvironment.placeholderGhostTrack?.posY ?? 182),
              posZ: Number(baseEnvironment.placeholderGhostTrack?.posZ ?? 110),
              label: "Ghost Track Placeholder"
            },
            placeholderClutterField: {
              enabled: document.getElementById("wizard-clutter-enabled").checked,
              centerX: Number(baseEnvironment.placeholderClutterField?.centerX ?? 410),
              centerY: Number(baseEnvironment.placeholderClutterField?.centerY ?? 430),
              radiusM: Number(baseEnvironment.placeholderClutterField?.radiusM ?? 100),
              label: "Clutter Placeholder"
            }
          },
          terrainObjects: this.kernel.deepClone(this.state.currentScenario.terrainObjects || []),
          networks: [],
          powerGrids: [],
          rosters: [],
          templates: [],
          instances: []
        };

        const templateIds = new Set();
        const instanceIds = new Set();
        const blueAssets = this.state.wizardBlueAssets.length
          ? this.state.wizardBlueAssets
          : [{ name: "Blue Site", templateRef: "preset:blue-site", posX: 670, posY: 315, posZ: 20, isHQ: true }];
        blueAssets.forEach((asset, assetIndex) => {
          const blueTemplate = this.resolveWizardTemplateRef(asset.templateRef, "blue-site", { strict: true });
          blueTemplate.id = this.buildUniqueId("Template-Blue-" + String(assetIndex + 1).padStart(2, "0"), templateIds);
          templateIds.add(blueTemplate.id);
          blueTemplate.name = (asset.name || blueTemplate.name || "Blue Asset") + " Template";
          blueTemplate.components = blueTemplate.components || {};
          blueTemplate.components.health = blueTemplate.components.health || { maxHealth: 100, assetValuePts: 40, isHQ: false };
          blueTemplate.components.health.isHQ = !!asset.isHQ;
          scenario.templates.push(blueTemplate);
          const defaultRoles = this.kernel.ensureArray(blueTemplate.defaultRoles || []);
          const roles = defaultRoles.length ? defaultRoles : ["Asset"];
          const instanceId = this.buildUniqueId("Blue-Asset-" + String(assetIndex + 1).padStart(2, "0"), instanceIds);
          instanceIds.add(instanceId);
          scenario.instances.push({
            id: instanceId,
            templateId: blueTemplate.id,
            name: asset.name || ("Blue Asset " + (assetIndex + 1)),
            side: "Blue",
            roles,
            networkId: null,
            connectedPowerGridId: null,
            posX: Number(asset.posX || 670),
            posY: Number(asset.posY || 315),
            posZ: Number(asset.posZ || 20),
            headingDeg: 0,
            missionWaypoints: []
          });
        });

        const primaryBlueInstance = scenario.instances.find((instance) => {
          const template = scenario.templates.find((item) => item.id === instance.templateId);
          return instance.side === "Blue" && template?.components?.health?.isHQ;
        }) || scenario.instances.find((instance) => instance.side === "Blue") || null;
        const primaryBlueTemplateId = primaryBlueInstance?.templateId || null;

        this.state.wizardThreatGroups.forEach((group, groupIndex) => {
          const redTemplate = this.resolveWizardTemplateRef(group.templateRef, "red-uas", { strict: true });
          redTemplate.name = group.templateName || redTemplate.name || ("Red Group " + (groupIndex + 1));
          redTemplate.components.health.maxHealth = Number(group.health || 90);
          redTemplate.components.signature.radarSignatureDb = Number(group.signature || -14);
          redTemplate.components.movement.speedMps = Number(group.speed || 35);
          redTemplate.missionProfile = group.profile === "isr"
            ? { type: "Geographic", targetTemplateId: null }
            : (group.profile === "attack"
              ? { type: "SpecificAsset", targetTemplateId: primaryBlueTemplateId }
              : { type: "MaxDamage", targetTemplateId: null });
          const templateId = this.buildUniqueId("Template-Red-Group-" + String(groupIndex + 1).padStart(2, "0"), templateIds);
          templateIds.add(templateId);
          scenario.templates.push({
            ...redTemplate,
            id: templateId
          });

          const count = Math.max(1, Math.floor(Number(group.count || 1)));
          const centerIndex = (count - 1) / 2;
          for (let index = 0; index < count; index += 1) {
            let startYOffset = 0;
            let endYOffset = 0;
            if (group.routePattern === "staggered") {
              startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
              endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0);
            } else if (group.routePattern === "fan-in") {
              startYOffset = (index - centerIndex) * Number(group.startSpacingY || 0);
              endYOffset = (index - centerIndex) * Number(group.endSpacingY || 0) * 0.2;
            }
            const startX = Number(group.startX || 90);
            const startY = Number(group.startY || 315) + startYOffset;
            const endX = Number(group.endX || 980);
            const endY = Number(group.endY || 315) + endYOffset;
            const instanceId = this.buildUniqueId("Red-G" + String(groupIndex + 1) + "-" + String(index + 1).padStart(2, "0"), instanceIds);
            instanceIds.add(instanceId);
            scenario.instances.push({
              id: instanceId,
              templateId,
              name: (group.instancePrefix || ("Threat " + (groupIndex + 1))) + " " + (index + 1),
              side: "Red",
              roles: this.kernel.ensureArray(redTemplate.defaultRoles || []).length ? this.kernel.ensureArray(redTemplate.defaultRoles || []) : ["UAS"],
              networkId: null,
              connectedPowerGridId: null,
              posX: startX,
              posY: startY,
              posZ: Number(group.startZ || 120),
              headingDeg: this.kernel.normalizeHeadingDeg(this.kernel.angleDeg({ x: startX, y: startY }, { x: endX, y: endY })),
              missionWaypoints: [
                {
                  x: endX,
                  y: endY,
                  z: Number(group.endZ || 120)
                }
              ]
            });
          }
        });

        const blueRosterItems = scenario.instances
          .filter((instance) => instance.side === "Blue")
          .reduce((accumulator, instance) => {
            const existing = accumulator.find((item) => item.templateId === instance.templateId);
            if (existing) {
              existing.quantity += 1;
            } else {
              accumulator.push({ templateId: instance.templateId, quantity: 1 });
            }
            return accumulator;
          }, []);
        const redRosterItems = scenario.instances
          .filter((instance) => instance.side === "Red")
          .reduce((accumulator, instance) => {
            const existing = accumulator.find((item) => item.templateId === instance.templateId);
            if (existing) {
              existing.quantity += 1;
            } else {
              accumulator.push({ templateId: instance.templateId, quantity: 1 });
            }
            return accumulator;
          }, []);
        scenario.rosters = [
          { id: "Roster-Blue", side: "Blue", items: blueRosterItems },
          { id: "Roster-Red", side: "Red", items: redRosterItems }
        ];

        return this.kernel.normalizeScenario(scenario);
      }

      refreshWizardSummary() {
        const container = document.getElementById("wizard-summary");
        try {
          const scenario = this.state.currentScenario;
          const validation = this.kernel.validateScenario(scenario);
          const blueCount = scenario.instances.filter((instance) => instance.side === "Blue").length;
          const redCount = scenario.instances.filter((instance) => instance.side === "Red").length;
          const cards = [
            { label: "Templates", value: scenario.templates.length },
            { label: "Blue Groups", value: this.state.wizardBlueAssets.length },
            { label: "Threat Groups", value: this.state.wizardThreatGroups.length },
            { label: "Blue / Red", value: blueCount + " / " + redCount },
            { label: "Blockers", value: validation.issues.errors.length },
            { label: "Warnings", value: validation.issues.warnings.length },
            { label: "Notes", value: validation.issues.notes.length }
          ];
          container.innerHTML = cards.map((card) => (
            "<div class=\"summary-card\"><div class=\"label\">" + escapeHtml(card.label) + "</div><div class=\"value\" style=\"margin-top: 8px; font-size: 1.1rem; color: var(--accent-strong);\">" + escapeHtml(String(card.value)) + "</div></div>"
          )).join("");
          if (!this.state.singleRun && document.getElementById("screen-wizard").classList.contains("active")) {
            this.renderScenarioModel(validation.scenario, { preserveSelection: false, targetRenderers: [this.builderRenderer], updateState: false });
          }
          this.updateWizardBuildReminder();
        } catch (error) {
          container.innerHTML = "<div class=\"empty-state\">Scenario editor preview error: " + escapeHtml(String(error && error.message ? error.message : error)) + "</div>";
          this.updateWizardBuildReminder();
        }
      }

      buildScenarioFromWizard() {
        try {
          const scenario = this.buildScenarioFromWizardInputs();
          this.state.currentScenario = scenario;
          this.state.currentScenarioSource = "builder-generated";
          this.state.selectedMonteCarloRowIndex = null;
          this.state.originalScenarioPayloadText = "";
          this.state.scenarioExportSource = "normalized";
          document.getElementById("scenario-export-source").value = "normalized";
          this.state.lastImportSummary = {
            source: "Scenario Editor Pre-Built",
            templateCount: scenario.templates.length,
            instanceCount: scenario.instances.length,
            normalizedChanged: false,
            dirty: true
          };
          this.state.selectedTemplateId = scenario.templates[0]?.id || null;
          this.stopPlayback();
          this.clearResults();
          this.refreshScenarioEditors();
          this.uiManager.showScreen("scenario-editor");
          this.setStatus("Draft scenario replaced from builder state");
        } catch (error) {
          this.setStatus("Scenario editor build failed: " + String(error && error.message ? error.message : error));
        }
      }

      generateScenarioFromWizard() {
        this.buildScenarioFromWizard();
      }

      applyGeneratedScenarioFromWizard() {
        this.stageCurrentScenario();
      }

      openIssueTarget(screenId, targetId) {
        if (screenId === "templates" && targetId) {
          this.selectTemplate(targetId, "templates");
          return;
        }
        if (screenId) {
          this.uiManager.showScreen(screenId);
        }
      }

      getScenarioValidation() {
        return this.kernel.validateScenario(this.state.currentScenario);
      }

      refreshValidationSummary(importErrorMessage = "") {
        const summary = document.getElementById("validation-summary");
        const validation = this.getScenarioValidation();
        const errors = validation.issues.errors.slice();
        const warnings = validation.issues.warnings.slice();
        const notes = validation.issues.notes.slice();
        if (importErrorMessage) {
          errors.unshift({
            severity: "error",
            message: importErrorMessage,
            recommendedAction: "Correct the import payload and try again.",
            targetScreen: "view-reports",
            targetLabel: "Open reports"
          });
        }

        const statusClass = errors.length ? "validation-error" : (warnings.length ? "validation-warning" : "validation-ok");
        const statusText = errors.length ? "Validation blocked" : (warnings.length ? "Validation warnings" : "Validation passed");
        const renderIssues = (issues, emptyText) => issues.length
          ? ("<div class=\"issue-list\">" + issues.map((issue, index) => (
              "<div class=\"issue-card " + escapeHtml(issue.severity) + "\">" +
                "<div class=\"issue-severity\">" + escapeHtml(issue.severity) + "</div>" +
                "<h4>" + escapeHtml(issue.message) + "</h4>" +
                (issue.recommendedAction ? ("<div class=\"issue-meta\">" + escapeHtml(issue.recommendedAction) + "</div>") : "") +
                ((issue.targetScreen || issue.targetId)
                  ? ("<div class=\"actions\"><button class=\"button-link validation-jump-btn\" data-target-screen=\"" + escapeHtml(issue.targetScreen || "") + "\" data-target-id=\"" + escapeHtml(issue.targetId || "") + "\">" + escapeHtml(issue.targetLabel || "Open editor") + "</button></div>")
                  : "") +
              "</div>"
            )).join("") + "</div>")
          : "<div class=\"validation-ok\">" + escapeHtml(emptyText) + "</div>";

        if (summary) {
          summary.innerHTML =
            "<div class=\"validation-box\">" +
              "<h3 class=\"" + statusClass + "\">" + escapeHtml(statusText) + "</h3>" +
              "<div style=\"color: var(--muted);\">Blockers: " + errors.length + " | Warnings: " + warnings.length + " | Notes: " + notes.length + "</div>" +
            "</div>" +
            "<div class=\"validation-box\">" +
              "<h4 class=\"validation-error\">Blockers</h4>" +
              renderIssues(errors, "No blocking errors.") +
            "</div>" +
            "<div class=\"validation-box\">" +
              "<h4 class=\"validation-warning\">Warnings</h4>" +
              renderIssues(warnings, "No heuristic warnings.") +
            "</div>" +
            "<div class=\"validation-box\">" +
              "<h4 class=\"validation-ok\">Scenario Quality Notes</h4>" +
              renderIssues(notes, "No additional notes.") +
            "</div>";

          summary.querySelectorAll(".validation-jump-btn").forEach((button) => {
            button.addEventListener("click", () => {
              this.openIssueTarget(button.dataset.targetScreen || "", button.dataset.targetId || "");
            });
          });
        }

        const statusNode = document.getElementById("status-text");
        if (statusNode) {
          statusNode.classList.remove("status-ok", "status-warning", "status-error");
          statusNode.classList.add(errors.length ? "status-error" : (warnings.length ? "status-warning" : "status-ok"));
        }
        return validation;
      }

      clearResults(options = {}) {
        const clearSelection = options.clearSelection !== false;
        document.getElementById("queue-text").textContent = "0";
        document.getElementById("seed-text").textContent = "-";
        this.state.singleRun = null;
        this.state.monteCarloRows = [];
        this.state.currentFrame = null;
        this.state.currentReport = null;
        this.state.playbackFrames = [];
        this.state.playbackIndex = 0;
        this.state.selectedRunTelemetry = null;
        this.state.selectedMonteCarloRowIndex = null;
        if (clearSelection) {
          this.state.selectedMapEntity = null;
          this.renderer.setSelection(null);
          this.builderRenderer.setSelection(null);
        }
        this.updateRunMetrics(null);
        this.updateLog([]);
        this.updateSingleRunReport(null);
        this.updateMonteCarloReport([]);
        this.renderEventTimeline(null);
        this.renderFailureDrivers();
        this.refreshLiveAnalysisSummary();
        this.setStatus("Ready");
        this.setPlaybackStatus("Idle");
        this.refreshExportPreview();
        this.updateMapSelectionChip();
        this.renderRunReminder();
        this.renderRunSelectedObjectInfo();
      }

      renderScenarioModel(scenario, options = {}) {
        const preserveSelection = options.preserveSelection !== false;
        const targetRenderers = options.targetRenderers || [this.renderer, this.builderRenderer];
        const updateState = options.updateState !== false;
        targetRenderers.forEach((renderer) => {
          if (renderer) {
            renderer.setScenario(scenario);
          }
        });
        const mapWidthInput = document.getElementById("map-width-input");
        if (mapWidthInput) {
          mapWidthInput.value = scenario.environment.mapWidthMeters ?? 1080;
        }
        const frame = {
          timeSec: 0,
          reason: "scenario-preview",
          objects: scenario.instances.map((instance) => ({
            id: instance.id,
            name: instance.name,
            side: instance.side,
            roles: this.kernel.deepClone(instance.roles),
            x: instance.posX,
            y: instance.posY,
            z: instance.posZ,
            sensors: this.kernel.deepClone((scenario.templates.find((template) => template.id === instance.templateId)?.components.sensors) || []),
            effectors: this.kernel.deepClone((scenario.templates.find((template) => template.id === instance.templateId)?.components.effectors) || []),
            currentHeadingDeg: this.kernel.normalizeHeadingDeg(instance.headingDeg ?? 0),
            behaviorState: "Preview",
            destroyed: false,
            status: "Active"
          })),
          tracks: []
        };
        const report = { scenarioName: scenario.metadata.name, targetDestroyed: false };
        if (updateState) {
          this.state.currentFrame = frame;
          this.state.currentReport = report;
        }
        targetRenderers.forEach((renderer) => {
          if (!renderer) {
            return;
          }
          renderer.setSelection(preserveSelection ? this.state.selectedMapEntity : null);
          renderer.draw(frame, report);
        });
      }

      renderScenarioSnapshot() {
        this.syncPlaceholderCards();
        this.renderScenarioModel(this.state.currentScenario, { preserveSelection: true, targetRenderers: [this.builderRenderer], updateState: false });
        this.renderDemoPreview();
      }

      renderActiveScenarioSnapshot() {
        this.renderScenarioModel(this.getActiveScenario(), { preserveSelection: true, targetRenderers: [this.renderer], updateState: true });
      }

      stopPlayback() {
        if (this.state.playbackTimer) {
          window.clearInterval(this.state.playbackTimer);
          this.state.playbackTimer = null;
        }
      }

      updatePlaybackFrame(index, options = {}) {
        const frames = this.state.playbackFrames || [];
        const report = this.state.currentReport;
        if (!frames.length || !report) {
          return;
        }
        const clampedIndex = this.kernel.clamp(Number(index) || 0, 0, frames.length - 1);
        this.state.playbackIndex = clampedIndex;
        this.state.currentFrame = frames[clampedIndex];
        const targetRenderers = options.targetRenderers || [this.renderer, this.debriefRenderer];
        targetRenderers.forEach((renderer) => {
          if (!renderer) {
            return;
          }
          renderer.setSelection(this.state.selectedMapEntity);
          renderer.draw(this.state.currentFrame, report);
        });
        this.renderRunSelectedObjectInfo();
      }

      playFrames(frames, report, options = {}) {
        this.stopPlayback();
        if (!frames || !frames.length) {
          return;
        }
        this.state.currentReport = report;
        this.state.playbackFrames = frames.slice();
        this.state.playbackIndex = this.kernel.clamp(Number(options.startIndex) || 0, 0, this.state.playbackFrames.length - 1);
        const targetRenderers = options.targetRenderers || [this.renderer, this.debriefRenderer];
        this.setPlaybackStatus("Playing");
        this.updatePlaybackFrame(this.state.playbackIndex, { targetRenderers });
        this.state.playbackTimer = window.setInterval(() => {
          const nextIndex = this.state.playbackIndex + 1;
          if (nextIndex >= this.state.playbackFrames.length) {
            this.stopPlayback();
            this.setPlaybackStatus("Complete");
            this.updatePlaybackFrame(this.state.playbackFrames.length - 1, { targetRenderers });
            return;
          }
          this.updatePlaybackFrame(nextIndex, { targetRenderers });
        }, 260);
      }

      pausePlayback() {
        if (!this.state.playbackFrames.length) {
          return;
        }
        this.stopPlayback();
        this.setPlaybackStatus("Paused");
      }

      resumePlayback() {
        if (!this.state.playbackFrames.length || !this.state.currentReport) {
          return;
        }
        this.playFrames(this.state.playbackFrames, this.state.currentReport, {
          startIndex: this.state.playbackIndex,
          targetRenderers: [this.renderer, this.debriefRenderer]
        });
      }

      stepPlayback(delta) {
        if (!this.state.playbackFrames.length) {
          return;
        }
        this.pausePlayback();
        this.updatePlaybackFrame(this.state.playbackIndex + delta, { targetRenderers: [this.renderer, this.debriefRenderer] });
      }

      replayDebrief() {
        if (!this.state.singleRun?.report?.frames?.length) {
          const subtitle = document.getElementById("debrief-iteration-subtitle");
          if (subtitle) {
            subtitle.textContent = "No detailed single-run playback is available yet. Run a single scenario to populate the debrief.";
          }
          return;
        }
        this.setReportTab("single-run");
        this.uiManager.showScreen("view-reports");
        this.playFrames(this.state.singleRun.report.frames, this.state.singleRun.report, { targetRenderers: [this.debriefRenderer] });
      }

      async importScenarioFile(event, target = "both") {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }

        try {
          const text = await file.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (parseError) {
            throw new Error("Malformed JSON: " + parseError.message);
          }

          const validation = this.kernel.validateScenario(parsed);
          const normalized = validation.scenario;
          if (!normalized.metadata.name || normalized.metadata.name === "C-sUAS Tactical Simulator") {
            normalized.metadata.name = file.name.replace(/\.json$/i, "");
          }
          const normalizedChanged = JSON.stringify(parsed) !== JSON.stringify(normalized);
          this.state.currentScenario = normalized;
          if (target !== "draft") {
            this.state.stagedScenario = this.kernel.deepClone(normalized);
            this.state.stagedScenarioSource = "import";
          }
          this.state.originalScenarioPayloadText = text;
          this.state.scenarioExportSource = "normalized";
          document.getElementById("scenario-export-source").value = "normalized";
          this.state.lastImportSummary = {
            source: file.name,
            templateCount: normalized.templates.length,
            instanceCount: normalized.instances.length,
            normalizedChanged,
            dirty: false
          };
          this.state.selectedTemplateId = normalized.templates[0]?.id || null;
          this.state.currentScenarioSource = target === "draft" ? "draft-import" : "import";
          this.state.selectedMonteCarloRowIndex = null;
          this.stopPlayback();
          this.clearResults();
          this.syncWizardDraftFromScenario(normalized);
          this.refreshScenarioEditors();
          this.setStatus(validation.valid
            ? ("Loaded " + (target === "draft" ? "draft " : "") + "scenario " + normalized.metadata.name)
            : ("Loaded " + (target === "draft" ? "draft " : "") + "scenario with validation issues: " + normalized.metadata.name));
        } catch (error) {
          this.setStatus("Scenario load failed");
          const message = String(error && error.message ? error.message : error);
          this.refreshValidationSummary(message);
          this.setExportPreview(message);
        } finally {
          event.target.value = "";
        }
      }

      exportCurrentScenario() {
        this.state.exportTab = "scenario";
        this.refreshExportPreview();
        const payload = document.getElementById("export-preview").value;
        const suffix = this.state.scenarioExportSource === "original" && this.state.originalScenarioPayloadText ? "_original" : "_scenario";
        downloadText(buildSafeFileStem(this.state.currentScenario.metadata.name) + suffix + ".json", payload, "application/json;charset=utf-8");
      }

      async runSingleScenario(options = {}) {
        const activeScenario = this.getActiveScenario();
        const validation = this.kernel.validateScenario(activeScenario);
        if (!validation.valid) {
          this.setStatus("Fix active scenario validation errors before running");
          return;
        }
        this.setBusy(true);
        this.setStatus("Running single scenario");
        this.setPlaybackStatus("Computing");
        this.stopPlayback();

        const result = this.simulationManager.run({
          seed: Math.floor((Date.now() % 2147483647)),
          captureFrames: true,
          scenario: activeScenario
        });

        this.state.singleRun = result;
        this.state.selectedMonteCarloRowIndex = null;
        document.getElementById("queue-text").textContent = String(result.report.eventCount);
        document.getElementById("seed-text").textContent = String(result.report.seed);
        this.updateRunMetrics(result.report);
        this.updateLog(result.report.logs);
        this.updateSingleRunReport(result.report);
        this.renderEventTimeline(result.report);
        this.renderFailureDrivers();
        this.refreshLiveAnalysisSummary();
        this.setReportTab("single-run");
        this.playFrames(result.report.frames, result.report, { targetRenderers: options.targetRenderers || [this.renderer, this.debriefRenderer] });
        this.refreshExportPreview();
        this.uiManager.showScreen(options.targetScreen || "run-scenario");
        this.setStatus("Single scenario complete");
        this.setBusy(false);
      }

      async runMonteCarlo() {
        const activeScenario = this.getActiveScenario();
        const validation = this.kernel.validateScenario(activeScenario);
        if (!validation.valid) {
          this.setStatus("Fix active scenario validation errors before Monte Carlo");
          return;
        }
        const iterations = this.kernel.clamp(Number(document.getElementById("monte-carlo-count").value) || 1, 1, 250);
        const baseSeed = Math.floor((Date.now() % 2147483647));
        this.setBusy(true);
        this.setStatus("Running Monte Carlo");
        this.setPlaybackStatus("Idle");
        document.getElementById("seed-text").textContent = String(baseSeed);

        try {
          this.state.monteCarloRows = await this.runMonteCarloOffThread(iterations, baseSeed, activeScenario);
          this.updateMonteCarloReport(this.state.monteCarloRows);
          this.renderFailureDrivers();
          this.refreshExportPreview();
          this.uiManager.showScreen("view-reports");
          this.setReportTab("monte-carlo");
          this.setStatus("Monte Carlo complete");
        } catch (error) {
          this.setStatus("Monte Carlo failed");
          this.setExportPreview(String(error && error.message ? error.message : error));
        } finally {
          this.setBusy(false);
        }
      }

      runMonteCarloOffThread(iterations, baseSeed, activeScenario) {
        if (typeof Worker === "undefined") {
          return Promise.resolve(this.monteCarloManager.run(iterations, {
            baseSeed,
            scenario: activeScenario,
            onProgress: (completed, total) => {
              this.setStatus("Monte Carlo " + completed + " / " + total);
            }
          }));
        }

        return new Promise((resolve, reject) => {
          const worker = createMonteCarloWorker();
          this.state.monteCarloWorker = worker;

          worker.onmessage = (messageEvent) => {
            const message = messageEvent.data || {};
            if (message.type === "progress") {
              this.setStatus("Monte Carlo " + message.completed + " / " + message.total);
            } else if (message.type === "complete") {
              worker.terminate();
              this.state.monteCarloWorker = null;
              resolve(message.rows || []);
            } else if (message.type === "error") {
              worker.terminate();
              this.state.monteCarloWorker = null;
              reject(new Error(message.message || "Worker error"));
            }
          };

          worker.onerror = (error) => {
            worker.terminate();
            this.state.monteCarloWorker = null;
            reject(error);
          };

          worker.postMessage({
            type: "runMonteCarlo",
            iterations,
            baseSeed,
            scenario: activeScenario
          });
        });
      }

      updateRunMetrics(report) {
        const container = document.getElementById("run-metrics");
        const metrics = report ? [
          { label: "Detected", value: report.detected ? "Yes" : "No" },
          { label: "Ghost Tracks", value: report.ghostTracksGenerated },
          { label: "Classified", value: report.classified ? report.finalClassificationStatus : "No" },
          { label: "Identified", value: report.identified ? report.finalIdentificationStatus : "No" },
          { label: "Intent", value: report.intentAssessed ? report.finalIntentStatus : "No" },
          { label: "Tracks Dropped", value: report.tracksDropped },
          { label: "Shots Fired", value: report.shotsFired },
          { label: "HQ Survived", value: report.hqSurvived ? "Yes" : "No" },
          { label: "Weighted Score", value: report.weightedSurvivalScore },
          { label: "Successful Strikes", value: report.successfulStrikes ?? 0 },
          { label: "Spoof / Cyber", value: (report.spoofEvents ?? 0) + " / " + (report.cyberEvents ?? 0) },
          { label: "Destroyed", value: report.targetDestroyed ? "Yes" : "No" },
          { label: "Kill Time", value: report.killTimeSec ?? "-" }
        ] : [
          { label: "Detected", value: "-" },
          { label: "Classified", value: "-" },
          { label: "Identified", value: "-" },
          { label: "Intent", value: "-" },
          { label: "Tracks Dropped", value: "-" },
          { label: "Shots Fired", value: "-" },
          { label: "HQ Survived", value: "-" },
          { label: "Weighted Score", value: "-" },
          { label: "Successful Strikes", value: "-" },
          { label: "Spoof / Cyber", value: "-" },
          { label: "Destroyed", value: "-" },
          { label: "Kill Time", value: "-" }
        ];

        container.innerHTML = metrics.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
      }

      updateLog(logs) {
        const renderEntries = (entries) => entries.map((entry) => (
          "<div class=\"log-entry\"><span class=\"time\">T+" + Number(entry.timeSec).toFixed(2) + "s</span>" +
          "<span class=\"tag\">" + escapeHtml(entry.type || "event") + "</span> " +
          escapeHtml(entry.message) + "</div>"
        )).join("");
        const allContainer = document.getElementById("event-log");
        const blueContainer = document.getElementById("blue-feed");
        const redContainer = document.getElementById("red-feed");
        if (!logs || !logs.length) {
          const empty = "<div class=\"log-entry\">No events yet.</div>";
          allContainer.innerHTML = empty;
          blueContainer.innerHTML = empty;
          redContainer.innerHTML = empty;
          document.getElementById("blue-feed-count").textContent = "0";
          document.getElementById("red-feed-count").textContent = "0";
          return;
        }
        const blueEntries = logs.filter((entry) => entry.side === "Blue");
        const redEntries = logs.filter((entry) => entry.side === "Red");
        allContainer.innerHTML = renderEntries(logs);
        blueContainer.innerHTML = blueEntries.length ? renderEntries(blueEntries) : "<div class=\"log-entry\">No Blue-side events yet.</div>";
        redContainer.innerHTML = redEntries.length ? renderEntries(redEntries) : "<div class=\"log-entry\">No Red-side events yet.</div>";
        document.getElementById("blue-feed-count").textContent = String(blueEntries.length);
        document.getElementById("red-feed-count").textContent = String(redEntries.length);
        allContainer.scrollTop = 0;
        blueContainer.scrollTop = 0;
        redContainer.scrollTop = 0;
      }

      renderEventTimeline(report) {
        const container = document.getElementById("event-timeline-list");
        if (!report?.logs?.length) {
          container.innerHTML = "<div class=\"timeline-card\">Run a scenario to populate the timeline.</div>";
          return;
        }
        const interestingTypes = new Set(["detection", "track", "classification", "identification", "intent", "sensor", "c2", "effector", "damage", "movement"]);
        const entries = report.logs
          .filter((entry) => interestingTypes.has(entry.type))
          .slice(0, 40);
        container.innerHTML = entries.map((entry) => (
          "<div class=\"timeline-card\"><h4>T+" + Number(entry.timeSec).toFixed(2) + "s</h4>" +
          "<div class=\"summary-meta\">" + escapeHtml(entry.message) + "</div>" +
          "<small>" + escapeHtml((entry.side || "Neutral") + " | " + (entry.type || "event")) + "</small></div>"
        )).join("");
      }

      renderFailureDrivers() {
        const container = document.getElementById("failure-drivers-list");
        const cards = [];
        if (this.state.monteCarloRows.length) {
          const rows = this.state.monteCarloRows;
          const total = rows.length || 1;
          const drivers = [
            { label: "Threat Survived", count: rows.filter((row) => row.Threat_Destroyed !== "Yes").length },
            { label: "No Detection", count: rows.filter((row) => row.Detected !== "Yes").length },
            { label: "No Identification", count: rows.filter((row) => row.Identified !== "Yes").length },
            { label: "No Engagement", count: rows.filter((row) => row.Engaged !== "Yes").length },
            { label: "Track Drop", count: rows.filter((row) => Number(row.Tracks_Dropped || 0) > 0).length },
            { label: "HQ Lost", count: rows.filter((row) => Number(row.HQ_Survived || 0) !== 1).length }
          ]
            .sort((left, right) => right.count - left.count)
            .slice(0, 5);
          drivers.forEach((driver) => {
            cards.push(
              "<div class=\"timeline-card\"><h4>" + escapeHtml(driver.label) + "</h4><div class=\"summary-meta\">" +
              escapeHtml(String(driver.count)) + " of " + escapeHtml(String(total)) + " iterations (" +
              escapeHtml(String(this.kernel.round((driver.count / total) * 100, 1))) + "%)</div></div>"
            );
          });
        } else if (this.state.singleRun?.report) {
          const report = this.state.singleRun.report;
          const singleDrivers = [
            { label: "Detection", ok: report.detected, detail: report.detected ? "Threat detected" : "No detection candidate generated" },
            { label: "Identification", ok: report.identified, detail: report.identified ? report.finalIdentificationStatus : "No hostile ID achieved" },
            { label: "Engagement", ok: report.engaged, detail: report.engaged ? "Effector fired" : "No shot fired" },
            { label: "Outcome", ok: report.targetDestroyed, detail: report.targetDestroyed ? "Threat destroyed" : "Threat survived run window" },
            { label: "HQ", ok: report.hqSurvived, detail: report.hqSurvived ? "HQ survived" : "HQ was lost" }
          ];
          singleDrivers.forEach((driver) => {
            cards.push(
              "<div class=\"timeline-card\"><h4>" + escapeHtml(driver.label) + "</h4><div class=\"summary-meta\">" +
              escapeHtml(driver.detail) + "</div><small>" + escapeHtml(driver.ok ? "Nominal" : "Attention") + "</small></div>"
            );
          });
        } else {
          cards.push("<div class=\"timeline-card\">Run a scenario or Monte Carlo batch to populate failure-driver analysis.</div>");
        }
        container.innerHTML = cards.join("");
      }

      refreshLiveAnalysisSummary() {
        const container = document.getElementById("live-analysis-summary");
        const report = this.state.singleRun?.report || null;
        const summary = report ? [
          { label: "Assessment Snapshots", value: report.assessmentSnapshotCount || 0 },
          { label: "First Detection", value: report.firstDetectionTimeSec ?? "-" },
          { label: "Track Status", value: report.finalTrackStatus || "-" },
          { label: "Intent", value: report.finalIntentStatus || "-" },
          { label: "Spoof / Cyber", value: (report.spoofEvents ?? 0) + " / " + (report.cyberEvents ?? 0) }
        ] : [
          { label: "Assessment Snapshots", value: "-" },
          { label: "First Detection", value: "-" },
          { label: "Track Status", value: "-" },
          { label: "Intent", value: "-" },
          { label: "Spoof / Cyber", value: "-" }
        ];
        container.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
      }

      updateSingleRunReport(report) {
        const summaryContainer = document.getElementById("single-run-summary");
        const detailsContainer = document.getElementById("single-run-details");
        const titleNode = document.getElementById("debrief-iteration-title");
        const subtitleNode = document.getElementById("debrief-iteration-subtitle");
        if (!report) {
          summaryContainer.innerHTML = "";
          detailsContainer.innerHTML = "";
          if (titleNode) {
            titleNode.textContent = "Viewing Iteration: Latest Run";
          }
          if (subtitleNode) {
            subtitleNode.textContent = "Run a single scenario to populate the detailed debrief.";
          }
          return;
        }
        if (titleNode) {
          titleNode.textContent = "Viewing Iteration: Seed " + report.seed;
        }
        if (subtitleNode) {
          subtitleNode.textContent = "Single-run debrief for " + (report.scenarioName || "the active scenario") + ".";
        }

        const summary = [
          { label: "Detection", value: report.detected ? "Successful" : "Missed" },
          { label: "Ghost Tracks", value: report.ghostTracksGenerated },
          { label: "Identification", value: report.identified ? report.finalIdentificationStatus : "None" },
          { label: "Intent", value: report.intentAssessed ? report.finalIntentStatus : "None" },
          { label: "HQ Survived", value: report.hqSurvived ? "Yes" : "No" },
          { label: "Outcome", value: report.targetDestroyed ? "Threat destroyed" : "Threat survived" }
        ];
        summaryContainer.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");

        const details = [
          ["Scenario", report.scenarioName],
          ["Seed", report.seed],
          ["End time", report.endTimeSec + " s"],
          ["First detection time", report.firstDetectionTimeSec ?? "Not detected"],
          ["First detection range", report.firstDetectionRangeM ? report.firstDetectionRangeM + " m" : "Not detected"],
          ["Classification", report.finalClassificationStatus],
          ["Identification", report.finalIdentificationStatus],
          ["Intent", report.finalIntentStatus],
          ["Track status", report.finalTrackStatus],
          ["Ghost tracks generated", report.ghostTracksGenerated],
          ["Tracks dropped", report.tracksDropped],
          ["Kill time", report.killTimeSec ? report.killTimeSec + " s" : "No kill"],
          ["Blue assets survived", report.blueAssetsSurvived],
          ["Blue assets damaged", report.blueAssetsDamaged ?? 0],
          ["Blue assets destroyed", report.blueAssetsDestroyed ?? 0],
          ["Percent survived", this.kernel.round((report.percentSurvived || 0) * 100, 2) + "%"],
          ["Weighted survival score", report.weightedSurvivalScore],
          ["Threats destroyed", report.threatsDestroyed],
          ["Successful strikes", report.successfulStrikes ?? 0],
          ["Spoof events", report.spoofEvents ?? 0],
          ["Cyber events", report.cyberEvents ?? 0],
          ["Shots fired", report.shotsFired],
          ["Event count", report.eventCount],
          ["Assessment snapshots", report.assessmentSnapshotCount || 0],
          ["Final target status", report.finalTargetStatus]
        ];
        detailsContainer.innerHTML = details.map(([label, value]) => (
          "<li><span>" + escapeHtml(String(label)) + "</span><strong>" + escapeHtml(String(value)) + "</strong></li>"
        )).join("");
      }

      updateMonteCarloReport(rows) {
        const tableBody = document.getElementById("monte-carlo-table-body");
        const summaryContainer = document.getElementById("monte-carlo-summary");
        if (!rows.length) {
          tableBody.innerHTML = "";
          summaryContainer.innerHTML = "";
          const subtitleNode = document.getElementById("debrief-iteration-subtitle");
          if (subtitleNode && !this.state.singleRun) {
            subtitleNode.textContent = "Run Monte Carlo or a single scenario to populate the debrief.";
          }
          return;
        }

        tableBody.innerHTML = rows.slice(0, 20).map((row, index) => (
          "<tr class=\"monte-carlo-row\" data-row-index=\"" + escapeHtml(String(index)) + "\">" +
            "<td>" + escapeHtml(String(row.Iteration_ID)) + "</td>" +
            "<td>" + escapeHtml(String(row.Detected)) + "</td>" +
            "<td>" + escapeHtml(String(row.Identified)) + "</td>" +
            "<td>" + escapeHtml(String(row.Intent_Status)) + "</td>" +
            "<td>" + escapeHtml(String(row.Engaged)) + "</td>" +
            "<td>" + escapeHtml(String(row.Threat_Destroyed)) + "</td>" +
            "<td>" + escapeHtml(String(row.Tracks_Dropped)) + "</td>" +
            "<td>" + escapeHtml(String(row.First_Detection_Time_s || "-")) + "</td>" +
            "<td>" + escapeHtml(String(row.Kill_Time_s || "-")) + "</td>" +
            "<td>" + escapeHtml(String(row.Shots_Fired)) + "</td>" +
          "</tr>"
        )).join("");

        const total = rows.length;
        const detectionRate = rows.filter((row) => row.Detected === "Yes").length / total;
        const identificationRate = rows.filter((row) => row.Identified === "Yes").length / total;
        const killRate = rows.filter((row) => row.Threat_Destroyed === "Yes").length / total;
        const dropRate = rows.filter((row) => Number(row.Tracks_Dropped) > 0).length / total;
        const ghostRate = rows.filter((row) => Number(row.Ghost_Tracks_Generated) > 0).length / total;
        const averageShots = rows.reduce((sum, row) => sum + Number(row.Shots_Fired || 0), 0) / total;
        const hqSurvivalRate = rows.filter((row) => Number(row.HQ_Survived) === 1).length / total;
        const averageWeightedSurvival = rows.reduce((sum, row) => sum + Number(row.Weighted_Survival_Score || 0), 0) / total;

        const summary = [
          { label: "Iterations", value: total },
          { label: "Detection rate", value: this.kernel.round(detectionRate * 100, 1) + "%" },
          { label: "Identification rate", value: this.kernel.round(identificationRate * 100, 1) + "%" },
          { label: "Kill rate", value: this.kernel.round(killRate * 100, 1) + "%" },
          { label: "HQ survival", value: this.kernel.round(hqSurvivalRate * 100, 1) + "%" },
          { label: "Avg weighted survival", value: this.kernel.round(averageWeightedSurvival, 3) },
          { label: "Ghost-track rate", value: this.kernel.round(ghostRate * 100, 1) + "%" },
          { label: "Drop rate", value: this.kernel.round(dropRate * 100, 1) + "%" },
          { label: "Avg shots", value: this.kernel.round(averageShots, 2) }
        ];
        summaryContainer.innerHTML = summary.map((metric) => (
          "<div class=\"metric-card\"><span class=\"label\">" + escapeHtml(metric.label) + "</span><span class=\"value\">" + escapeHtml(String(metric.value)) + "</span></div>"
        )).join("");
        tableBody.querySelectorAll(".monte-carlo-row").forEach((rowNode) => {
          rowNode.addEventListener("click", () => {
            this.state.selectedMonteCarloRowIndex = Number(rowNode.dataset.rowIndex || 0);
            this.setReportTab("single-run");
            const selectedRow = rows[this.state.selectedMonteCarloRowIndex];
            const titleNode = document.getElementById("debrief-iteration-title");
            const subtitleNode = document.getElementById("debrief-iteration-subtitle");
            if (titleNode) {
              titleNode.textContent = "Viewing Iteration: Monte Carlo Row " + selectedRow.Iteration_ID;
            }
            if (subtitleNode) {
              subtitleNode.textContent = "Aggregate Monte Carlo rows do not currently store frame-by-frame playback. Use Run Scenario for full debrief playback.";
            }
            this.renderDebriefView();
          });
        });
      }

      refreshExportPreview() {
        const tab = this.state.exportTab || "scenario";
        const pretty = !!this.state.exportPrettyJson;
        const sourceSelect = document.getElementById("scenario-export-source");
        const source = this.state.scenarioExportSource === "original" && this.state.originalScenarioPayloadText ? "original" : "normalized";
        this.state.scenarioExportSource = source;
        sourceSelect.value = source;
        sourceSelect.disabled = !this.state.originalScenarioPayloadText;
        document.querySelectorAll("[data-export-tab]").forEach((button) => {
          button.classList.toggle("active", button.dataset.exportTab === tab);
        });

        let preview = "";
        if (tab === "report") {
          preview = this.state.singleRun
            ? JSON.stringify(this.state.singleRun.report, null, pretty ? 2 : 0)
            : "Run a single scenario to populate the report payload.";
        } else if (tab === "eventLog") {
          preview = this.state.singleRun
            ? JSON.stringify(this.state.singleRun.report.logs, null, pretty ? 2 : 0)
            : "Run a single scenario to populate the event log JSON.";
        } else if (tab === "monteCarlo") {
          preview = this.state.monteCarloRows.length
            ? this.kernel.rowsToCsv(this.state.monteCarloRows)
            : "Run Monte Carlo to populate the aggregate CSV preview.";
        } else {
          if (source === "original" && this.state.originalScenarioPayloadText) {
            try {
              const parsedOriginal = JSON.parse(this.state.originalScenarioPayloadText);
              preview = JSON.stringify(parsedOriginal, null, pretty ? 2 : 0);
            } catch (error) {
              preview = this.state.originalScenarioPayloadText;
            }
          } else {
            preview = JSON.stringify(this.state.currentScenario, null, pretty ? 2 : 0);
          }
        }
        this.setExportPreview(preview);
      }

      setExportPreview(text) {
        document.getElementById("export-preview").value = text;
      }
    }

    window.addEventListener("DOMContentLoaded", () => {
      window.appController = new AppController();
    });
  
