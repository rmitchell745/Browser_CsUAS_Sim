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

export default defineConfig({
  plugins: [rewriteIncludeSrc(), htmlInclude(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
