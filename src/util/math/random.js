// Extracted from index.html
// Deterministic RNG is critical because playtests, Monte Carlo, and bug reports
// all assume seeded replayability.
      class SeededRNG {
        constructor(seed) {
          this.seed = seed >>> 0;
        }

        next() {
          this.seed = (1664525 * this.seed + 1013904223) >>> 0;
          return this.seed / 4294967296;
        }

        nextGaussian(mean = 0, standardDeviation = 1) {
          let u1 = this.next();
          let u2 = this.next();
          if (u1 <= 1e-12) {
            u1 = 1e-12;
          }
          const magnitude = Math.sqrt(-2 * Math.log(u1));
          const z0 = magnitude * Math.cos(2 * Math.PI * u2);
          return mean + (z0 * standardDeviation);
        }

        chance(probability) {
          return this.next() <= probability;
        }
      }

