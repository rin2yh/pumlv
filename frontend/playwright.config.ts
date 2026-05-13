import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PUMLV_E2E_PORT ?? 8766);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    channel: "chrome",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `../pumlv --no-open --host 127.0.0.1 --port ${PORT} ../examples`,
    url: `http://127.0.0.1:${PORT}/api/files`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
