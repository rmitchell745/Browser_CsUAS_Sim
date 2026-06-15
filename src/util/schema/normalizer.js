// Extracted from index.html
      function normalizeRoles(roles, fallbackRoles = []) {
        if (Array.isArray(roles) && roles.length) {
          return roles.slice();
        }
        return fallbackRoles.slice();
      }

      function normalizeMissionProfile(profile) {
        const type = String(profile?.type || "Geographic");
        return {
          type: ["Geographic", "SpecificAsset", "MaxDamage"].includes(type) ? type : "Geographic",
          targetTemplateId: profile?.targetTemplateId || null
        };
      }

      function normalizeLostLinkBehavior(value) {
        const behavior = String(value || "ContinueDeadReckoning");
        return ["ContinueDeadReckoning", "RTB", "Hover/Loiter", "ExecuteTerminalDive"].includes(behavior)
          ? behavior
          : "ContinueDeadReckoning";
      }

      function normalizePayload(payload) {
        return {
          impactDamagePoints: Number(payload?.impactDamagePoints ?? payload?.damagePoints ?? payload?.payloadYield ?? 0),
          selfDestructOnImpact: payload?.selfDestructOnImpact !== false
        };
      }

      function normalizeResistance(resistance = {}) {
        return {
          kineticResistance: Number(resistance.kineticResistance ?? 0.1),
          ewResistance: Number(resistance.ewResistance ?? 0.1),
          networkResistance: Number(resistance.networkResistance ?? 0.1)
        };
      }

      function normalizeSignature(signature = {}) {
        return {
          radarSignatureDb: Number(signature.radarSignatureDb ?? signature.radarSignature_dB ?? -10),
          acousticSignatureDb: Number(signature.acousticSignatureDb ?? signature.acousticSignature_dB ?? 60),
          rfEmissionDb: Number(signature.rfEmissionDb ?? signature.rfEmission_dB ?? 20)
        };
      }

      function normalizeVulnerability(vulnerability = {}, resistance = {}) {
        const fallbackLinkResilience = vulnerability.linkResilience ?? resistance.linkResilience ?? 0.5;
        return {
          commsResilience: clamp(Number(vulnerability.commsResilience ?? fallbackLinkResilience), 0, 1),
          navResilience: clamp(Number(vulnerability.navResilience ?? fallbackLinkResilience), 0, 1),
          cyberResilience: clamp(Number(vulnerability.cyberResilience ?? fallbackLinkResilience), 0, 1)
        };
      }

      function normalizeCapability(capability, components = {}) {
        const inferredUsesRf = ensureArray(components.sensors).length > 0 || ensureArray(components.effectors).some((effector) => {
          const type = String(effector?.type || "").toUpperCase();
          return ["EW", "JAMMER", "SPOOFER", "CYBER", "RF_PASSIVE", "FPV"].includes(type);
        });
        const inferredNeedsPower = ensureArray(components.sensors).length > 0
          || ensureArray(components.effectors).length > 0
          || Boolean(components.c2);
        const inferredUsesNetwork = Boolean(components.c2) || Boolean(capability?.usesNetwork);
        return {
          usesGPS: capability?.usesGPS !== false,
          usesNetwork: capability?.usesNetwork != null ? !!capability.usesNetwork : inferredUsesNetwork,
          usesRF: capability?.usesRF != null ? !!capability.usesRF : inferredUsesRf,
          requiresPower: capability?.requiresPower != null ? !!capability.requiresPower : inferredNeedsPower,
          requiresC2: !!capability?.requiresC2,
          canOperateAutonomously: capability?.canOperateAutonomously !== false,
          lostLinkBehavior: normalizeLostLinkBehavior(capability?.lostLinkBehavior)
        };
      }

      function normalizeSensorType(type) {
        const rawType = String(type || "Radar").trim();
        const upperType = rawType.toUpperCase();
        const sensorType = ({
          RADAR: "Radar",
          EO_IR: "EO_IR",
          "EO-IR": "EO_IR",
          EOIR: "EO_IR",
          RF: "RF_Passive",
          RF_PASSIVE: "RF_Passive",
          "RF-PASSIVE": "RF_Passive",
          RFPASSIVE: "RF_Passive",
          ACOUSTIC: "Acoustic",
          FPV: "FPV"
        }[upperType] || rawType);
        return ["Radar", "EO_IR", "RF_Passive", "Acoustic", "FPV"].includes(sensorType)
          ? sensorType
          : "Radar";
      }

      function normalizeSensor(sensor, index) {
        const classification = sensor.classification || {};
        const identification = sensor.identification || {};
        return {
          id: sensor.id || "Sensor-" + (index + 1),
          name: sensor.name || sensor.type || ("Sensor " + (index + 1)),
          type: normalizeSensorType(sensor.type),
          maxRangeM: Number(sensor.maxRangeM ?? sensor.maxRange_m ?? 0),
          horizontalFovDeg: Number(sensor.horizontalFovDeg ?? sensor.fov_azimuth_deg ?? 360),
          verticalFovDeg: Number(sensor.verticalFovDeg ?? sensor.fov_elevation_deg ?? 180),
          headingDeg: Number(sensor.headingDeg ?? sensor.heading_deg ?? 0),
          transmitPowerDb: Number(sensor.transmitPowerDb ?? sensor.txPower_dB ?? 0),
          noiseFloorDb: Number(sensor.noiseFloorDb ?? -94),
          noiseSigmaDb: Number(sensor.noiseSigmaDb ?? 1.2),
          detectionThresholdDb: Number(sensor.detectionThresholdDb ?? sensor.thresholdDb ?? 17),
          scanIntervalSec: Number(sensor.scanIntervalSec ?? sensor.sweepRate_sec ?? 1),
          classification: {
            canClassify: classification.canClassify !== false,
            latencySec: Number(classification.latencySec ?? classification.classificationLatency_sec ?? 0.2),
            accuracyBase: Number(classification.accuracyBase ?? classification.classificationAccuracyBase ?? 0.72)
          },
          identification: {
            canIdentify: identification.canIdentify !== false,
            latencySec: Number(identification.latencySec ?? identification.identificationLatency_sec ?? 0.35),
            accuracyBase: Number(identification.accuracyBase ?? identification.identificationAccuracyBase ?? 0.68)
          }
        };
      }

      function normalizeEffectorType(type) {
        const rawType = String(type || "Kinetic").trim();
        const effectorType = ({
          KINETIC: "Kinetic",
          EW: "Jammer",
          JAMMER: "Jammer",
          LASER: "DirectedEnergy",
          DIRECTEDENERGY: "DirectedEnergy",
          DIRECTED_ENERGY: "DirectedEnergy",
          INTERCEPTOR: "Interceptor",
          SPOOFER: "Spoofer",
          CYBER: "Cyber"
        }[rawType.toUpperCase()] || rawType);
        return ["Kinetic", "Jammer", "DirectedEnergy", "Interceptor", "Spoofer", "Cyber"].includes(effectorType)
          ? effectorType
          : "Kinetic";
      }

      function normalizeDeliveryModel(model, effectorType) {
        const rawModel = String(model || "").trim();
        if (["Ballistic", "Guided", "Instant"].includes(rawModel)) {
          return rawModel;
        }
        if (effectorType === "Interceptor") {
          return "Guided";
        }
        if (effectorType === "Kinetic") {
          return "Ballistic";
        }
        return "Instant";
      }

      function normalizeEffector(effector, index) {
        const projectileSpeedMps = Number(
          effector.projectileSpeedMps
          ?? effector.projectileSpeed_mps
          ?? effector.kinetic?.projectileSpeed_mps
          ?? 0
        );
        return {
          id: effector.id || "Effector-" + (index + 1),
          name: effector.name || effector.type || ("Effector " + (index + 1)),
          type: normalizeEffectorType(effector.type),
          maxRangeM: Number(effector.maxRangeM ?? effector.maxRange_m ?? 0),
          basePk: Number(effector.basePk ?? 0),
          basePe: Number(effector.basePe ?? 0),
          damagePoints: Number(effector.damagePoints ?? effector.payloadYield ?? 0),
          ammoCapacity: Number(effector.ammoCapacity ?? 1),
          slewRateSec: Number(effector.slewRateSec ?? effector.slewRate_sec ?? effector.commandDelaySec ?? 0.2),
          cooldownSec: Number(effector.cooldownSec ?? effector.cooldown_sec ?? 1.5),
          projectileSpeedMps: Number.isFinite(projectileSpeedMps) ? projectileSpeedMps : 0,
          terminalRadiusM: Number(effector.terminalRadiusM ?? effector.terminalRadius_m ?? 12),
          maxFlightTimeSec: Number(effector.maxFlightTimeSec ?? effector.maxFlightTime_sec ?? 8),
          effectDurationSec: Number(effector.effectDurationSec ?? effector.effectDuration_sec ?? 6),
          jamStrengthDb: Number(effector.jamStrengthDb ?? effector.jammingPowerDb ?? 8),
          deliveryModel: normalizeDeliveryModel(effector.deliveryModel, normalizeEffectorType(effector.type)),
          guidanceType: ["Autonomous", "Command"].includes(effector.guidanceType) ? effector.guidanceType : "Command",
          affectedDomains: ensureArray(effector.affectedDomains).length
            ? ensureArray(effector.affectedDomains)
            : ({
              Jammer: ["Sensor", "Network", "C2"],
              Spoofer: ["Navigation"],
              Cyber: ["Track", "Telemetry", "C2"]
            }[normalizeEffectorType(effector.type)] || [])
        };
      }

      function pointToSegmentDistance2D(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (dx === 0 && dy === 0) {
          return distance2D(point, start);
        }
        const t = clamp((((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx * dx) + (dy * dy)), 0, 1);
        const projected = {
          x: start.x + (dx * t),
          y: start.y + (dy * t)
        };
        return distance2D(point, projected);
      }
