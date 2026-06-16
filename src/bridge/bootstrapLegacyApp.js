import legacyHtml from "../../index.html?raw";

const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>\s*<\/body>\s*<\/html>\s*$/i;
const DOM_BOOTSTRAP_PATTERN = /window\.addEventListener\("DOMContentLoaded",\s*\(\)\s*=>\s*\{\s*window\.appController = new AppController\(\);\s*\}\s*\);\s*$/;

function extractLegacyScript(htmlSource) {
  const match = htmlSource.match(SCRIPT_PATTERN);
  if (!match) {
    throw new Error("Unable to locate the legacy inline script in index.html.");
  }
  return match[1];
}

function extractLegacyShell(htmlSource) {
  if (!SCRIPT_PATTERN.test(htmlSource)) {
    throw new Error("Unable to locate the legacy shell in index.html.");
  }
  return htmlSource.replace(SCRIPT_PATTERN, "</body>\n</html>\n");
}

function convertLegacyBootstrap(scriptSource) {
  const rewritten = scriptSource.replace(
    DOM_BOOTSTRAP_PATTERN,
    "window.appController = new AppController();"
  );
  if (rewritten === scriptSource) {
    throw new Error("Unable to rewrite the legacy DOMContentLoaded bootstrap.");
  }
  return rewritten;
}

export function bootstrapLegacyApp() {
  const shellHtml = extractLegacyShell(legacyHtml);
  const scriptSource = convertLegacyBootstrap(extractLegacyScript(legacyHtml));

  document.open();
  document.write(shellHtml);
  document.close();

  window.eval(scriptSource);
  return window.appController || null;
}
