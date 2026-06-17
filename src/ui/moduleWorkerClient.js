// Native module-worker factory for the Vite build. Use Vite's inline worker
// import so the distribution can remain a single HTML artifact.
import MonteCarloWorker from "../workers/monteCarloWorker.js?worker&inline";

export function createModuleMonteCarloWorker() {
  return new MonteCarloWorker();
}
