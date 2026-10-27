import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Use the installed Google Chrome when present so no browser download is needed.
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const useChrome = process.env.PW_CHANNEL !== "chromium" && existsSync(systemChrome);
const port = Number(process.env.PORT || 4173);

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    ...(useChrome ? { channel: "chrome" } : {}),
    headless: true,
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    env: { PORT: String(port) },
  },
});
