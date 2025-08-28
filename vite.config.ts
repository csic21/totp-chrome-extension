import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [vue(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: "./index.html",
        sidepanel: "./sidepanel.html"
      }
    }
  }
});
