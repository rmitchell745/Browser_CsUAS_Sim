// Extracted from index.html
      function getObject(world, objectId) {
        return world.objects[objectId] || null;
      }

      function getTrack(world, trackId) {
        return world.blueTracks?.[trackId] || world.redTracks?.[trackId] || null;
      }

      function getTracksForSide(world, side) {
        if (side === "Red") {
          return Object.values(world.redTracks || {});
        }
        if (side === "Blue") {
          return Object.values(world.blueTracks || {});
        }
        return [];
      }

      function getAllTracks(world) {
        return [
          ...Object.values(world.blueTracks || {}),
          ...Object.values(world.redTracks || {})
        ];
      }

      function getTracksForObject(world, objectId) {
        return getAllTracks(world).filter((track) => track.realObjectId === objectId);
      }

      function getSensor(world, objectId, sensorId) {
        const object = getObject(world, objectId);
        if (!object) {
          return null;
        }
        return (object.components.sensors || []).find((sensor) => sensor.id === sensorId) || null;
      }

      function getSensorRuntimeState(object, sensorId) {
        return object?.runtime?.sensorStates?.[sensorId] || null;
      }

      function getOpposingSide(side) {
        if (side === "Blue") {
          return "Red";
        }
        if (side === "Red") {
          return "Blue";
        }
        return "Neutral";
      }

      function getObjectsForSide(world, side) {
        return world.objectIds
          .map((id) => world.objects[id])
          .filter((object) => object.side === side && !object.runtime.destroyed);
      }

      function getSideAssets(world, side) {
        return getObjectsForSide(world, side)
          .filter((object) => object.roles.includes("Asset"));
      }

      function getEffectorRuntimeState(object, effectorId) {
        return object?.runtime?.effectorStates?.[effectorId] || null;
      }

      function getObjectSideById(world, objectId) {
        return world.objects[objectId]?.side || null;
      }

      function inferLogSide(world, data = {}) {
        if (data.side) {
          return data.side;
        }
        if (data.trackId) {
          const track = getTrack(world, data.trackId);
          if (track?.owningSide) {
            return track.owningSide;
          }
        }
        const candidateIds = [
          data.objectId,
          data.observerId,
          data.shooterId,
          data.hostId,
          data.c2ObjectId,
          data.targetId
        ];
        for (const candidateId of candidateIds) {
          const side = getObjectSideById(world, candidateId);
          if (side) {
            return side;
          }
        }
        return "Neutral";
      }

      function isOpticalSensor(sensor) {
        const type = String(sensor?.type || "").toUpperCase();
        return type === "EO_IR" || type === "FPV";
      }

      function isRfPassiveSensor(sensor) {
        return String(sensor?.type || "").toUpperCase() === "RF_PASSIVE";
      }

      function isAcousticSensor(sensor) {
        return String(sensor?.type || "").toUpperCase() === "ACOUSTIC";
      }

      function isDirectedEnergyEffector(effector) {
        return String(effector?.type || "").toUpperCase() === "DIRECTEDENERGY";
      }

      function getObjectEmissionState(object) {
        if (!object) {
          return { radioSilent: true, navigationCompromised: false, telemetryCompromised: false };
        }
        const controlMode = String(object.runtime?.controlMode || "");
        return {
          radioSilent: !object.components?.capability?.usesRF || ["AutonomousFallback", "HeuristicFallback", "Jammed/Severed"].includes(controlMode),
          navigationCompromised: Boolean(object.runtime?.spoofedOffset && !object.runtime?.spoofRestored),
          telemetryCompromised: Boolean(object.runtime?.telemetrySpoofed && !object.runtime?.telemetryRestored)
        };
      }

      function getTrackObservedPosition(world, observerSide, target) {
        if (
          observerSide === "Blue"
          && target?.runtime?.telemetrySpoofed
          && target.runtime.telemetryOffsetXY
        ) {
          return {
            x: (target.runtime.position.x || 0) + Number(target.runtime.telemetryOffsetXY.x || 0),
            y: (target.runtime.position.y || 0) + Number(target.runtime.telemetryOffsetXY.y || 0),
            z: target.runtime.position.z || 0
          };
        }
        return deepClone(target?.runtime?.position || { x: 0, y: 0, z: 0 });
      }
