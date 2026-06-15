// Extracted from index.html
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

          const rangeM = distance3D(shooter.runtime.position, target.runtime.position);
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
              : (Number.isFinite(track?.headingDeg) ? Number(track.headingDeg) : angleDeg(shooter.runtime.position, target.runtime.position));
            const targetHeadingRad = targetHeadingDeg * (Math.PI / 180);
            let projectedTargetPosition = deepClone(target.runtime.position);
            let leadRangeM = distance3D(shooter.runtime.position, projectedTargetPosition);
            let timeToImpactSec = Math.max(0.05, leadRangeM / projectileSpeedMps);
            for (let iteration = 0; iteration < 2; iteration += 1) {
              projectedTargetPosition = {
                x: Number(target.runtime.position.x || 0) + (Math.cos(targetHeadingRad) * targetSpeedMps * timeToImpactSec),
                y: Number(target.runtime.position.y || 0) + (Math.sin(targetHeadingRad) * targetSpeedMps * timeToImpactSec),
                z: Number(target.runtime.position.z || 0)
              };
              leadRangeM = distance3D(shooter.runtime.position, projectedTargetPosition);
              timeToImpactSec = Math.max(0.05, leadRangeM / projectileSpeedMps);
            }
            const ballisticRangeFactor = effector.maxRangeM > 0
              ? clamp(0.55 + (0.45 * (1 - Math.pow((leadRangeM / effector.maxRangeM), 2))), 0.55, 1)
              : 0;
            const effectivePk = clamp(
              (Number(effector.basePk || 0.7) + world.randomization.pkBias) * ballisticRangeFactor * environmentFactor * targetModifier,
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
                flightTimeSec: round(timeToImpactSec, 2)
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
