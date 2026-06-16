// Extracted from index.html.
// Movement is where v2.4 now ties together kinematics, lost-link behavior,
// terrain interaction, and interceptor pursuit/timeout lifecycle.
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

          // Pure pursuit now steers toward the current aimpoint, but turn-rate and
          // acceleration limits decide whether the mover can actually make the corner.
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
