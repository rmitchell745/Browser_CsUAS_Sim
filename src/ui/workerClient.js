// Extracted from index.html.
// This is the legacy in-browser worker path. The Vite bridge currently bundles
// the monolith, so this file remains a review target more than a live runtime.
function createMonteCarloWorker() {
      // The worker rehydrates the kernel from a serialized factory so Monte
      // Carlo runs do not block the browser thread.
      const workerSource = `
        const createSimulationKernel = ${createSimulationKernel.toString()};
        const kernel = createSimulationKernel();
        const simulationManager = new kernel.SimulationManager();
        const monteCarloManager = new kernel.MonteCarloManager(simulationManager);
        self.onmessage = function (event) {
          const message = event.data || {};
          if (message.type !== "runMonteCarlo") {
            return;
          }
          try {
            const rows = monteCarloManager.run(message.iterations, {
              baseSeed: message.baseSeed,
              scenario: message.scenario,
              onProgress: function (completed, total) {
                if (completed % 5 === 0 || completed === total) {
                  self.postMessage({ type: "progress", completed, total });
                }
              }
            });
            self.postMessage({ type: "complete", rows });
          } catch (error) {
            self.postMessage({ type: "error", message: error && error.message ? error.message : String(error) });
          }
        };
      `;
      const blob = new Blob([workerSource], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      return worker;
    }
