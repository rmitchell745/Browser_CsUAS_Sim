// Extracted from index.html
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
