// Shared bridge helpers for the legacy monolith while `src/` is still closing
// parity gaps. Keep all legacy-shell parsing in one place so the Vite entry
// and native module worker use the same extraction rules.
import legacyHtml from "../../index.html?raw";

const SCRIPT_PATTERN = /<script>([\s\S]*?)<\/script>\s*<\/body>\s*<\/html>\s*$/i;
const DOM_BOOTSTRAP_PATTERN = /window\.addEventListener\("DOMContentLoaded",\s*\(\)\s*=>\s*\{\s*window\.appController = new AppController\(\);\s*\}\s*\);\s*$/;

function fail(message) {
  throw new Error(message);
}

export function extractLegacyScript(htmlSource = legacyHtml) {
  const match = htmlSource.match(SCRIPT_PATTERN);
  if (!match) {
    fail("Unable to locate the legacy inline script in index.html.");
  }
  return match[1];
}

export function extractLegacyShell(htmlSource = legacyHtml) {
  if (!SCRIPT_PATTERN.test(htmlSource)) {
    fail("Unable to locate the legacy shell in index.html.");
  }
  return htmlSource.replace(SCRIPT_PATTERN, "</body>\n</html>\n");
}

export function convertLegacyBootstrap(scriptSource) {
  const rewritten = scriptSource.replace(
    DOM_BOOTSTRAP_PATTERN,
    "window.appController = new AppController();"
  );
  if (rewritten === scriptSource) {
    fail("Unable to rewrite the legacy DOMContentLoaded bootstrap.");
  }
  return rewritten;
}

export function extractNamedFunction(scriptSource, functionName) {
  const marker = `function ${functionName}(`;
  const start = scriptSource.indexOf(marker);
  if (start < 0) {
    fail(`Unable to locate ${functionName} in the legacy script.`);
  }

  const bodyStart = scriptSource.indexOf("{", start);
  if (bodyStart < 0) {
    fail(`Unable to locate ${functionName} body start.`);
  }

  let index = bodyStart;
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  while (index < scriptSource.length) {
    const char = scriptSource[index];
    const next = scriptSource[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      index += 1;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 2;
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return scriptSource.slice(start, index + 1);
      }
    }

    index += 1;
  }

  fail(`Unable to locate ${functionName} body end.`);
}

let cachedLegacyKernel = null;

export function createLegacyKernel() {
  if (cachedLegacyKernel) {
    return cachedLegacyKernel;
  }

  const functionSource = extractNamedFunction(extractLegacyScript(), "createSimulationKernel");
  const createSimulationKernel = new Function(
    `"use strict"; ${functionSource}; return createSimulationKernel;`
  )();

  cachedLegacyKernel = createSimulationKernel();
  return cachedLegacyKernel;
}
