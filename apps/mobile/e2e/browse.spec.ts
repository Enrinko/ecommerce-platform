import { test, expect } from '@playwright/test';

test('browses the catalog and opens a product', async ({ page }) => {
  // Seeded, known in-stock product; go straight to it so the walk is
  // independent of catalog ordering/pagination.
  await page.goto('/shop/usb-c-cable');
  await expect(page.getByText(/reviews/i).first()).toBeVisible();

  // And the catalog list renders.
  await page.goto('/shop');
  await expect(page.getByLabel(/search products/i)).toBeVisible();
});
