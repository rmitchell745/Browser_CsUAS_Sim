// Extracted from index.html.
// Report assembly is the contract surface for debrief, Monte Carlo, CSV export,
// and future analytics.
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
