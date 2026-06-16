// Extracted from index.html.
// Damage stays thin because the shared mutators own object-state changes and
// secondary effects; this system mostly routes queued damage events.
      class DamageSystem {
        process(event, world, services) {
          applyDamageEvent(world, event.payload, event.time, services);
        }
      }
