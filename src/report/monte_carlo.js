// Extracted from index.html
      class MonteCarloManager {
        constructor(simulationManager) {
          this.simulationManager = simulationManager;
        }

        run(iterations, options = {}) {
          const rows = [];
          for (let index = 0; index < iterations; index += 1) {
            const seed = options.baseSeed + index;
            const result = this.simulationManager.run({
              seed,
              captureFrames: false,
              scenario: options.scenario
            });
            rows.push(createCsvRow(index + 1, result.report));
            if (typeof options.onProgress === "function") {
              options.onProgress(index + 1, iterations);
            }
          }
          return rows;
        }
      }
