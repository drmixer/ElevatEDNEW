import { expect, test } from '@playwright/test';
const authTimeoutPattern = /\[Auth\] Profile load timed out/i;
import {
  loginStudent,
  shouldRunStudentLive,
  studentEmail,
  studentPassword,
  waitForStudentShell,
} from './helpers/liveAuth';

test.describe('auth session restore smoke', () => {
  test.skip(!shouldRunStudentLive, 'RUN_E2E_LIVE with E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD required');

  test('student login and signed-in reload do not emit auth profile timeout warnings', async ({ page }) => {
    const authWarnings: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (authTimeoutPattern.test(text)) {
        authWarnings.push(text);
      }
    });

    await loginStudent(page, studentEmail as string, studentPassword as string);

    await page.reload();
    await waitForStudentShell(page);

    expect(authWarnings).toEqual([]);
  });
});
