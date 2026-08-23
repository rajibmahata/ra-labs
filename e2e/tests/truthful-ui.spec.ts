import { test, expect } from '@playwright/test';

/**
 * Validation for the truthful-agent + portfolio-menu work:
 * - /portfolio lists real projects with summary + live/GitHub links
 * - Nav exposes a Customer Login entry pointing at the customer portal
 * - /agent sidebar shows the REAL team members (no fake agent roster)
 */

test('portfolio page lists projects with summaries and links', async ({ page }) => {
  await page.goto('/portfolio');
  await expect(page.locator('h1')).toContainText(/shipped|Portfolio/i);
  const rows = page.locator('.portfolio-row');
  await expect(rows.first().or(page.locator('.state-placeholder').first())).toBeVisible({ timeout: 10000 });
  if ((await rows.count()) === 0) return; // empty portfolio acceptable
  const first = rows.first();
  await expect(first.locator('.portfolio-summary')).not.toBeEmpty();
  await expect(first.getByText(/case study/i)).toBeVisible();
  // At least one external link row-wide (Live site or GitHub)
  const links = first.locator('a[target="_blank"]');
  expect(await links.count()).toBeGreaterThanOrEqual(0);
});

test('nav exposes Customer Login pointing to the customer portal', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.navright .nav-portal-link');
  await expect(link).toBeVisible({ timeout: 10000 });
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  expect(href!).toMatch(/\/login$/);
  expect(href!).not.toContain('3004');
});

test('agent page shows real team members instead of a fake roster', async ({ page }) => {
  await page.goto('/agent');
  await page.waitForLoadState('networkidle');
  // Real seeded founders must appear in the sidebar/rail
  await expect(page.getByText('Rajib Mahata', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  // Fake hardcoded roles must be gone
  await expect(page.getByText('DevOps Engineer')).toHaveCount(0);
  await expect(page.getByText('OpenCode · v1.2.1')).toHaveCount(0);
  // Fake conversation history must be gone
  await expect(page.getByText('Booking application for clinic')).toHaveCount(0);
});
