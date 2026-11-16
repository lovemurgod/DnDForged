import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sandboxDataDir = path.resolve(__dirname, 'test', 'fixtures', 'visual-sandbox-data');
const sandboxConfigFile = path.resolve(__dirname, 'test', 'fixtures', 'visual-sandbox-config.json');

export default defineConfig({
  testDir: './test/visual',
  snapshotDir: './test/visual/__snapshots__',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5051',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    bypassCSP: true,
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
      testIgnore: /.*mobile\.spec\.mjs/,
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 851 },
        isMobile: true,
        deviceScaleFactor: 1,
      },
      testMatch: /.*mobile\.spec\.mjs/,
    },
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:5051/vtt.html',
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      PORT: '5051',
      FORGEDVTT_DATA_DIR: sandboxDataDir,
      FORGEDVTT_CONFIG_FILE: sandboxConfigFile,
      NODE_ENV: 'test',
    },
  },
});
