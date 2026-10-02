import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
    },
  },
  css: { transformer: "lightningcss" },
  resolve: {
    // Vite 8 resolves `paths` from tsconfig natively.
    tsconfigPaths: true,
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  plugins: [
    ...(mode === "development"
      ? devtools({
          logging: false,
          eventBusConfig: { enabled: false },
          enhancedLogs: { enabled: false },
          consolePiping: { enabled: false },
          removeDevtoolsOnBuild: false,
          injectSource: { enabled: true },
        })
      : []),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    react(),
  ],
}));
