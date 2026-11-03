import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: "list",
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      DEV_DATA_FILE: "work/browser-test-data.json",
      ADMIN_PHONE: "+919999999999",
      ADMIN_OTP_PROVIDER: "mock",
      ALLOW_DEV_OTP: "true",
      WHATSAPP_PROVIDER: "mock",
      WHATSAPP_APP_SECRET: "test-webhook-signing-secret",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-webhook-verify-token",
    },
  },
});
