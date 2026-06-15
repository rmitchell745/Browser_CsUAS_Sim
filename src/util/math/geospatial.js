// Extracted from index.html
      function getActiveTerrainObjects(world) {
        return ensureArray(world.scenario?.terrainObjects);
      }

      function pointInPolygon(point, polygon) {
        if (!polygon || polygon.length < 3) {
          return false;
        }
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
          const xi = polygon[i].x;
          const yi = polygon[i].y;
          const xj = polygon[j].x;
          const yj = polygon[j].y;
          const intersects = ((yi > point.y) !== (yj > point.y))
            && (point.x < (((xj - xi) * (point.y - yi)) / Math.max(1e-6, (yj - yi))) + xi);
          if (intersects) {
            inside = !inside;
          }
        }
        return inside;
      }

      function orientation2D(a, b, c) {
        return ((b.y - a.y) * (c.x - b.x)) - ((b.x - a.x) * (c.y - b.y));
      }

      function onSegment2D(a, b, c) {
        return b.x <= Math.max(a.x, c.x) + 1e-6
          && b.x + 1e-6 >= Math.min(a.x, c.x)
          && b.y <= Math.max(a.y, c.y) + 1e-6
          && b.y + 1e-6 >= Math.min(a.y, c.y);
      }

      function segmentsIntersect2D(p1, q1, p2, q2) {
        const o1 = orientation2D(p1, q1, p2);
        const o2 = orientation2D(p1, q1, q2);
        const o3 = orientation2D(p2, q2, p1);
        const o4 = orientation2D(p2, q2, q1);
        if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
          return true;
        }
        if (Math.abs(o1) <= 1e-6 && onSegment2D(p1, p2, q1)) {
          return true;
        }
        if (Math.abs(o2) <= 1e-6 && onSegment2D(p1, q2, q1)) {
          return true;
        }
        if (Math.abs(o3) <= 1e-6 && onSegment2D(p2, p1, q2)) {
          return true;
        }
        if (Math.abs(o4) <= 1e-6 && onSegment2D(p2, q1, q2)) {
          return true;
        }
        return false;
      }

      function segmentIntersectsPolygon2D(start, end, polygon) {
        if (!polygon || polygon.length < 3) {
          return false;
        }
        if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon)) {
          return true;
        }
        for (let index = 0; index < polygon.length; index += 1) {
          const current = polygon[index];
          const next = polygon[(index + 1) % polygon.length];
          if (segmentsIntersect2D(start, end, current, next)) {
            return true;
          }
        }
        return false;
      }

      function getTerrainCentroid(terrain) {
        if (!terrain?.areaPolygon || terrain.areaPolygon.length < 3) {
          return null;
        }
        const centroid = terrain.areaPolygon.reduce((accumulator, point) => ({
          x: accumulator.x + Number(point.x || 0),
          y: accumulator.y + Number(point.y || 0)
        }), { x: 0, y: 0 });
        return {
          x: centroid.x / terrain.areaPolygon.length,
          y: centroid.y / terrain.areaPolygon.length
        };
      }

      function getTerrainIntersection(world, start, end, filterFn = null) {
        const terrainObjects = getActiveTerrainObjects(world);
        return terrainObjects.find((terrain) => {
          if (typeof filterFn === "function" && !filterFn(terrain)) {
            return false;
          }
          const terrainCenter = getTerrainCentroid(terrain);
          if (!terrainCenter) {
            return false;
          }
          const total2DDistance = Math.max(distance2D(start, end), 1e-6);
          const distanceToObstacle = distance2D(start, terrainCenter);
          const losZAtObstacle = Number(start.z || 0)
            + ((Number(end.z || 0) - Number(start.z || 0)) * (distanceToObstacle / total2DDistance));
          if (!(losZAtObstacle < Number(terrain.heightZ || 0))) {
            return false;
          }
          return segmentIntersectsPolygon2D(start, end, terrain.areaPolygon);
        }) || null;
      }

      function getTerrainNoisePenalty(world, start, end) {
        return getActiveTerrainObjects(world)
          .filter((terrain) => terrain.interferenceType === "Noise")
          .filter((terrain) => {
            const terrainCenter = getTerrainCentroid(terrain);
            if (!terrainCenter) {
              return false;
            }
            const total2DDistance = Math.max(distance2D(start, end), 1e-6);
            const distanceToObstacle = distance2D(start, terrainCenter);
            const losZAtObstacle = Number(start.z || 0)
              + ((Number(end.z || 0) - Number(start.z || 0)) * (distanceToObstacle / total2DDistance));
            return losZAtObstacle < Number(terrain.heightZ || 0) && segmentIntersectsPolygon2D(start, end, terrain.areaPolygon);
          })
          .reduce((sum, terrain) => sum + (Number(terrain.clutterPenaltyDb || 0) * 0.55), 0);
      }

      function createAssessmentStageState() {
        return {
          lastRefreshTimeSec: null,
          lastDecisionTimeSec: null,
          lastReason: "never",
          refreshCount: 0,
          skipCount: 0
        };
      }

      function createTrackAssessmentState() {
        return {
          nextCycleId: 0,
          currentCycleId: null,
          cycles: {},
          classification: {
            ...createAssessmentStageState(),
            lastDetectionConfidence: null,
            lastTrackQuality: null,
            lastSourceSensorCount: 0,
            lastStatus: "Unknown Air Object"
          },
          identification: {
            ...createAssessmentStageState(),
            lastTrackQuality: null,
            lastSourceSensorCount: 0,
            lastStatus: "Unknown",
            lastClassificationStatus: "Unknown Air Object",
            lastClassificationConfidence: 0
          },
          intent: {
            ...createAssessmentStageState(),
            lastSpeedMps: null,
            lastHeadingUnitXY: null,
            lastProjectedAssetId: null,
            lastProjectedDistanceXYM: null,
            lastAttackRunActive: false,
            lastThreatReason: "none",
            lastNonClosingCount: 0
          }
        };
      }

      function getTrackAssessmentState(track) {
        if (!track.assessmentState) {
          track.assessmentState = createTrackAssessmentState();
        }
        return track.assessmentState;
      }

      function startAssessmentCycle(track, timeSec, context = {}) {
        const assessmentState = getTrackAssessmentState(track);
        const cycleId = assessmentState.nextCycleId + 1;
        assessmentState.nextCycleId = cycleId;
        assessmentState.currentCycleId = cycleId;
        assessmentState.cycles[cycleId] = {
          id: cycleId,
          timeSec: round(timeSec, 2),
          observerId: context.observerId || null,
          sensorId: context.sensorId || null,
          sourceSensorCount: Number(context.sourceSensorCount || 0),
          newSensorContribution: !!context.newSensorContribution,
          classification: { action: "pending", reason: "pending" },
          identification: { action: "pending", reason: "pending" },
          intent: { action: "pending", reason: "pending" }
        };
        return assessmentState.cycles[cycleId];
      }

      function getAssessmentCycle(track, cycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const resolvedCycleId = cycleId == null ? assessmentState.currentCycleId : cycleId;
        return Number.isFinite(resolvedCycleId) ? (assessmentState.cycles[resolvedCycleId] || null) : null;
      }

      function pruneAssessmentCycles(track, keepCycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const retainedIds = Object.keys(assessmentState.cycles)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .sort((left, right) => left - right);
        while (retainedIds.length > 6) {
          const oldestId = retainedIds.shift();
          if (oldestId === assessmentState.currentCycleId || oldestId === keepCycleId) {
            retainedIds.push(oldestId);
            retainedIds.sort((left, right) => left - right);
            break;
          }
          delete assessmentState.cycles[oldestId];
        }
      }

      function recordAssessmentDecision(track, stageName, action, reason, timeSec, cycleId = null) {
        const assessmentState = getTrackAssessmentState(track);
        const stageState = assessmentState[stageName];
        stageState.lastDecisionTimeSec = round(timeSec, 2);
        stageState.lastReason = reason;
        if (action === "refreshed") {
          stageState.refreshCount += 1;
        } else {
          stageState.skipCount += 1;
        }

        const cycle = getAssessmentCycle(track, cycleId);
        if (cycle) {
          cycle[stageName] = { action, reason };
        }
      }

      function commitClassificationAssessment(track, timeSec) {
        const stageState = getTrackAssessmentState(track).classification;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastDetectionConfidence = track.detectionConfidence;
        stageState.lastTrackQuality = track.trackQuality;
        stageState.lastSourceSensorCount = track.sourceSensorIds.length;
        stageState.lastStatus = track.classificationStatus;
      }

      function commitIdentificationAssessment(track, timeSec) {
        const stageState = getTrackAssessmentState(track).identification;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastTrackQuality = track.trackQuality;
        stageState.lastSourceSensorCount = track.sourceSensorIds.length;
        stageState.lastStatus = track.identificationStatus;
        stageState.lastClassificationStatus = track.classificationStatus;
        stageState.lastClassificationConfidence = track.classificationConfidence;
      }

      function commitIntentAssessment(track, assessmentResult, timeSec) {
        const stageState = getTrackAssessmentState(track).intent;
        stageState.lastRefreshTimeSec = round(timeSec, 2);
        stageState.lastSpeedMps = round(assessmentResult.speedMps, 2);
        stageState.lastHeadingUnitXY = assessmentResult.headingUnitXY
          ? {
            x: round(assessmentResult.headingUnitXY.x, 4),
            y: round(assessmentResult.headingUnitXY.y, 4),
            z: 0
          }
          : null;
        stageState.lastProjectedAssetId = assessmentResult.effectiveThreatAssetId || null;
        stageState.lastProjectedDistanceXYM = Number.isFinite(assessmentResult.effectiveThreatDistanceXYM)
          ? round(assessmentResult.effectiveThreatDistanceXYM, 2)
          : null;
        stageState.lastAttackRunActive = !!assessmentResult.attackRunActive;
        stageState.lastThreatReason = assessmentResult.threatReason || "none";
        stageState.lastNonClosingCount = assessmentResult.nonClosingCount ?? 0;
      }

      function headingChangeDegrees(previousHeading, currentHeading) {
        if (!previousHeading && !currentHeading) {
          return 0;
        }
        if (!previousHeading || !currentHeading) {
          return 180;
        }
        const cosine = clamp(dotProduct2D(previousHeading, currentHeading), -1, 1);
        return Math.acos(cosine) * (180 / Math.PI);
      }

      function recordAssessmentSnapshot(world, track, timeSec, cycleId = null) {
        const cycle = getAssessmentCycle(track, cycleId);
        const assessmentState = getTrackAssessmentState(track);
        world.assessmentSnapshots.push({
          timeSec: round(timeSec, 2),
          trackId: track.id,
          cycleId: cycle ? cycle.id : null,
          sourceSensorCount: track.sourceSensorIds.length,
          sourceSensorIds: deepClone(track.sourceSensorIds),
          classificationStatus: track.classificationStatus,
          identificationStatus: track.identificationStatus,
          intentStatus: track.intentStatus,
          projectedTargetId: track.projectedTargetId || null,
          currentProjectedAssetId: track.currentProjectedAssetId || null,
          currentSpeedMps: track.currentSpeedMps ?? null,
          threatScore: track.threatScore ?? null,
          threatNonClosingCount: track.threatNonClosingCount ?? 0,
          threatReason: track.threatReason || "none",
          stages: {
            classification: deepClone(cycle?.classification || { action: "unknown", reason: "no-cycle" }),
            identification: deepClone(cycle?.identification || { action: "unknown", reason: "no-cycle" }),
            intent: deepClone(cycle?.intent || { action: "unknown", reason: "no-cycle" })
          },
          stageCounts: {
            classification: {
              refreshes: assessmentState.classification.refreshCount,
              skips: assessmentState.classification.skipCount
            },
            identification: {
              refreshes: assessmentState.identification.refreshCount,
              skips: assessmentState.identification.skipCount
            },
            intent: {
              refreshes: assessmentState.intent.refreshCount,
              skips: assessmentState.intent.skipCount
            }
          }
        });
        pruneAssessmentCycles(track, cycle ? cycle.id : null);
      }

      function getVelocityVector(track, target) {
        const history = track?.history || [];
        if (history.length >= 2) {
          const previousEntry = history[history.length - 2];
          const currentEntry = history[history.length - 1];
          const deltaTimeSec = Math.max(0.001, (currentEntry.timeSec || 0) - (previousEntry.timeSec || 0));
          return scaleVector(subtractVectors(currentEntry.position, previousEntry.position), 1 / deltaTimeSec);
        }

        const mission = target?.runtime?.mission;
        const movement = target?.components?.movement;
        if (target && movement && mission && mission.currentWaypointIndex < mission.waypoints.length) {
          const waypoint = mission.waypoints[mission.currentWaypointIndex];
          const direction = normalizeVector(subtractVectors(waypoint, target.runtime.position));
          if (direction) {
            return scaleVector(direction, movement.speedMps || 0);
          }
        }

        return { x: 0, y: 0, z: 0 };
      }

      function estimateTrackPayloadScore(track, target) {
        const speedMps = magnitude3D(getVelocityVector(track, target));
        const signatureDb = target?.components?.signature?.radarSignatureDb ?? -18;
        const sizeScore = clamp((signatureDb + 20) / 6, 0, 3);
        const behaviorScore = track.intentStatus === "Attack Run"
          ? 3
          : (track.intentStatus === "Loiter" ? 1.25 : 0.5);
        const speedScore = clamp(speedMps / 20, 0, 2);
        return round(1 + sizeScore + behaviorScore + speedScore, 2);
      }

      function findMissionHeuristicTarget(world, object) {
        const missionProfile = object?.runtime?.missionProfile || object?.missionProfile || { type: "Geographic", targetTemplateId: null };
        const hostileAssets = getSideAssets(world, getOpposingSide(object?.side))
          .filter((candidate) => candidate.id !== object.id);

        if (!hostileAssets.length) {
          return null;
        }

        if (missionProfile.type === "SpecificAsset" && missionProfile.targetTemplateId) {
          const matches = hostileAssets.filter((candidate) => candidate.templateId === missionProfile.targetTemplateId);
          if (matches.length) {
            return matches.sort((left, right) => (
              distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position)
            ))[0];
          }
        }

        if (missionProfile.type === "MaxDamage") {
          return hostileAssets
            .slice()
            .sort((left, right) => {
              const valueDiff = Number(right.components.health.assetValuePts || 0) - Number(left.components.health.assetValuePts || 0);
              if (valueDiff !== 0) {
                return valueDiff;
              }
              return distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position);
            })[0];
        }

        return hostileAssets
          .slice()
          .sort((left, right) => (
            distance3D(object.runtime.position, left.runtime.position) - distance3D(object.runtime.position, right.runtime.position)
          ))[0];
      }

      function resolveProjectedAsset(world, originPosition, velocityVector, fallbackObject, defendedSide = "Blue") {
        const direction = normalizeVector2D(velocityVector);
        const toleranceM = world.config.projectedPathToleranceM;
        if (!direction) {
          const fallbackDistanceM = fallbackObject ? distance2D(originPosition, fallbackObject.runtime.position) : Infinity;
          return {
            asset: fallbackObject || null,
            directDistanceM: fallbackDistanceM,
            directDistanceXYM: fallbackDistanceM,
            pathOffsetM: Infinity,
            pathOffsetXYM: Infinity,
            intersectsPath: false
          };
        }

        let bestCandidate = null;
        getSideAssets(world, defendedSide).forEach((asset) => {
          const offset = subtractVectors(asset.runtime.position, originPosition);
          const alongDistanceM = dotProduct2D(offset, direction);
          if (alongDistanceM < 0) {
            return;
          }
          const projectedPoint = {
            x: originPosition.x + (direction.x * alongDistanceM),
            y: originPosition.y + (direction.y * alongDistanceM),
            z: originPosition.z || 0
          };
          const directDistanceXYM = distance2D(originPosition, asset.runtime.position);
          const pathOffsetXYM = distance2D(asset.runtime.position, projectedPoint);
          if (!bestCandidate || pathOffsetXYM < bestCandidate.pathOffsetXYM) {
            bestCandidate = {
              asset,
              directDistanceM: directDistanceXYM,
              directDistanceXYM,
              pathOffsetM: pathOffsetXYM,
              pathOffsetXYM,
              intersectsPath: pathOffsetXYM <= toleranceM
            };
          }
        });

        if (bestCandidate && bestCandidate.intersectsPath) {
          return bestCandidate;
        }

        const fallbackDistanceM = fallbackObject ? distance2D(originPosition, fallbackObject.runtime.position) : Infinity;
        return {
          asset: fallbackObject || null,
          directDistanceM: fallbackDistanceM,
          directDistanceXYM: fallbackDistanceM,
          pathOffsetM: bestCandidate ? bestCandidate.pathOffsetXYM : Infinity,
          pathOffsetXYM: bestCandidate ? bestCandidate.pathOffsetXYM : Infinity,
          intersectsPath: false
        };
      }

      function getTrackThreatState(track) {
        if (!track.threatState) {
          track.threatState = {
            attackRunActive: false,
            nonClosingCount: 0,
            lastThreatAssetId: null,
            lastThreatDistanceXYM: null
          };
        }
        return track.threatState;
      }

      function updateTrackThreatAssessment(world, track, target, options = {}) {
        const commitState = options.commitState !== false;
        const updateTrackFields = options.updateTrackFields !== false;
        const threatState = getTrackThreatState(track);
        const originPosition = track.position || target.runtime.position;
        const velocityVector = getVelocityVector(track, target);
        const speedMps = magnitude3D(velocityVector);
        const headingUnitXY = normalizeVector2D(velocityVector);
        const currentProjectedAsset = resolveProjectedAsset(world, originPosition, velocityVector, null, track.owningSide || "Blue");
        const currentProjectedAssetId = currentProjectedAsset.asset && currentProjectedAsset.intersectsPath
          ? currentProjectedAsset.asset.id
          : null;
        const currentProjectedDistanceXYM = currentProjectedAssetId
          ? currentProjectedAsset.directDistanceXYM
          : null;
        const sameThreatAsset = currentProjectedAssetId
          && threatState.lastThreatAssetId === currentProjectedAssetId;
        const increasingDistance = sameThreatAsset
          && Number.isFinite(threatState.lastThreatDistanceXYM)
          && Number.isFinite(currentProjectedDistanceXYM)
          && currentProjectedDistanceXYM > (threatState.lastThreatDistanceXYM + THREAT_DISTANCE_EPSILON_M);
        const lowSpeed = speedMps < THREAT_SPEED_THRESHOLD_MPS;
        const currentlyClosing = Boolean(currentProjectedAssetId) && !lowSpeed && !increasingDistance;

        let attackRunActive = false;
        let nonClosingCount = 0;
        let effectiveThreatAssetId = null;
        let effectiveThreatDistanceXYM = null;
        let threatReason = "no-threat-path";

        if (currentlyClosing) {
          attackRunActive = true;
          nonClosingCount = 0;
          effectiveThreatAssetId = currentProjectedAssetId;
          effectiveThreatDistanceXYM = currentProjectedDistanceXYM;
          threatReason = "closing";
        } else if (threatState.attackRunActive) {
          nonClosingCount = threatState.nonClosingCount + 1;
          if (nonClosingCount < 2 && threatState.lastThreatAssetId) {
            attackRunActive = true;
            effectiveThreatAssetId = threatState.lastThreatAssetId;
            effectiveThreatDistanceXYM = threatState.lastThreatDistanceXYM;
            threatReason = lowSpeed
              ? "low-speed-hysteresis"
              : (increasingDistance ? "opening-range-hysteresis" : "path-break-hysteresis");
          } else {
            threatReason = lowSpeed
              ? "threat-dropped-low-speed"
              : (increasingDistance ? "threat-dropped-opening-range" : "threat-dropped-path-break");
          }
        } else if (lowSpeed) {
          threatReason = "low-speed";
        } else if (increasingDistance) {
          threatReason = "opening-range";
        }

        if (commitState) {
          if (currentlyClosing) {
            threatState.lastThreatAssetId = currentProjectedAssetId;
            threatState.lastThreatDistanceXYM = currentProjectedDistanceXYM;
          } else if (!attackRunActive) {
            threatState.lastThreatAssetId = null;
            threatState.lastThreatDistanceXYM = null;
          }

          threatState.attackRunActive = attackRunActive;
          threatState.nonClosingCount = attackRunActive ? nonClosingCount : 0;
        }

        if (updateTrackFields) {
          track.currentSpeedMps = round(speedMps, 2);
          track.currentHeadingUnitXY = headingUnitXY
            ? {
              x: round(headingUnitXY.x, 4),
              y: round(headingUnitXY.y, 4),
              z: 0
            }
            : null;
          track.currentProjectedAssetId = currentProjectedAssetId;
          track.currentProjectedDistanceXYM = Number.isFinite(currentProjectedDistanceXYM) ? round(currentProjectedDistanceXYM, 2) : null;
          track.projectedTargetId = effectiveThreatAssetId;
          track.effectiveThreatDistanceXYM = Number.isFinite(effectiveThreatDistanceXYM) ? round(effectiveThreatDistanceXYM, 2) : null;
          track.attackRunActive = attackRunActive;
          track.threatNonClosingCount = nonClosingCount;
          track.threatReason = threatReason;
        }

        return {
          speedMps,
          headingUnitXY,
          currentProjectedAsset,
          currentProjectedAssetId,
          currentProjectedDistanceXYM,
          attackRunActive,
          effectiveThreatAssetId,
          effectiveThreatDistanceXYM,
          threatReason,
          nonClosingCount
        };
      }

      function snapshotWorld(world, timeSec, reason) {
        return {
          timeSec: round(timeSec, 2),
          reason,
          objects: world.objectIds.map((id) => {
            const object = world.objects[id];
            return {
              id: object.id,
              name: object.name,
              side: object.side,
              roles: deepClone(object.roles),
              isInterceptorChild: !!object.runtime.interceptorChild,
              x: object.runtime.position.x,
              y: object.runtime.position.y,
              z: object.runtime.position.z,
              sensors: deepClone(object.components.sensors || []),
              effectors: deepClone(object.components.effectors || []),
              currentHeadingDeg: object.runtime.currentHeadingDeg ?? null,
              behaviorState: object.runtime.behaviorState || "Active",
              controlMode: object.runtime.controlMode || null,
              destroyed: object.runtime.destroyed,
              status: object.runtime.operationalStatus
            };
          }),
          tracks: getAllTracks(world).map((track) => ({
            id: track.id,
            x: track.position ? track.position.x : null,
            y: track.position ? track.position.y : null,
            headingDeg: track.currentHeadingUnitXY
              ? round((Math.atan2(track.currentHeadingUnitXY.y, track.currentHeadingUnitXY.x) * (180 / Math.PI) + 360) % 360, 2)
              : null,
            classification: track.classificationStatus,
            identification: track.identificationStatus,
            intent: track.intentStatus,
            status: track.status
          })),
          clutterPlaceholders: world.environment.placeholderClutterField?.enabled ? [{
            centerX: world.environment.placeholderClutterField.centerX,
            centerY: world.environment.placeholderClutterField.centerY,
            radiusM: world.environment.placeholderClutterField.radiusM,
            label: world.environment.placeholderClutterField.label
          }] : []
        };
      }

      function finalizeReport(world, seed) {
        const blueObjects = world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === "Blue");
        const redObjects = world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === "Red");
        const destroyedRedObjects = redObjects.filter((object) => object.runtime.destroyed);
        const survivingBlueObjects = blueObjects.filter((object) => !object.runtime.destroyed);
        const destroyedBlueObjects = blueObjects.filter((object) => object.runtime.destroyed);
        const damagedBlueObjects = blueObjects.filter((object) => (
          !object.runtime.destroyed
          && Number(object.runtime.health || 0) < Number(object.components.health.maxHealth || 0)
        ));
        const hqObjects = blueObjects.filter((object) => object.components.health.isHQ);
        const totalBlueAssetValue = blueObjects.reduce((sum, object) => (
          sum + Math.max(0, Number(object.components.health.assetValuePts || 0))
        ), 0);
        const remainingBlueAssetValue = blueObjects.reduce((sum, object) => {
          const maxHealth = Math.max(1, Number(object.components.health.maxHealth || 1));
          const healthFraction = clamp((object.runtime.health || 0) / maxHealth, 0, 1);
          return sum + (healthFraction * Math.max(0, Number(object.components.health.assetValuePts || 0)));
        }, 0);
        const primaryTrack = getAllTracks(world)
          .sort((left, right) => (right.lastUpdateTimeSec || 0) - (left.lastUpdateTimeSec || 0))[0] || null;

        return {
          report: {
            scenarioName: world.scenario.metadata.name,
            seed,
            endTimeSec: round(world.currentTimeSec, 2),
            detected: world.metrics.detectionCandidates > 0,
            trackCreated: world.metrics.tracksCreated > 0,
            classified: world.metrics.classifications > 0,
            identified: world.metrics.identifications > 0,
            intentAssessed: world.metrics.intentsAssessed > 0,
            engaged: world.metrics.shotsFired > 0,
            targetDestroyed: destroyedRedObjects.length > 0,
            tracksDropped: world.metrics.tracksDropped,
            ghostTracksGenerated: world.metrics.ghostTracksGenerated,
            firstDetectionTimeSec: world.metrics.firstDetectionTimeSec,
            firstDetectionRangeM: world.metrics.firstDetectionRangeM,
            killTimeSec: world.metrics.killTimeSec,
            blueAssetsSurvived: survivingBlueObjects.length,
            hqSurvived: hqObjects.every((object) => !object.runtime.destroyed),
            percentSurvived: blueObjects.length ? round(survivingBlueObjects.length / blueObjects.length, 4) : 0,
            weightedSurvivalScore: totalBlueAssetValue > 0 ? round(remainingBlueAssetValue / totalBlueAssetValue, 4) : 0,
            threatsDestroyed: destroyedRedObjects.length,
            successfulStrikes: world.metrics.successfulStrikes || 0,
            blueAssetsDestroyed: destroyedBlueObjects.length,
            blueAssetsDamaged: damagedBlueObjects.length + destroyedBlueObjects.length,
            shotsFired: world.metrics.shotsFired,
            eventCount: world.logs.length,
            assessmentSnapshotCount: world.assessmentSnapshots.length,
            interceptorLaunches: world.metrics.interceptorLaunches,
            interceptorResolutions: world.metrics.interceptorResolutions,
            interceptorAborts: world.metrics.interceptorAborts,
            terrainCollisions: world.metrics.terrainCollisions,
            ewEvents: world.metrics.ewEvents,
            spoofEvents: world.metrics.spoofEvents || 0,
            cyberEvents: world.metrics.cyberEvents || 0,
            networkJamEvents: world.metrics.networkJamEvents,
            fallbackTransitions: world.metrics.fallbackTransitions,
            ammoExpended: deepClone(world.metrics.ammoExpended),
            finalTargetStatus: destroyedRedObjects.length > 0
              ? "Destroyed"
              : (redObjects[0]?.runtime.operationalStatus || "Unknown"),
            finalTrackStatus: primaryTrack ? primaryTrack.status : "None",
            finalClassificationStatus: primaryTrack ? primaryTrack.classificationStatus : "None",
            finalIdentificationStatus: primaryTrack ? primaryTrack.identificationStatus : "None",
            finalIntentStatus: primaryTrack ? primaryTrack.intentStatus : "None",
            logs: deepClone(world.logs),
            assessmentSnapshots: deepClone(world.assessmentSnapshots),
            frames: deepClone(world.frames),
            tracks: {
              blue: deepClone(world.blueTracks || {}),
              red: deepClone(world.redTracks || {})
            }
          }
        };
      }

      function createCsvRow(iterationId, report) {
        const row = {
          Iteration_ID: iterationId,
          Scenario_Name: report.scenarioName,
          Seed: report.seed,
          Detected: report.detected ? "Yes" : "No",
          Track_Created: report.trackCreated ? "Yes" : "No",
          Classified: report.classified ? "Yes" : "No",
          Identified: report.identified ? "Yes" : "No",
          Intent_Assessed: report.intentAssessed ? "Yes" : "No",
          Engaged: report.engaged ? "Yes" : "No",
          Threat_Destroyed: report.targetDestroyed ? "Yes" : "No",
          Tracks_Dropped: report.tracksDropped,
          Ghost_Tracks_Generated: report.ghostTracksGenerated,
          First_Detection_Time_s: report.firstDetectionTimeSec ?? "",
          First_Detection_Range_m: report.firstDetectionRangeM ?? "",
          Kill_Time_s: report.killTimeSec ?? "",
          Blue_Assets_Survived: report.blueAssetsSurvived,
          HQ_Survived: report.hqSurvived ? 1 : 0,
          Percent_Survived: report.percentSurvived,
          Weighted_Survival_Score: report.weightedSurvivalScore,
          Threats_Destroyed: report.threatsDestroyed,
          Successful_Strikes: report.successfulStrikes ?? 0,
          Blue_Assets_Destroyed: report.blueAssetsDestroyed ?? 0,
          Blue_Assets_Damaged: report.blueAssetsDamaged ?? 0,
          Shots_Fired: report.shotsFired,
          Interceptor_Launches: report.interceptorLaunches ?? 0,
          Interceptor_Resolutions: report.interceptorResolutions ?? 0,
          Interceptor_Aborts: report.interceptorAborts ?? 0,
          Terrain_Collisions: report.terrainCollisions ?? 0,
          EW_Events: report.ewEvents ?? 0,
          Spoof_Events: report.spoofEvents ?? 0,
          Cyber_Events: report.cyberEvents ?? 0,
          Network_Jam_Events: report.networkJamEvents ?? 0,
          Fallback_Transitions: report.fallbackTransitions ?? 0,
          Final_Target_Status: report.finalTargetStatus,
          Final_Track_Status: report.finalTrackStatus,
          Classification_Status: report.finalClassificationStatus,
          Identification_Status: report.finalIdentificationStatus,
          Intent_Status: report.finalIntentStatus,
          Event_Count: report.eventCount
        };

        Object.keys(report.ammoExpended || {})
          .sort()
          .forEach((templateId) => {
            row[templateId + "_Ammo_Expended"] = report.ammoExpended[templateId] || 0;
          });

        return row;
      }

      function rowsToCsv(rows) {
        if (!rows.length) {
          return "";
        }
        const headers = [];
        rows.forEach((row) => {
          Object.keys(row).forEach((header) => {
            if (!headers.includes(header)) {
              headers.push(header);
            }
          });
        });
        const lines = [headers.join(",")];
        rows.forEach((row) => {
          const values = headers.map((header) => {
            const rawValue = row[header] ?? "";
            return "\"" + String(rawValue).replace(/"/g, "\"\"") + "\"";
          });
          lines.push(values.join(","));
        });
        return lines.join("\n");
      }
