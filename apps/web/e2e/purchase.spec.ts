import { test, expect } from '@playwright/test';

test('guest adds to cart, registers, and checks out', async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  // Add a known in-stock seeded product to the guest cart (the catalog's newest
  // items can be zero-stock test artifacts, so target a seeded slug directly).
  await page.goto('/products/usb-c-cable');
  await page.getByRole('button', { name: /add to cart/i }).click();

  // Register (guest cart merges into the server cart on login).
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('secret123');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');

  // Checkout.
  await page.goto('/checkout');
  await page.getByLabel(/name/i).fill('E2E Tester');
  await page.getByLabel(/address/i).fill('1 Test Way');
  await page.getByRole('button', { name: /place order/i }).click();

  // Land on the order confirmation with a Paid status.
  await expect(page).toHaveURL(/\/account\/orders\/.+/);
  await expect(page.getByText(/thank you/i)).toBeVisible();
  await expect(page.getByText(/paid/i)).toBeVisible();
});
