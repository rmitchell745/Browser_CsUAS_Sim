// Extracted from index.html.
// Hidden infrastructure stays per-side for now. This system restores degraded
// network state after jammer/cyber timers expire.
      class NetworkSystem {
        restore(event, world, services) {
          const network = getInfrastructureForSide(world, event.payload.side)?.network;
          if (!network) {
            return;
          }
          if (event.time + 0.001 < Math.max(network.jammedUntilSec || 0, network.degradedUntilSec || 0)) {
            return;
          }
          network.jammedUntilSec = 0;
          network.degradedUntilSec = 0;
          network.sensorNoisePenaltyDb = 0;
          network.status = "Connected";
          services.logger.record(
            world,
            event.time,
            "network",
            event.payload.side + " network restored",
            {
              side: event.payload.side,
              networkId: network.id
            }
          );
        }
      }
