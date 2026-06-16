const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  outputDir: './test-results',
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: false,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: true
  }
});
