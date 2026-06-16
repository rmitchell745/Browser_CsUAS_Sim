const { test, expect } = require('@playwright/test');

test('C-sUAS app loads and renders main UI', async ({ page }) => {
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/index.html');

  await expect(page.getByRole('heading', { name: /C-sUAS Tactical Simulator/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Run Single Scenario/i })).toBeVisible();
  await expect(page.locator('#status-text')).toContainText(/ready/i);

  expect(errors).toEqual([]);
});

test('single scenario run completes', async ({ page }) => {
  await page.goto('/index.html');

  await page.getByRole('button', { name: /Run Single Scenario/i }).click();

  await expect(page.locator('#status-text')).toContainText(/complete|ready|finished/i, {
    timeout: 15000
  });

  await expect(page.locator('#event-log')).not.toBeEmpty();
});
