import { expect, test } from '@playwright/test';

const runLive = process.env.RUN_E2E_LIVE === 'true';
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;

const shouldRunParent = runLive && Boolean(parentEmail && parentPassword);
const shouldRunStudent = runLive && Boolean(studentEmail && studentPassword);

const login = async (
  page: Parameters<typeof test>[0]['page'],
  email: string,
  password: string,
) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start learning/i }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
};

test.describe('live parent dashboard flows', () => {
  test.skip(!shouldRunParent, 'RUN_E2E_LIVE and parent creds required');
  test('parent dashboard shows assignments and billing actions', async ({ page }) => {
    await login(page, parentEmail as string, parentPassword as string);

    await expect(page).toHaveURL(/\/parent/);
    await expect(page.getByText(/Family dashboard/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /module assignments/i })).toBeVisible();

    const billingButton = page.getByRole('button', { name: /manage billing/i });
    await expect(billingButton).toBeVisible();
    await expect(page.getByRole('button', { name: /assign module/i })).toBeVisible();
  });
});

test.describe('live student AI tutor', () => {
  test.skip(!shouldRunStudent, 'RUN_E2E_LIVE and student creds required');
  test('student can open learning assistant and receive a response', async ({ page }) => {
    await page.route('**/api/v1/ai/tutor', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Here is a quick hint.',
          model: 'stubbed-model',
          remaining: 2,
          limit: 3,
          plan: 'individual-free',
        }),
      }),
    );

    await login(page, studentEmail as string, studentPassword as string);
    await expect(page).toHaveURL(/\/student/);

    await page.getByLabel(/open learning assistant/i).click();
    await page.getByLabel(/message the learning assistant/i).fill('How do I start my homework?');
    await page.getByLabel(/send learning assistant message/i).click();

    await expect(page.getByText('Here is a quick hint.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/chats left today/i)).toBeVisible();
  });
});
