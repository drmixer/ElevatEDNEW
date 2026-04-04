import { expect, test, type Page } from '@playwright/test';
import {
  dismissTutorOnboarding,
  loginStudent,
  resolveStudentIdFromStorage,
  shouldRunStudentLive,
  studentEmail,
  studentPassword,
} from './helpers/liveAuth';

const expectNoVisibleGradePlacementLanguage = async (page: Page) => {
  const visibleBodyText = await page.locator('body').innerText();
  expect(visibleBodyText).not.toMatch(/\bgrade\s+(k|[0-9]{1,2})(?!\s*[:a-z])/i);
  expect(visibleBodyText).not.toMatch(/\bgrade band\b/i);
  expect(visibleBodyText).not.toMatch(/\bworking level\b/i);
  expect(visibleBodyText).not.toMatch(/\bplacement level\b/i);
};

test.describe('live adaptive learner-safe UI', () => {
  test.skip(!shouldRunStudentLive, 'RUN_E2E_LIVE with E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD required');

  test('student dashboard and lesson stay neutral after an adaptive plan update', async ({ page }) => {
    test.setTimeout(180_000);

    await loginStudent(page, studentEmail as string, studentPassword as string);
    await dismissTutorOnboarding(page);

    const onboardingMarker = page.getByRole('heading', { name: /Let's personalize your learning path/i });
    const startAssessment = page.getByRole('button', { name: /Start Assessment/i });
    if ((await onboardingMarker.isVisible().catch(() => false)) || (await startAssessment.isVisible().catch(() => false))) {
      test.skip(true, 'Live student account is not fully onboarded.');
    }

    await expect(page.getByRole('heading', { name: /This week's plan/i })).toBeVisible({ timeout: 60_000 });

    const studentId = await resolveStudentIdFromStorage(page);
    await page.evaluate((id) => {
      window.sessionStorage.setItem(
        `adaptive-flash:${id}`,
        JSON.stringify({
          eventType: 'lesson_completed',
          createdAt: Date.now(),
          targetDifficulty: 2,
          misconceptions: ['6.NS.A.1'],
          nextReason: 'remediation',
          nextTitle: 'Review fractions foundations',
          primaryStandard: '6.NS.A.1',
        }),
      );
    }, studentId);

    await page.goto('/student');
    const flashBanner = page.getByText(/Plan updated for review/i);
    if (await flashBanner.isVisible().catch(() => false)) {
      await expect(
        page.getByText(/We added a short review on .* to help you solidify that concept\./i),
      ).toBeVisible({ timeout: 60_000 });
    }
    await expect(page.getByRole('heading', { name: /This week's plan/i })).toBeVisible();
    await expectNoVisibleGradePlacementLanguage(page);

    const startNow = page.getByRole('button', { name: /Start next lesson|Start Lesson|Start Learning/i }).first();
    await startNow.waitFor({ state: 'visible', timeout: 60_000 });
    await startNow.click();

    await page.waitForURL(/\/lesson\/\d+/, { timeout: 60_000 });
    await expect(page.getByText(/We couldn’t load this lesson/i)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 60_000 });
    await expectNoVisibleGradePlacementLanguage(page);
  });
});
