// Extracted from index.html.
// Mutable world helpers stay centralized here so systems do not duplicate
// assignment, damage, or transient-effect cleanup rules.
      function syncFpvSensorHeading(object, headingDeg) {
        (object?.components?.sensors || []).forEach((sensor) => {
          if (String(sensor.type || "").toUpperCase() === "FPV") {
            sensor.headingDeg = round(headingDeg, 2);
          }
        });
      }

      function clearEffectorAssignment(object, effectorId, world) {
        // Releasing an effector also clears the track's pending-engagement bit,
        // allowing later C2 cycles to reconsider it.
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
        // Centralize damage so kill bookkeeping, frame capture, and blast fan-out
        // all happen from one path.
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
        // Expiration is a loggable state transition, not just silent cleanup.
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
