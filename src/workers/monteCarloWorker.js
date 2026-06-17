// Native module worker used by the Vite build.
// It still hydrates the kernel from the authoritative legacy monolith for now,
// but removes the Blob-string worker assembly from the bundle path.
import { createLegacyKernel } from "../bridge/legacyRuntime.js";

const kernel = createLegacyKernel();
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
    self.postMessage({
      type: "error",
      message: error && error.message ? error.message : String(error)
    });
  }
};
