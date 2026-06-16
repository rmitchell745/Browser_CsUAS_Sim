// Vite entrypoint for the extracted review tree.
// Keep this bootstrap intentionally small while the runnable app still lives in
// the legacy single-file shell.
import { bootstrapLegacyApp } from "./bridge/bootstrapLegacyApp.js";

bootstrapLegacyApp();
