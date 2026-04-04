import { expect, test } from '@playwright/test';
import {
  dismissTutorOnboarding,
  login,
  parentEmail,
  parentPassword,
  shouldRunParentLive,
  shouldRunStudentLive,
  studentEmail,
  studentPassword,
} from './helpers/liveAuth';

test.describe('live parent dashboard flows', () => {
  test.skip(!shouldRunParentLive, 'RUN_E2E_LIVE and parent creds required');
  test('parent dashboard shows learner overview and quick actions', async ({ page }) => {
    await login(page, parentEmail as string, parentPassword as string, '/parent');

    await expect(page).toHaveURL(/\/parent/);
    await expect(page.getByText(/Family dashboard/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /your children/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /quick actions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view details/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /add learner/i })).toBeVisible();
  });
});

test.describe('live student AI tutor', () => {
  test.skip(!shouldRunStudentLive, 'RUN_E2E_LIVE and student creds required');
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

    await login(page, studentEmail as string, studentPassword as string, '/student');
    await expect(page).toHaveURL(/\/student/);
    await dismissTutorOnboarding(page);

    await page.getByRole('button', { name: /Start next lesson|Start Lesson|Start Learning/i }).first().click();
    await page.waitForURL(/\/lesson\/\d+/, { timeout: 60_000 });
    await page.getByLabel(/open learning assistant/i).click();
    await page.getByLabel(/message the learning assistant/i).fill('How do I start my homework?');
    await page.getByLabel(/send learning assistant message/i).click();

    await expect(page.getByText('Here is a quick hint.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/chats left/i)).toBeVisible();
  });
});
