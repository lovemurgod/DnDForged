import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5052',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 10000,
        navigationTimeout: 15000
    },
    projects: [
        {
            name: 'desktop-chrome',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 900 },
                deviceScaleFactor: 1
            }
        },
        {
            name: 'mobile-chrome',
            use: {
                ...devices['Pixel 7'],
                viewport: { width: 393, height: 851 },
                isMobile: true,
                deviceScaleFactor: 1
            }
        }
    ],
    webServer: {
        command: 'node test/e2e/helpers/start-docs-server.mjs',
        url: 'http://127.0.0.1:5052/index.html',
        reuseExistingServer: false,
        timeout: 30000
    }
});
