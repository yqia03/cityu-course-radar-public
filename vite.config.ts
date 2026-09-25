import vinext from "vinext";
import { defineConfig } from "vite";
import type { WorkerConfig } from "@cloudflare/vite-plugin";

export default defineConfig(async ({ command }) => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server:
      process.env.CODEX_SANDBOX === "seatbelt"
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {},
    plugins: [
      vinext(),
      cloudflare({
        configPath: "wrangler.json",
        ...(command === "serve" && process.env.RADAR_TEST_STATE
          ? { persistState: { path: process.env.RADAR_TEST_STATE } }
          : {}),
        // Local development uses the same schema in a separate local database.
        ...(command === "serve"
          ? {
              config: (config: WorkerConfig) => {
                config.r2_buckets = [
                  {
                    binding: "MATERIALS",
                    bucket_name: "cityu-course-materials-local",
                  },
                ];
                config.vars = {
                  ...config.vars,
                  APP_ORIGIN: "http://localhost:5173",
                  ADMIN_USER_IDS: "local_seedy",
                };
                // Only isolated tests select access modes; production builds
                // and ordinary local development keep the configured mode.
                if (process.env.RADAR_TEST_STATE) {
                  if (process.env.RADAR_TEST_UPLOAD_MODE === undefined)
                    delete config.vars.MATERIALS_UPLOAD_MODE;
                  else
                    config.vars.MATERIALS_UPLOAD_MODE =
                      process.env.RADAR_TEST_UPLOAD_MODE;
                }
              },
            }
          : {}),
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
  };
});
