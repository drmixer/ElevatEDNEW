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

const loginStudent = async (
  page: Parameters<typeof test>[0]['page'],
  email: string,
  password: string,
) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start learning/i }).first().click();
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
};

test.describe('live placement → path → lesson', () => {
  test.skip(!shouldRun, 'RUN_E2E_LIVE with E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD required');

  test('student completes placement (if needed) and launches recommended lesson', async ({ page }) => {
    test.setTimeout(240_000);

    let startOk = 0;
    let saveOk = 0;
    let submitOk = 0;
    let pathOk = 0;
    page.on('response', (resp) => {
      const url = resp.url();
      if (!resp.ok()) return;
      if (url.includes('/api/v1/student/assessment/start')) startOk += 1;
      if (url.includes('/api/v1/student/assessment/save')) saveOk += 1;
      if (url.includes('/api/v1/student/assessment/submit')) submitOk += 1;
      if (url.includes('/api/v1/student/path')) pathOk += 1;
    });

    await loginStudent(page, studentEmail as string, studentPassword as string);

    const maybeDismissModal = page.getByRole('button', { name: /close/i });
    if (await maybeDismissModal.isVisible().catch(() => false)) {
      await maybeDismissModal.click();
    }

    // If the account isn't yet onboarded, walk the placement onboarding flow.
    const onboardingMarker = page.getByText(/Placement onboarding/i);
    if (await onboardingMarker.isVisible().catch(() => false)) {
      const preferredName = page.getByPlaceholder(/What should we call you\?/i);
      if (await preferredName.isVisible().catch(() => false)) {
        await preferredName.fill('Playwright Learner');
      }

      const continueButton = page.getByRole('button', { name: /^Continue$/ });
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click();
      }

      const continueToPlacement = page.getByRole('button', { name: /Continue to placement/i });
      await continueToPlacement.waitFor({ state: 'visible', timeout: 30_000 });
      await continueToPlacement.click();

      const startPlacement = page.getByRole('button', { name: /Start assessment/i });
      await startPlacement.waitFor({ state: 'visible', timeout: 60_000 });
      await startPlacement.click();

      // Click through placement questions by selecting the first visible option until completion.
      for (let attempts = 0; attempts < 50; attempts += 1) {
        const completionHeader = page.getByText(/Your learning plan is set/i);
        if (await completionHeader.isVisible().catch(() => false)) break;

        const optionCard = page.getByText(/Strand:/i).locator('xpath=../..');
        const optionButtons = optionCard.getByRole('button');
        const count = await optionButtons.count();
        if (count > 0) {
          await optionButtons.first().click();
          await page.waitForTimeout(300);
          continue;
        }

        await page.waitForTimeout(250);
      }

      await expect(page.getByText(/Your learning plan is set/i)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/Up Next from your path/i)).toBeVisible();

      const goToDashboard = page.getByRole('button', { name: /Go to dashboard/i });
      await goToDashboard.click();
      await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
    } else {
      // Ensure we're on the student dashboard route even if login did not redirect cleanly.
      if (!/\/student(\b|\/|$)/.test(page.url())) {
        await page.goto('/student');
      }
    }

    // Confirm the path is visible and launch the recommended lesson.
    const startNow = page.getByRole('button', { name: /Start now/i });
    await startNow.waitFor({ state: 'visible', timeout: 60_000 });
    await startNow.click();

    await page.waitForURL(/\/lesson\/\d+/, { timeout: 60_000 });

    // Minimal sanity: lesson shell renders and we don't hit the hard error state.
    await expect(page.getByText(/We couldn’t load this lesson/i)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 60_000 });

    // If placement ran, we should have seen assessment and path endpoints.
    if (startOk + saveOk + submitOk > 0) {
      expect(startOk).toBeGreaterThan(0);
      expect(saveOk).toBeGreaterThan(0);
      expect(submitOk).toBeGreaterThan(0);
    }
    expect(pathOk).toBeGreaterThan(0);
  });
});

