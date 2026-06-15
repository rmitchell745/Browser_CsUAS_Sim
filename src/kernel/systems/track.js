// Extracted from index.html
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
          const target = getObject(world, event.payload.targetId);
          const observer = getObject(world, event.payload.observerId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          if (!target || !observer || !sensor || target.runtime.destroyed) {
            return;
          }
          clearExpiredRuntimeEffects(world, target, event.time, services);

          const trackCollection = observer.side === "Red" ? world.redTracks : world.blueTracks;
          let track = Object.values(trackCollection).find((candidate) =>
            candidate.realObjectId === target.id
            && candidate.owningSide === observer.side
            && candidate.status === "Active"
          );

          if (!track) {
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
          if (track.history.length > 0) {
            const lastKnownPosition = track.position || track.history[track.history.length - 1]?.position || target.runtime.position;
            const movedDistanceM = distance3D(lastKnownPosition, target.runtime.position);
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
          const observedPosition = deepClone(event.payload.observedPosition || target.runtime.position);
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
