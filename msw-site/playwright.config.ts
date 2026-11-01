import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /site\.spec\.ts/ },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } }, testMatch: /office\.spec\.ts/ },
  ],
  webServer: {
    // Fresh, isolated demo database for every run; production build.
    command: `npm run build && MSW_DATA_DIR=.data-e2e npx tsx scripts/setup-demo.ts --reset && MSW_DATA_DIR=.data-e2e npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { MSW_MODE: "demo" },
  },
});
