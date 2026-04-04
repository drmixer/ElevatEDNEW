import { expect, type Locator, type Page } from '@playwright/test';

export const runLive = process.env.RUN_E2E_LIVE === 'true';
export const studentEmail = process.env.E2E_STUDENT_EMAIL;
export const studentPassword = process.env.E2E_STUDENT_PASSWORD;
export const parentEmail = process.env.E2E_PARENT_EMAIL;
export const parentPassword = process.env.E2E_PARENT_PASSWORD;

export const shouldRunStudentLive = runLive && Boolean(studentEmail && studentPassword);
export const shouldRunParentLive = runLive && Boolean(parentEmail && parentPassword);

export const getDefaultAuthDialog = (page: Page): Locator =>
  page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /welcome back!/i }) }).first();

export const openLoginModal = async (page: Page, dialog = getDefaultAuthDialog(page)) => {
  const triggerCandidates = [
    page.getByRole('button', { name: /start learning today/i }),
    page.getByRole('button', { name: /start learning/i }),
    page.getByRole('button', { name: /get started/i }),
    page.getByRole('button', { name: /log in/i }),
  ];

  for (const trigger of triggerCandidates) {
    try {
      await trigger.first().click();
      await dialog.waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch {
      // try next trigger
    }
  }

  throw new Error('Could not open the auth modal.');
};

export const fillLoginForm = async (page: Page, email: string, password: string, scope?: Locator) => {
  const root = scope ?? page;
  const emailInputCandidates = [
    root.getByLabel('Email Address'),
    root.getByPlaceholder(/enter your email/i),
    root.locator('input[type="email"]'),
  ];
  const passwordInputCandidates = [
    root.getByLabel('Password'),
    root.getByPlaceholder(/^password$/i),
    root.locator('input[type="password"]'),
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

export const login = async (page: Page, email: string, password: string) => {
  await page.goto('/');
  await openLoginModal(page);
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: /sign in/i }).click();
};

export const loginStudent = async (page: Page, email: string, password: string) => {
  await login(page, email, password);
  await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
};

export const waitForStudentShell = async (page: Page) => {
  await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: /account and privacy settings/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/loading elevated/i)).toBeHidden({ timeout: 30_000 });
};

export const resolveStudentIdFromStorage = async (page: Page): Promise<string> => {
  const resolved = await page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as
          | { currentSession?: { user?: { id?: string } }; user?: { id?: string } }
          | Array<{ currentSession?: { user?: { id?: string } }; user?: { id?: string } }>;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const nestedId = entry?.currentSession?.user?.id ?? entry?.user?.id;
            if (typeof nestedId === 'string' && nestedId.length > 0) return nestedId;
          }
          continue;
        }
        const id = parsed?.currentSession?.user?.id ?? parsed?.user?.id;
        if (typeof id === 'string' && id.length > 0) return id;
      } catch {
        // Ignore non-JSON values.
      }
    }
    return null;
  });

  if (!resolved) {
    throw new Error('Unable to resolve logged-in student id from localStorage.');
  }

  return resolved;
};
