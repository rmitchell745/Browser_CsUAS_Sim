// Extracted from index.html
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
              case "environment.spawnGhostTrack":
                this.environmentSystem.spawnGhostTrack(event, runtime, services);
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
              object.runtime.currentSpeedMps = 0;
              object.runtime.currentHeadingDeg = firstWaypoint
                ? round(angleDeg(object.runtime.position, firstWaypoint), 2)
                : 0;
            } else {
              object.runtime.currentSpeedMps = null;
              object.runtime.currentHeadingDeg = null;
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
            environment: deepClone(scenario.environment),
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

