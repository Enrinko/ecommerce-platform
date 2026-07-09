import { test, expect } from '@playwright/test';

test('mobile web boots and the login screen renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
});
