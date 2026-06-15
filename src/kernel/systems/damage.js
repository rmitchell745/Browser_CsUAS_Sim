// Extracted from index.html
      class DamageSystem {
        process(event, world, services) {
          applyDamageEvent(world, event.payload, event.time, services);
        }
      }
