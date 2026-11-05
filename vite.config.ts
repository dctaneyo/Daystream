import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Railway serves the built files from Express; Vite is only the dev middleware
// and the bundler. In cloud previews the request host is the preview domain, so
// allow exactly the host handed to this process instead of a wildcard.
const extraHosts = (process.env.PREVIEW_HOSTNAME ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    allowedHosts: extraHosts,
  },
});
