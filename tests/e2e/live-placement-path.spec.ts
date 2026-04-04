import { expect, test } from '@playwright/test';
import { dismissTutorOnboarding, loginStudent, shouldRunStudentLive, studentEmail, studentPassword } from './helpers/liveAuth';

test.describe('live placement → path → lesson', () => {
  test.skip(!shouldRunStudentLive, 'RUN_E2E_LIVE with E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD required');

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

    const onboardingMarker = page.getByRole('heading', { name: /Let's personalize your learning path/i });
    const startAssessment = page.getByRole('button', { name: /Start Assessment/i });

    const branchStartedAt = Date.now();
    let startedOnboarding = false;
    while (Date.now() - branchStartedAt < 60_000) {
      if (await onboardingMarker.isVisible().catch(() => false)) break;
      if (await startAssessment.isVisible().catch(() => false)) {
        await startAssessment.click();
        startedOnboarding = true;
        break;
      }
      await page.waitForTimeout(250);
    }

    if (startedOnboarding) {
      await expect(onboardingMarker).toBeVisible({ timeout: 60_000 });
    }

    if (await onboardingMarker.isVisible().catch(() => false)) {
      const preferredName = page.getByPlaceholder(/What should we call you\?/i);
      if (await preferredName.isVisible().catch(() => false)) {
        await preferredName.fill('Playwright Learner');
      }

      const continueButton = page.getByRole('button', { name: /^Continue$/ });
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click();
      }

      const continueToPlacement = page.getByRole('button', { name: /Continue to check-in/i });
      await continueToPlacement.waitFor({ state: 'visible', timeout: 30_000 });
      await continueToPlacement.click();

      const startPlacement = page.getByRole('button', { name: /Start mixed assessment/i });
      await startPlacement.waitFor({ state: 'visible', timeout: 60_000 });
      await startPlacement.click();

      // Click through placement questions by selecting the first visible option until completion.
      for (let attempts = 0; attempts < 80; attempts += 1) {
        const completionHeader = page.getByRole('heading', { name: /You're all set to start learning/i });
        if (await completionHeader.isVisible().catch(() => false)) break;

        const optionButtons = page.locator('button.w-full.text-left.border:not([disabled])');
        const count = await optionButtons.count();
        if (count > 0) {
          await optionButtons.first().click();
          await page.waitForTimeout(300);
          continue;
        }

        await page.waitForTimeout(250);
      }

      await expect(page.getByRole('heading', { name: /You're all set to start learning/i })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(/Personalized starting path/i).first()).toBeVisible();

      const goToDashboard = page.getByRole('button', { name: /Let's start learning!/i });
      await goToDashboard.click();
      await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
    } else {
      // Ensure we're on the student dashboard route even if login did not redirect cleanly.
      if (!/\/student(\b|\/|$)/.test(page.url())) {
        await page.goto('/student');
      }
    }

    await dismissTutorOnboarding(page);

    // Confirm the path is visible and launch the recommended lesson.
    const startNow = page.getByRole('button', { name: /Start next lesson|Start Lesson|Start Learning/i }).first();
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
