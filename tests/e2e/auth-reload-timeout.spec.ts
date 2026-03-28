import { expect, test } from '@playwright/test';

const runLive = process.env.RUN_E2E_LIVE === 'true';
const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;

const shouldRun = runLive && Boolean(studentEmail && studentPassword);
const authTimeoutPattern = /\[Auth\] Profile load timed out/i;

const getAuthDialog = (page: Parameters<typeof test>[0]['page']) =>
  page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /welcome back!/i }) }).first();

const fillLoginForm = async (
  page: Parameters<typeof test>[0]['page'],
  email: string,
  password: string,
) => {
  const dialog = getAuthDialog(page);
  const emailInput = dialog.locator('input[type="email"]').first();
  const passwordInput = dialog.locator('input[type="password"]').first();

  await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
};

const openLoginModal = async (page: Parameters<typeof test>[0]['page']) => {
  const dialog = getAuthDialog(page);
  const triggerCandidates = [
    page.getByRole('button', { name: /start learning today/i }),
    page.getByRole('button', { name: /get started/i }),
    page.getByRole('button', { name: /log in/i }),
  ];

  for (const trigger of triggerCandidates) {
    try {
      await trigger.first().click();
      await dialog.waitFor({ state: 'visible', timeout: 5_000 });
      await dialog.getByPlaceholder(/enter your email/i).waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch {
      // try next trigger
    }
  }

  throw new Error('Could not open the auth modal.');
};

const waitForStudentShell = async (page: Parameters<typeof test>[0]['page']) => {
  await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: /account and privacy settings/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/loading elevated/i)).toBeHidden({ timeout: 30_000 });
};

test.describe('auth session restore smoke', () => {
  test.skip(!shouldRun, 'RUN_E2E_LIVE with E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD required');

  test('student login and signed-in reload do not emit auth profile timeout warnings', async ({ page }) => {
    const authWarnings: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (authTimeoutPattern.test(text)) {
        authWarnings.push(text);
      }
    });

    await page.goto('/');
    await openLoginModal(page);
    await fillLoginForm(page, studentEmail as string, studentPassword as string);
    await getAuthDialog(page).getByRole('button', { name: /sign in/i }).click();

    await waitForStudentShell(page);

    await page.reload();
    await waitForStudentShell(page);

    expect(authWarnings).toEqual([]);
  });
});
