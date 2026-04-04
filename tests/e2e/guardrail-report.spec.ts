import { expect, test } from '@playwright/test';
import { dismissTutorOnboarding, login, shouldRunStudentLive, studentEmail, studentPassword } from './helpers/liveAuth';

test.describe('live student guardrail/report flow', () => {
  test.skip(!shouldRunStudentLive, 'RUN_E2E_LIVE with student creds required');

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

    await login(page, studentEmail as string, studentPassword as string, '/student');
    await expect(page).toHaveURL(/\/student/);
    await dismissTutorOnboarding(page);

    await page.getByRole('button', { name: /Start next lesson|Start Lesson|Start Learning/i }).first().click();
    await page.waitForURL(/\/lesson\/\d+/, { timeout: 60_000 });
    await page.getByLabel(/open learning assistant/i).click();
    await page.getByLabel(/message the learning assistant/i).fill('Can we meet up after school?');
    await page.getByLabel(/send learning assistant message/i).click();

    await expect(page.getByText(/school-safe learning help/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Report$/i }).last().click();
    await page.getByRole('button', { name: /Not school-safe/i }).click();
    await page.getByLabel(/Anything else to add/i).fill('Asked for personal contact');
    await page.getByRole('button', { name: /Send report/i }).click();

    await expect(page.getByText(/flagged this for review/i)).toBeVisible({ timeout: 10_000 });
  });
});
