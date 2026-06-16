// Extracted from index.html.
// This file currently mixes generic logging with the older environment stub.
// Treat it as a review slice until the environment system is fully re-extracted.
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
          const ghost = world.environment.placeholderGhostTrack;
          if (ghost && ghost.enabled) {
            services.events.schedule({
              time: Number(ghost.spawnTimeSec || 7),
              type: "environment.spawnGhostTrack",
              priority: EVENT_PRIORITIES.track,
              payload: {
                posX: Number(ghost.posX || 500),
                posY: Number(ghost.posY || 180),
                posZ: Number(ghost.posZ || 110),
                label: ghost.label || "Ghost Track Placeholder"
              }
            });
          }

          const clutter = world.environment.placeholderClutterField;
          if (clutter && clutter.enabled) {
            services.logger.record(
              world,
              0,
              "environment",
              (clutter.label || "Clutter Placeholder") + " active in scenario preview",
              {
                centerX: clutter.centerX,
                centerY: clutter.centerY,
                radiusM: clutter.radiusM,
                note: clutter.note || ""
              }
            );
          }
        }

        spawnGhostTrack(event, world, services) {
          const trackId = "Blue-Track-" + world.nextBlueTrackId++;
          world.blueTracks[trackId] = {
            id: trackId,
            realObjectId: null,
            trackType: "Ghost",
            owningSide: "Blue",
            perceivedSide: "Unknown",
            sourceSensorIds: ["Environment-Ghost-Placeholder"],
            detectionConfidence: 0.58,
            classificationStatus: "Unknown Air Object",
            classificationConfidence: 0.22,
            identificationStatus: "Unknown",
            identificationConfidence: 0,
            intentStatus: "Unknown",
            intentConfidence: 0,
            trackQuality: 0.38,
            status: "Active",
            staleAfterSec: world.config.trackStaleAfterSec,
            lastUpdateTimeSec: round(event.time, 2),
            history: [{
              timeSec: round(event.time, 2),
              confidence: 0.58,
              rangeM: null,
              position: {
                x: event.payload.posX,
                y: event.payload.posY,
                z: event.payload.posZ
              }
            }],
            pendingEngagement: false,
            agingToken: 0,
            threatState: {
              attackRunActive: false,
              nonClosingCount: 0,
              lastThreatAssetId: null,
              lastThreatDistanceXYM: null
            },
            position: {
              x: event.payload.posX,
              y: event.payload.posY,
              z: event.payload.posZ
            }
          };

          world.metrics.ghostTracksGenerated += 1;
          services.logger.record(
            world,
            event.time,
            "ghost-track",
            event.payload.label + " spawned as a track-only placeholder",
            {
              trackId,
              posX: event.payload.posX,
              posY: event.payload.posY
            }
          );

          services.captureFrame(world, event.time, "ghost-track");

          const track = world.blueTracks[trackId];
          track.agingToken += 1;
          services.events.scheduleDelay(event.time, track.staleAfterSec, {
            type: "track.age",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId,
              agingToken: track.agingToken
            }
          });
        }
      }
