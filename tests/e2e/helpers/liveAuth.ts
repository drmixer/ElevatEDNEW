import { createClient, type Session } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

export const runLive = process.env.RUN_E2E_LIVE === 'true';
export const studentEmail = process.env.E2E_STUDENT_EMAIL;
export const studentPassword = process.env.E2E_STUDENT_PASSWORD;
export const parentEmail = process.env.E2E_PARENT_EMAIL;
export const parentPassword = process.env.E2E_PARENT_PASSWORD;
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export const shouldRunStudentLive = runLive && Boolean(studentEmail && studentPassword);
export const shouldRunParentLive = runLive && Boolean(parentEmail && parentPassword);

const getSupabaseProjectRef = () => {
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL for live E2E auth.');
  }

  const { hostname } = new URL(supabaseUrl);
  return hostname.split('.')[0];
};

const getSupabaseStorageKey = () => `sb-${getSupabaseProjectRef()}-auth-token`;

const createE2ESupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase anon credentials for live E2E auth.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export const createLiveSession = async (email: string, password: string): Promise<Session> => {
  const client = createE2ESupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed live E2E sign-in for ${email}: ${error.message}`);
  }
  if (!data.session) {
    throw new Error(`Supabase did not return a session for ${email}.`);
  }
  return data.session;
};

export const seedLiveSession = async (page: Page, session: Session) => {
  const storageKey = getSupabaseStorageKey();
  const serializedSession = JSON.stringify(session);

  await page.context().clearCookies();
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: serializedSession },
  );
};

export const login = async (page: Page, email: string, password: string, targetRoute = '/') => {
  const session = await createLiveSession(email, password);
  await seedLiveSession(page, session);
  await page.goto(targetRoute);
};

export const loginStudent = async (page: Page, email: string, password: string, targetRoute = '/student') => {
  await login(page, email, password, targetRoute);
  await page.waitForURL(/\/student(\b|\/|$)/, { timeout: 60_000 });
};

export const dismissTutorOnboarding = async (page: Page) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 4_000) {
    const skipButton = page.getByRole('button', { name: /Skip for now/i });
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
      return;
    }

    const closeButton = page.getByRole('button', { name: /^Close$/i });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      return;
    }

    await page.waitForTimeout(200);
  }
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
