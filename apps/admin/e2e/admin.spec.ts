import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'dev_admin_password_change_me';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Redirects to the dashboard on success.
  await expect(page).toHaveURL('/');
}

test('admin logs in and sees dashboard metrics', async ({ page }) => {
  await login(page);
  await expect(page.getByText(/revenue \(paid orders\)/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /recent orders/i })).toBeVisible();
});

test('admin creates a product and it appears in the table', async ({ page }) => {
  await login(page);

  const slug = `e2e-widget-${Date.now()}`;
  await page.goto('/products/new');
  await page.getByLabel(/title/i).fill('E2E Widget');
  await page.getByLabel(/slug/i).fill(slug);
  await page.getByLabel(/description/i).fill('Created by an admin E2E run');
  await page.getByLabel(/price/i).fill('3300');
  // Pick the first real category in the select.
  await page.getByLabel(/category/i).selectOption({ index: 1 });
  await page.getByRole('button', { name: /save product/i }).click();

  // Back to the products table with the new product listed.
  await expect(page).toHaveURL('/products');
  await expect(page.getByText('E2E Widget')).toBeVisible();
  await expect(page.getByText(slug)).toBeVisible();
});
