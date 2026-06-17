// Public worker-client surface for the extracted tree.
// Keep this file small so the rest of the UI layer can switch from the legacy
// global helper to explicit imports without another path change later.
export { createModuleMonteCarloWorker as createMonteCarloWorker } from "./moduleWorkerClient.js";
