// Extracted from index.html.
// CSV export intentionally stays flat and additive so external analysis scripts
// do not break when new counters appear.
      function createCsvRow(iterationId, report) {
        // Keep column names explicit instead of nesting so spreadsheet tooling
        // and downstream Monte Carlo post-processing remain simple.
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
