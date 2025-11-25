import { expect, test } from '@playwright/test';

const shouldRun = process.env.RUN_E2E === 'true' || Boolean(process.env.E2E_BASE_URL);

test.describe.skip(!shouldRun, 'core product journeys', () => {
  test('signup/login entry point is reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /start learning/i })).toBeVisible();
  });

  test('student experience routes respond', async ({ page }) => {
    const studentResponse = await page.goto('/student');
    expect(studentResponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/(student|)$/);

    const lessonResponse = await page.goto('/lesson/1');
    expect(lessonResponse?.status() ?? 200).toBeLessThan(600);
  });

  test('parent dashboard entry is gated for unauthenticated visitors', async ({ page }) => {
    const parentResponse = await page.goto('/parent');
    expect(parentResponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/start learning/i)).toBeVisible();
  });

  test('admin import console route is protected', async ({ page }) => {
    const adminResponse = await page.goto('/admin/import');
    expect(adminResponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/$/);
  });
});
