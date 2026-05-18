import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PUMLV_E2E_PORT ?? 8766);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  timeout: 300_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    channel: "chrome",
    launchOptions: {
      // --disable-dev-shm-usage prevents Chrome from using /dev/shm (which is
      // small in Docker/CI containers) for shared memory; CheerpJ 4.x allocates
      // large SharedArrayBuffers for the JVM, so this avoids OOM hangs.
      args: ["--disable-dev-shm-usage"],
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
