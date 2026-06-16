// Extracted from index.html.
// v2.4 threat ranking is track-centric: TEWA uses track geometry and kinematic
// estimates rather than reading target truth positions where avoidable.
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
