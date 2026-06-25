import { existsSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import htmlInclude from "vite-plugin-html-include";
import { viteSingleFile } from "vite-plugin-singlefile";

function rewriteIncludeSrc() {
  return {
    name: "rewrite-include-src",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/<include\b([^>]*?)\ssrc=(["'])/g, "<include$1 file=$2");
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
  plugins: [rewriteIncludeSrc(), htmlInclude(), viteSingleFile(), renameBuiltIndex()],
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
