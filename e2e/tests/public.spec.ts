import { test, expect } from '@playwright/test';

/**
 * Critical public-site smoke flows.
 * Requires: API running at http://localhost:5002 and web-public at :3004
 * (see docs/DEPLOYMENT.md), with the Vite dev proxy or gateway in place.
 */

test('homepage renders hero, process, and portfolio', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/R&A Labs|R.A Labs/);
  await expect(page.locator('h1').first()).toBeVisible();
  // Process section present
  await expect(page.locator('#process')).toBeVisible();
  // Portfolio preview loads real projects (wait for cards or empty state)
  await expect(page.locator('.card-grid, .state-placeholder').first()).toBeVisible({ timeout: 10000 });
});

test('portfolio detail opens from a project card', async ({ page }) => {
  await page.goto('/work');
  const first = page.locator('a[href*="/work/"]').first();
  if ((await first.count()) === 0) {
    // Empty portfolio — assert the empty state renders instead.
    await expect(page.locator('.state-placeholder').first()).toBeVisible();
    return;
  }
  await first.click();
  await expect(page).toHaveURL(/\/work\//);
});

test('team page lists members', async ({ page }) => {
  await page.goto('/team');
  await expect(page.locator('.team-grid, .state-placeholder').first()).toBeVisible({ timeout: 10000 });
});

test('contact form submits and shows success or validation error', async ({ page }) => {
  await page.goto('/contact');
  const name = page.getByLabel(/name/i).first();
  if ((await name.count()) === 0) {
    // No form on this layout — skip.
    test.skip();
  }
  await name.fill('Playwright Tester');
  await page.getByLabel(/email/i).first().fill('e2e@example.com');
  await page.getByLabel(/message|project/i).first().fill('E2E lead');
  await page.getByRole('button', { name: /send|submit/i }).first().click();
  // Either a success message or a validation error appears; neither a blank page.
  await expect(page.locator('[role="alert"], .success, .state-placeholder').first()).toBeVisible({ timeout: 10000 });
});
