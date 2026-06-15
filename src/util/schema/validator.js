// Extracted from index.html
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
                turnRate_dps: Number(components.movement.turnRate_dps ?? components.movement.turnRateDps ?? 360)
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
        if (scenario.environment.placeholderGhostTrack.enabled) {
          addIssue("note", "Ghost track placeholder is enabled; it is a track-only environment stub.", "Use this for workflow testing, not as a physical object model.", {
            targetScreen: "wizard",
            targetLabel: "Open wizard"
          });
        }
        if (scenario.environment.placeholderClutterField.enabled) {
          addIssue("note", "Clutter placeholder is enabled; it is a visual/logging stub only.", "Keep it on for UI review, but do not treat it as full clutter physics.", {
            targetScreen: "wizard",
            targetLabel: "Open wizard"
          });
        }

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
