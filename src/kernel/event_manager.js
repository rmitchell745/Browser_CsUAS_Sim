// Extracted from index.html.
// This file remains a review-oriented kernel snapshot while `index.html` is
// still the authoritative runnable build. Keep behavioral notes here aligned
// with the live shell so later modular wiring does not reintroduce stale logic.
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
        const normalized = Number(heading || 0) % 360;
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
        scenario.config = scenario.config || {};
        scenario.config.maxTimeSec = Number(scenario.config.maxTimeSec ?? 45);
        scenario.config.trackStaleAfterSec = Number(scenario.config.trackStaleAfterSec ?? 4);
        scenario.config.attackRunRangeM = Number(scenario.config.attackRunRangeM ?? 240);
        scenario.config.projectedPathToleranceM = Number(scenario.config.projectedPathToleranceM ?? 50);
        scenario.environment = scenario.environment || {};
        scenario.environment.baseNoiseDb = Number(scenario.environment.baseNoiseDb ?? 1.8);
        scenario.environment.backgroundImageBase64 = scenario.environment.backgroundImageBase64 || "";
        scenario.environment.mapWidthMeters = Number(scenario.environment.mapWidthMeters ?? 1080);
        // Dynamic environment defaults stay explicit even while the UI still
        // exposes the older placeholder toggles for debugging.
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
                maxEnduranceSec: Number(
                  components.movement.maxEnduranceSec
                  ?? components.movement.maxEndurance_sec
                  ?? Number.POSITIVE_INFINITY
                )
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
          addIssue("error", "At least one instance is required.", "Use the Scenario Wizard or raw JSON import to add Blue and Red instances.", { targetScreen: "wizard" });
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
        return getActiveTerrainObjects(world)
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
          // Preserve the older frame property name for renderer compatibility
          // while sourcing the data from live clutter objects in v2.4.
          clutterPlaceholders: ensureArray(world.environment?.activeClutter).map((clutter) => ({
            centerX: clutter.centerX,
            centerY: clutter.centerY,
            radiusM: clutter.radiusM,
            label: clutter.label
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
