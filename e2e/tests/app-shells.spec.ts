import { test, expect } from '@playwright/test';

const publicUrl = process.env.RALABS_PUBLIC_URL ?? 'http://localhost:3004';
const customerUrl = process.env.RALABS_CUSTOMER_URL ?? 'http://localhost:3002/customer';
const adminUrl = process.env.RALABS_ADMIN_URL ?? 'http://localhost:3005';

test.describe('customer portal shell', () => {
  test('login page renders accessible fields', async ({ page }) => {
    await page.goto(`${customerUrl}/login`);
    await expect(page).toHaveURL(/\/customer\/login/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });
});

test.describe('admin portal shell', () => {
  test('login page renders accessible fields', async ({ page }) => {
    await page.goto(`${adminUrl}/admin/login`);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: /r&a labs/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});

test.describe('responsive public shell', () => {
  test('homepage has no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(publicUrl);
    await expect(page.locator('h1').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
