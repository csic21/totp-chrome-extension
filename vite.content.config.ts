import { resolve } from "path";
import { defineConfig } from "vite";

const entryName = process.env.CONTENT_ENTRY ?? "fill-otp";
const entryPath = resolve(__dirname, `src/content/${entryName}.ts`);

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/content",
    emptyOutDir: false,
    lib: {
      entry: entryPath,
      formats: ["iife"],
      name: entryName.replace(/-/g, "_"),
      fileName: () => `${entryName}.js`,
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});