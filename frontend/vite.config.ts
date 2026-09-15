import { defineConfig, loadEnv, mergeConfig } from "vite";

export default defineConfig(async (env) => {
  const { command, mode } = env;

  const plugins = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.push(
      devtools({
        logging: false,
        eventBusConfig: { enabled: false },
        enhancedLogs: { enabled: false },
        consolePiping: { enabled: false },
        removeDevtoolsOnBuild: false,
        injectSource: { enabled: true },
      }),
    );
  }

  const tailwindcss = (await import("@tailwindcss/vite")).default;
  plugins.push(tailwindcss());

  const tsConfigPaths = (await import("vite-tsconfig-paths")).default;
  plugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));

  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");
  plugins.push(
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
  );

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        defaultPreset: "cloudflare-module",
      }),
    );
  }

  const viteReact = (await import("@vitejs/plugin-react")).default;
  plugins.push(viteReact());

  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return mergeConfig(
    {
      server: {
        host: "::",
        port: 8080,
        watch: {
          awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
        },
      },
    },
    {
      define: envDefine,
      css: { transformer: "lightningcss" },
      resolve: {
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
      plugins,
    },
  );
});
