// Extracted from index.html.
// v2.4 moves classification closer to track evidence instead of direct target
// role peeking so anomaly/telemetry paths stay decoupled from object truth.
      class ClassificationSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !sensor || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.classification;
          let shouldRefresh = false;
          let reason = "retained";
          if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if (cycle.newSensorContribution) {
            shouldRefresh = true;
            reason = "new-sensor";
          } else if (Math.abs(track.detectionConfidence - (stageState.lastDetectionConfidence ?? track.detectionConfidence)) >= CLASSIFICATION_CONFIDENCE_DELTA) {
            shouldRefresh = true;
            reason = "detection-confidence-shift";
          } else if (Math.abs(track.trackQuality - (stageState.lastTrackQuality ?? track.trackQuality)) >= TRACK_QUALITY_DELTA) {
            shouldRefresh = true;
            reason = "track-quality-shift";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= CLASSIFICATION_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          }

          if (!shouldRefresh) {
            recordAssessmentDecision(track, "classification", "skipped", reason, event.time, cycle.id);
            const skipDelaySec = sensor.identification.canIdentify ? sensor.identification.latencySec : 0;
            services.events.scheduleDelay(event.time, skipDelaySec, {
              type: "identification.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                observerId: event.payload.observerId,
                sensorId: sensor.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: skipDelaySec <= 0 });
            return;
          }

          if (track.trackType === "Ghost") {
            track.classificationStatus = "Unknown Air Object";
            track.classificationConfidence = 0.2;
            world.metrics.classifications += 1;
            recordAssessmentDecision(track, "classification", "refreshed", reason, event.time, cycle.id);
            commitClassificationAssessment(track, event.time);
            services.logger.record(
              world,
              event.time,
              "classification",
              track.id + " remained ghost-like clutter during classification",
              {
                trackId: track.id,
                classification: track.classificationStatus,
                confidence: track.classificationConfidence
              }
            );
            services.events.scheduleDelay(event.time, 0.2, {
              type: "identification.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                observerId: event.payload.observerId,
                sensorId: sensor.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          const confidence = clamp(
            (event.payload.baseConfidence * sensor.classification.accuracyBase)
              + 0.14
              + world.randomization.classificationBias
              + services.rng.nextGaussian(0, 0.035),
            0.05,
            0.99
          );

          if (Number(track.position?.z || 0) > 5 && confidence >= 0.52) {
            track.classificationStatus = "UAS";
          } else if (confidence >= 0.52) {
            track.classificationStatus = "Ground Asset";
          } else {
            track.classificationStatus = "Unknown Object";
          }
          track.classificationConfidence = round(confidence, 2);
          world.metrics.classifications += 1;
          recordAssessmentDecision(track, "classification", "refreshed", reason, event.time, cycle.id);
          commitClassificationAssessment(track, event.time);

          services.logger.record(
            world,
            event.time,
            "classification",
            track.id + " classified as " + track.classificationStatus,
            {
              trackId: track.id,
              classification: track.classificationStatus,
              confidence: track.classificationConfidence
            }
          );

          services.captureFrame(world, event.time, "classification");

          const delaySec = sensor.identification.canIdentify ? sensor.identification.latencySec : 0;
          services.events.scheduleDelay(event.time, delaySec, {
            type: "identification.process",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              observerId: event.payload.observerId,
              sensorId: sensor.id,
              cycleId: cycle.id
            }
          }, { enforceMinimumDelay: delaySec <= 0 });
        }
      }

      class IdentificationSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const sensor = getSensor(world, event.payload.observerId, event.payload.sensorId);
          const observer = getObject(world, event.payload.observerId);
          const target = track ? getObject(world, track.realObjectId) : null;
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !sensor || !observer || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.identification;
          let shouldRefresh = false;
          let reason = "retained";
          if (track.classificationStatus === "Unknown Air Object" || track.classificationStatus === "Unknown Object") {
            reason = "classification-unknown";
          } else if (track.classificationConfidence < 0.45) {
            reason = "classification-weak";
          } else if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if (cycle.classification.action === "refreshed") {
            shouldRefresh = true;
            reason = "classification-updated";
          } else if (cycle.newSensorContribution) {
            shouldRefresh = true;
            reason = "new-sensor";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= IDENTIFICATION_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          } else if (
            (track.identificationStatus === "Unknown" || track.identificationStatus === "Suspect")
            && (
              Math.abs(track.trackQuality - (stageState.lastTrackQuality ?? track.trackQuality)) >= TRACK_QUALITY_DELTA
              || Math.abs(track.classificationConfidence - (stageState.lastClassificationConfidence ?? track.classificationConfidence)) >= IDENTIFICATION_CONFIDENCE_DELTA
            )
          ) {
            shouldRefresh = true;
            reason = track.identificationStatus === "Unknown"
              ? "unknown-confidence-shift"
              : "suspect-confidence-shift";
          }

          if (!shouldRefresh) {
            recordAssessmentDecision(track, "identification", "skipped", reason, event.time, cycle.id);
            services.events.scheduleDelay(event.time, 0.2, {
              type: "intent.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          if (track.trackType === "Ghost") {
            track.identificationStatus = "Unknown";
            track.identificationConfidence = 0.08;
            world.metrics.identifications += 1;
            recordAssessmentDecision(track, "identification", "refreshed", reason, event.time, cycle.id);
            commitIdentificationAssessment(track, event.time);
            services.logger.record(
              world,
              event.time,
              "identification",
              track.id + " remained unidentified because it is a ghost placeholder",
              {
                trackId: track.id,
                identification: track.identificationStatus,
                confidence: track.identificationConfidence
              }
            );
            services.events.scheduleDelay(event.time, 0.2, {
              type: "intent.process",
              priority: EVENT_PRIORITIES.track,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            }, { enforceMinimumDelay: true });
            return;
          }

          if (!target || target.runtime.destroyed) {
            return;
          }

          const confidence = clamp(
            (track.classificationConfidence * sensor.identification.accuracyBase)
              + 0.12
              + world.randomization.identificationBias
              + services.rng.nextGaussian(0, 0.04),
            0.05,
            0.99
          );

          let identificationStatus = "Unknown";
          if (target.side === observer.side && confidence >= 0.52) {
            identificationStatus = "Friendly";
          } else if (["UAS", "Ground Asset"].includes(track.classificationStatus) && confidence >= 0.58) {
            identificationStatus = "Hostile";
          } else if (["UAS", "Ground Asset"].includes(track.classificationStatus) && confidence >= 0.42) {
            identificationStatus = "Suspect";
          }

          track.identificationStatus = identificationStatus;
          track.identificationConfidence = round(confidence, 2);
          track.perceivedSide = identificationStatus;
          world.metrics.identifications += 1;
          recordAssessmentDecision(track, "identification", "refreshed", reason, event.time, cycle.id);
          commitIdentificationAssessment(track, event.time);

          services.logger.record(
            world,
            event.time,
            "identification",
            track.id + " identified as " + identificationStatus,
            {
              trackId: track.id,
              identification: identificationStatus,
              confidence: track.identificationConfidence
            }
          );

          services.captureFrame(world, event.time, "identification");

          services.events.scheduleDelay(event.time, 0.2, {
            type: "intent.process",
            priority: EVENT_PRIORITIES.track,
            payload: {
              trackId: track.id,
              cycleId: cycle.id
            }
          }, { enforceMinimumDelay: true });
        }
      }

      class IntentSystem {
        process(event, world, services) {
          const track = getTrack(world, event.payload.trackId);
          const target = track ? getObject(world, track.realObjectId) : null;
          const assessmentState = track ? getTrackAssessmentState(track) : null;
          if (!track || track.status !== "Active" || !assessmentState) {
            return;
          }

          const cycle = getAssessmentCycle(track, event.payload.cycleId);
          if (!cycle) {
            return;
          }

          const stageState = assessmentState.intent;

          if (track.trackType === "Ghost") {
            track.intentStatus = "Unknown";
            track.intentConfidence = 0.1;
            world.metrics.intentsAssessed += 1;
            recordAssessmentDecision(track, "intent", "refreshed", "ghost-track", event.time, cycle.id);
            services.logger.record(
              world,
              event.time,
              "intent",
              track.id + " kept unknown intent because it is a ghost placeholder",
              {
                trackId: track.id,
                intent: track.intentStatus,
                confidence: track.intentConfidence
              }
            );
            services.captureFrame(world, event.time, "intent");
            services.events.schedule({
              time: event.time,
              type: "c2.decide",
              priority: EVENT_PRIORITIES.c2,
              payload: {
                trackId: track.id,
                cycleId: cycle.id
              }
            });
            return;
          }

          if (!target || target.runtime.destroyed) {
            return;
          }

          const previewAssessment = updateTrackThreatAssessment(world, track, target, {
            commitState: false,
            updateTrackFields: false
          });
          track.currentSpeedMps = round(previewAssessment.speedMps, 2);
          track.currentHeadingUnitXY = previewAssessment.headingUnitXY
            ? {
              x: round(previewAssessment.headingUnitXY.x, 4),
              y: round(previewAssessment.headingUnitXY.y, 4),
              z: 0
            }
            : null;
          track.currentProjectedAssetId = previewAssessment.currentProjectedAssetId || null;
          track.currentProjectedDistanceXYM = Number.isFinite(previewAssessment.currentProjectedDistanceXYM)
            ? round(previewAssessment.currentProjectedDistanceXYM, 2)
            : null;
          const speedDelta = Math.abs(previewAssessment.speedMps - (stageState.lastSpeedMps ?? previewAssessment.speedMps));
          const headingDeltaDeg = headingChangeDegrees(stageState.lastHeadingUnitXY, previewAssessment.headingUnitXY);

          let shouldRefresh = false;
          let reason = "retained";
          if (!Number.isFinite(stageState.lastRefreshTimeSec)) {
            shouldRefresh = true;
            reason = "initial";
          } else if ((event.time - stageState.lastRefreshTimeSec) >= INTENT_STALE_SEC) {
            shouldRefresh = true;
            reason = "stale";
          } else if ((stageState.lastProjectedAssetId || null) !== (previewAssessment.effectiveThreatAssetId || null)) {
            shouldRefresh = true;
            reason = "projected-asset-change";
          } else if (stageState.lastAttackRunActive !== previewAssessment.attackRunActive) {
            shouldRefresh = true;
            reason = "attack-run-change";
          } else if ((stageState.lastNonClosingCount ?? 0) !== (previewAssessment.nonClosingCount ?? 0)) {
            shouldRefresh = true;
            reason = "hysteresis-change";
          } else if (speedDelta >= INTENT_SPEED_DELTA_MPS) {
            shouldRefresh = true;
            reason = "speed-change";
          } else if (headingDeltaDeg >= INTENT_HEADING_DELTA_DEG) {
            shouldRefresh = true;
            reason = "heading-change";
          }

          if (shouldRefresh) {
            let intentStatus = "Unknown";
            let confidence = clamp(0.42 + world.randomization.intentBias + services.rng.nextGaussian(0, 0.03), 0.1, 0.99);
            const threatAssessment = updateTrackThreatAssessment(world, track, target);

            intentStatus = "Transit";
            if (track.classificationStatus !== "UAS") {
              intentStatus = "Unknown";
            } else if (threatAssessment.attackRunActive) {
              intentStatus = "Attack Run";
              confidence += 0.18;
            } else if (threatAssessment.speedMps < THREAT_SPEED_THRESHOLD_MPS) {
              intentStatus = "Loiter";
              confidence += 0.12;
            }

            track.intentStatus = intentStatus;
            track.intentConfidence = round(clamp(confidence, 0.05, 0.99), 2);
            world.metrics.intentsAssessed += 1;
            recordAssessmentDecision(track, "intent", "refreshed", reason, event.time, cycle.id);
            commitIntentAssessment(track, threatAssessment, event.time);

            services.logger.record(
              world,
              event.time,
              "intent",
              track.id + " assessed intent " + intentStatus,
              {
                trackId: track.id,
                intent: intentStatus,
                confidence: track.intentConfidence,
                projectedTargetId: track.projectedTargetId || null,
                currentProjectedAssetId: track.currentProjectedAssetId || null,
                currentSpeedMps: track.currentSpeedMps ?? null,
                threatNonClosingCount: track.threatNonClosingCount ?? 0,
                threatReason: track.threatReason || "none",
                assessmentReason: reason
              }
            );

            services.captureFrame(world, event.time, "intent");
          } else {
            recordAssessmentDecision(track, "intent", "skipped", reason, event.time, cycle.id);
          }

          services.events.schedule({
            time: event.time,
            type: "c2.decide",
            priority: EVENT_PRIORITIES.c2,
            payload: {
              trackId: track.id,
              cycleId: cycle.id
            }
          });
        }
      }
