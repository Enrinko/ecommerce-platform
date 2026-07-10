import { test, expect } from '@playwright/test';

// Regression for two coupled bugs found in manual testing:
//   E) Log out must clear the server refresh cookie, so a page reload cannot
//      silently revive the session through the refresh endpoint.
//   F) A guest cart must merge into the server cart on login.
test('logout survives reload and a guest cart merges on re-login', async ({ page }) => {
  const email = `e2e_authcart_${Date.now()}@example.com`;
  const password = 'secret123';

  // Register — auto-authenticates and lands on home.
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // Bug E: log out, then reload — the session must NOT come back. Assert at the
  // network boundary: the header shows the guest "Account" link during the brief
  // post-load `loading` window regardless of the bug, so a DOM check races. The
  // decisive signal is the silent-refresh response — after a real logout the
  // server cookie is gone, so /auth/refresh must be rejected.
  await page.getByRole('button', { name: /log out/i }).click();
  await expect(page.getByRole('link', { name: /account/i })).toBeVisible();

  const refreshAfterReload = page.waitForResponse((r) => r.url().includes('/auth/refresh'));
  await page.reload();
  const refreshResp = await refreshAfterReload;
  expect(refreshResp.ok()).toBe(false); // revived session (200) => logout failed to clear the cookie
  await expect(page.getByRole('link', { name: /account/i })).toBeVisible();

  // As a guest, add a known in-stock seeded product to the cart.
  await page.goto('/products/usb-c-cable');
  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('link', { name: /cart \[1\]/i })).toBeVisible();

  // Bug F: log in as the same user — the guest cart must merge server-side.
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL('/');

  // The badge now reflects the SERVER cart; the merged line must be present.
  await expect(page.getByRole('link', { name: /cart \[1\]/i })).toBeVisible();
});
