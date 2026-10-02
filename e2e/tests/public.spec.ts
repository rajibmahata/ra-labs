import { test, expect } from '@playwright/test';

/**
 * Critical public-site smoke flows.
 * Requires: API running at http://localhost:5002 and web-public at :3004
 * (see docs/DEPLOYMENT.md), with the Vite dev proxy or gateway in place.
 */

test('homepage renders hero, agent panel, capabilities, and portfolio', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/R&A Labs|R.A Labs/);
  await expect(page.locator('h1').first()).toBeVisible();
  // Agent panel is the centerpiece of the hero
  await expect(page.locator('.hero-agent-wrapper .agent-panel').first()).toBeVisible();
  // Capabilities section present
  await expect(page.locator('#services')).toBeVisible();
  // Customer journey section present
  await expect(page.locator('#journey')).toBeVisible();
  // Portfolio preview loads real projects (wait for cards or empty state)
  await expect(page.locator('.portfolio-grid-enhanced, .state-placeholder').first()).toBeVisible({ timeout: 10000 });
});

test('portfolio detail opens from a project card', async ({ page }) => {
  await page.goto('/work');
  const first = page.locator('a[href*="/work/"]').first();
  // Wait for either real project cards or the empty state (async fetch).
  await expect(first.or(page.locator('.state-placeholder').first())).toBeVisible({ timeout: 10000 });
  if (!(await first.isVisible())) return; // Empty portfolio — nothing to click.
  await first.click();
  await expect(page).toHaveURL(/\/work\//);
});

test('team page lists members', async ({ page }) => {
  await page.goto('/team');
  await expect(page.locator('.team-grid, .state-placeholder').first()).toBeVisible({ timeout: 10000 });
});

test('contact form submits and shows success or validation error', async ({ page }) => {
  await page.goto('/contact');
  const name = page.locator('#contact-name');
  if ((await name.count()) === 0) {
    // No form on this layout — skip.
    test.skip();
  }
  await name.fill('Playwright Tester');
  await page.locator('#contact-info').fill('e2e@example.com');
  await page.locator('#contact-message').fill('E2E lead');
  await page.getByRole('button', { name: /send|submit/i }).first().click();
  // Either a success message or a validation/server error appears; neither a blank page.
  await expect(page.locator('[role="alert"], [role="status"], .form-success').first()).toBeVisible({ timeout: 10000 });
});
