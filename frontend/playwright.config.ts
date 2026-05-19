import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PUMLV_E2E_PORT ?? 8766);
const CHROMIUM_EXECUTABLE = process.env.PUMLV_E2E_CHROMIUM ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    ...(CHROMIUM_EXECUTABLE ? {} : { channel: "chrome" }),
    launchOptions: {
      args: ["--disable-dev-shm-usage"],
      ...(CHROMIUM_EXECUTABLE ? { executablePath: CHROMIUM_EXECUTABLE } : {}),
    },
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
