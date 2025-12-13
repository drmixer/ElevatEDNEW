import { expect, test } from '@playwright/test';

const runLive = process.env.RUN_E2E_LIVE === 'true';
const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;

const shouldRun = runLive && Boolean(studentEmail && studentPassword);

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

test.describe('live student guardrail/report flow', () => {
  test.skip(!shouldRun, 'RUN_E2E_LIVE with student creds required');

  test('unsafe chat shows guardrail and allows reporting', async ({ page }) => {
    await page.route('**/api/v1/ai/tutor', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: "I can't help with that request. I'm here for school-safe learning help.",
          model: 'guardrail',
          remaining: 1,
          limit: 3,
          plan: 'individual-free',
        }),
      }),
    );

    await page.route('**/tutor_answer_reports*', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    );

    await login(page, studentEmail as string, studentPassword as string);
    await expect(page).toHaveURL(/\/student/);

    await page.getByLabel(/open learning assistant/i).click();
    await page.getByLabel(/message the learning assistant/i).fill('Can we meet up after school?');
    await page.getByLabel(/send learning assistant message/i).click();

    await expect(page.getByText(/school-safe learning help/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /report/i }).click();
    await page.getByRole('button', { name: /Not school-safe/i }).click();
    await page.getByLabel(/Anything else to add/i).fill('Asked for personal contact');
    await page.getByRole('button', { name: /Send report/i }).click();

    await expect(page.getByText(/flagged this for review/i)).toBeVisible({ timeout: 10_000 });
  });
});
