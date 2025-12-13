import { expect, test } from '@playwright/test';

const runLive = process.env.RUN_E2E_LIVE === 'true';
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_PARENT_PASSWORD;
const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;

const shouldRunParent = runLive && Boolean(parentEmail && parentPassword);
const shouldRunStudent = runLive && Boolean(studentEmail && studentPassword);

const fillLoginForm = async (page: Parameters<typeof test>[0]['page'], email: string, password: string) => {
  const emailInputCandidates = [
    page.getByLabel('Email Address'),
    page.getByPlaceholder(/enter your email/i),
    page.locator('input[type="email"]'),
  ];
  const passwordInputCandidates = [
    page.getByLabel('Password'),
    page.getByPlaceholder(/^password$/i),
    page.locator('input[type="password"]'),
  ];

  let emailFilled = false;
  for (const locator of emailInputCandidates) {
    try {
      await locator.first().fill(email);
      emailFilled = true;
      break;
    } catch {
      // try next selector
    }
  }
  if (!emailFilled) throw new Error('Could not locate email input on auth modal.');

  let passwordFilled = false;
  for (const locator of passwordInputCandidates) {
    try {
      await locator.first().fill(password);
      passwordFilled = true;
      break;
    } catch {
      // try next selector
    }
  }
  if (!passwordFilled) throw new Error('Could not locate password input on auth modal.');
};

const login = async (
  page: Parameters<typeof test>[0]['page'],
  email: string,
  password: string,
) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start learning/i }).first().click();
  await fillLoginForm(page, email, password);
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
