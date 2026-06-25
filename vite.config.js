import { existsSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function inlineScreenIncludes() {
  return {
    name: "inline-screen-includes",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/<include\b[^>]*\b(?:src|file)=(["'])([^"']+)\1[^>]*>\s*<\/include>/g, (_match, _quote, includePath) => {
          const resolvedPath = resolve(__dirname, includePath);
          return readFileSync(resolvedPath, "utf8");
        });
      }
    }
  };
}

function renameBuiltIndex() {
  return {
    name: "rename-built-index",
    writeBundle() {
      const distDir = resolve(__dirname, "dist");
      const source = resolve(distDir, "index_base.html");
      const target = resolve(distDir, "index.html");
      if (!existsSync(source)) {
        return;
      }
      if (existsSync(target)) {
        unlinkSync(target);
      }
      renameSync(source, target);
    }
  };
}

export default defineConfig({
  plugins: [inlineScreenIncludes(), viteSingleFile(), renameBuiltIndex()],
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index_base.html")
      },
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
