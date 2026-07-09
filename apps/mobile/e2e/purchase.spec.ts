import { test, expect } from '@playwright/test';

test('guest adds to cart, registers, and checks out', async ({ page }) => {
  const email = `m2e_${Date.now()}@example.com`;

  // Add a seeded in-stock product to the guest cart from its product page.
  await page.goto('/shop/usb-c-cable');
  await page.getByText(/add to cart/i).click();

  // Visit the cart tab and confirm the guest line persisted (AsyncStorage writes
  // asynchronously on web; rendering it here also guarantees the flush before we
  // register and merge).
  await page.goto('/cart');
  await expect(page.getByText('USB-C Cable')).toBeVisible();

  // Register (guest cart merges into the server cart on sign-up).
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('secret123');
  await page.getByRole('button', { name: /create account/i }).click();
  // Registration awaits the guest-cart merge, then redirects to Shop; wait for
  // that so the server cart is populated before we check out.
  await expect(page).toHaveURL(/\/shop/);

  // Go to checkout and place the order.
  await page.goto('/checkout');
  await page.getByLabel(/name/i).fill('E2E Buyer');
  await page.getByLabel(/address/i).fill('1 Test Way');
  await page.getByText(/place order/i).click();

  // On success the checkout routes away from /checkout (to the account tab).
  await expect(page).not.toHaveURL(/\/checkout$/);
});
