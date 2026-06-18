// Transitional bridge that packages the current monolith through Vite while
// letting new bundle-only infrastructure, like the native module worker, hook
// into the legacy shell cleanly.
import {
  convertLegacyBootstrap,
  extractLegacyScript,
  extractLegacyShell
} from "./legacyRuntime.js";
import { createModuleMonteCarloWorker } from "../ui/moduleWorkerClient.js";
import demoScenario from "../scenario/demo.json";
import scratchScenario from "../scenario/scratch.json";
import presetBlankScratch from "../scenario/presets/blank-scratch.json";
import presetBaselineSingle from "../scenario/presets/baseline-single.json";
import presetLockRefire from "../scenario/presets/lock-refire.json";
import presetTewaPriority from "../scenario/presets/tewa-priority.json";

export function bootstrapLegacyApp() {
  // Recreate the legacy shell verbatim so bundle-vs-monolith behavior stays aligned.
  const shellHtml = extractLegacyShell();
  const scriptSource = convertLegacyBootstrap(extractLegacyScript());

  document.open();
  document.write(shellHtml);
  document.close();

  globalThis.__CSUAS_SCENARIO_SOURCES = {
    "scenario:demo": demoScenario,
    "scenario:scratch": scratchScenario,
    "wizard-preset:blank-scratch": presetBlankScratch,
    "wizard-preset:baseline-single": presetBaselineSingle,
    "wizard-preset:lock-refire": presetLockRefire,
    "wizard-preset:tewa-priority": presetTewaPriority
  };
  window.eval(scriptSource);
  // Override the legacy Blob-string worker factory only in the bundled build.
  // The live monolith remains unchanged, but Vite now uses a native module
  // worker that can share the same legacy kernel extraction logic.
  globalThis.createMonteCarloWorker = createModuleMonteCarloWorker;
  return window.appController || null;
}
