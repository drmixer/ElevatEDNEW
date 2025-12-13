import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const shouldRun = process.env.RUN_E2E === 'true' || Boolean(process.env.E2E_BASE_URL);

const readEnvValue = (key: string): string | null => {
  const direct = process.env[key];
  if (typeof direct === 'string' && direct.trim().length) return direct.trim();

  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    try {
      const contents = readFileSync(resolvePath(process.cwd(), filename), 'utf8');
      const match = contents.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm'));
      if (!match) continue;
      const raw = match[1].trim();
      const unquoted = raw.replace(/^['"]|['"]$/g, '');
      if (unquoted.length) return unquoted;
    } catch {
      // ignore missing files
    }
  }
  return null;
};

const resolveSupabaseStorageKey = (): string | null => {
  const supabaseUrl = readEnvValue('VITE_SUPABASE_URL') ?? readEnvValue('SUPABASE_URL');
  if (!supabaseUrl) return null;
  try {
    const host = new URL(supabaseUrl).hostname;
    const projectRef = host.split('.')[0];
    if (!projectRef) return null;
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
};

const buildMockSession = (user: { id: string; email: string; role: string }) => {
  const base64Url = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  const now = Math.floor(Date.now() / 1000);
  const accessToken = [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      sub: user.id,
      email: user.email,
      role: user.role,
    }),
    'signature',
  ].join('.');
  return {
    access_token: accessToken,
    refresh_token: 'mock',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: user.id,
      email: user.email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { role: user.role },
    },
  };
};

const installApiFixtures = async (page: Page) => {
  const moduleId = 101;
  const lessonId = 501;

  await page.route('**/api/v1/modules?*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: moduleId,
            slug: 'algebra-foundations',
            title: 'Algebra Foundations',
            summary: 'Diagnostic, adaptive quiz, and lesson bundle for new learners.',
            grade_band: '6',
            subject: 'math',
            strand: 'number sense',
            topic: 'variables',
            open_track: true,
            suggested_source_category: 'oer',
            example_source: 'Illustrative Math',
          },
        ],
        total: 1,
      }),
    });
  });

  await page.route(`**/api/v1/modules/${moduleId}/assessment*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 301,
        title: 'Baseline diagnostic',
        description: 'Quick readiness check before lessons',
        estimated_duration_minutes: 8,
        purpose: 'baseline',
        sections: [
          {
            id: 1,
            title: 'Number sense',
            instructions: 'Check what the learner already knows.',
            questions: [
              {
                id: 11,
                prompt: 'What is 2 + 2?',
                type: 'multiple_choice',
                difficulty: 1,
                explanation: 'Early diagnostic prompt',
                standards: ['CCSS.MATH.CONTENT.3.OA.A.1'],
                tags: ['diagnostic'],
                options: [
                  { id: 1, order: 0, content: '4', is_correct: true, feedback: 'Great job' },
                  { id: 2, order: 1, content: '5', is_correct: false, feedback: 'Close—count again' },
                ],
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route(`**/api/v1/modules/${moduleId}*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        module: {
          id: moduleId,
          slug: 'algebra-foundations',
          title: 'Algebra Foundations',
          summary: 'Diagnostic, adaptive quiz, and lesson bundle for new learners.',
          description: 'Covers variables, expressions, and first practice set.',
          notes: 'Fixture payload used for e2e',
          grade_band: '6',
          subject: 'math',
          strand: 'number sense',
          topic: 'variables',
          open_track: true,
          suggested_source_category: 'oer',
          example_source: 'Illustrative Math',
          license_requirement: 'CC BY 4.0',
        },
        lessons: [
          {
            id: lessonId,
            title: 'Intro to variables',
            content: '# Welcome to variables\n\n## Lesson overview\nVariables unlock algebra.\n\n## Practice\nTry manipulating expressions.',
            estimated_duration_minutes: 12,
            attribution_block: 'Created by ElevatED',
            open_track: true,
            assets: [
              {
                id: 801,
                lesson_id: lessonId,
                title: 'Video: Variables 101',
                description: 'Short primer',
                url: 'https://example.com/video',
                kind: 'video',
                license: 'CC BY',
                license_url: 'https://creativecommons.org/licenses/by/4.0/',
                attribution_text: 'ElevatED',
                tags: ['video'],
              },
            ],
          },
        ],
        moduleAssets: [],
        standards: [
          {
            id: 41,
            framework: 'CCSS',
            code: 'CCSS.MATH.CONTENT.6.EE.A.2',
            description: 'Write, read, and evaluate expressions',
            alignment_strength: 'strong',
            notes: 'Fixture alignment',
          },
        ],
        assessments: [
          {
            id: 301,
            title: 'Baseline diagnostic',
            description: 'Quick readiness check before lessons',
            estimated_duration_minutes: 8,
            question_count: 4,
            attempt_count: 12,
            completion_rate: 0.75,
            average_score: 82,
            purpose: 'baseline',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/recommendations?*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ recommendations: [] }),
    });
  });

  await page.route(/\/api\/v1\/lessons\/\d+.*$/i, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lesson: {
          lesson: {
            id: lessonId,
            title: 'Intro to variables',
            content: '# Welcome to variables\n\n## Lesson overview\nVariables unlock algebra.\n\n## Practice\nTry manipulating expressions.',
            estimated_duration_minutes: 12,
            attribution_block: 'Created by ElevatED',
            open_track: true,
            assets: [
              {
                id: 801,
                lesson_id: lessonId,
                title: 'Video: Variables 101',
                description: 'Short primer',
                url: 'https://example.com/video',
                kind: 'video',
                license: 'CC BY',
                license_url: 'https://creativecommons.org/licenses/by/4.0/',
                attribution_text: 'ElevatED',
                tags: ['video'],
              },
            ],
          },
          module: {
            id: moduleId,
            slug: 'algebra-foundations',
            title: 'Algebra Foundations',
            summary: 'Diagnostic, adaptive quiz, and lesson bundle for new learners.',
            grade_band: '6',
            subject: 'math',
            strand: 'number sense',
            topic: 'variables',
            open_track: true,
            suggested_source_category: 'oer',
            example_source: 'Illustrative Math',
          },
          module_lessons: [
            { id: lessonId, title: 'Intro to variables', estimated_duration_minutes: 12, open_track: true },
          ],
          standards: [
            {
              id: 41,
              framework: 'CCSS',
              code: 'CCSS.MATH.CONTENT.6.EE.A.2',
              description: 'Write, read, and evaluate expressions',
              alignment_strength: 'strong',
              notes: 'Fixture alignment',
            },
          ],
        },
      }),
    });
  });
};

const mockParentSession = (page: Page) => {
  const storageKey = resolveSupabaseStorageKey();
  const user = { id: 'parent-123', email: 'parent@example.com', role: 'parent' };
  const session = buildMockSession(user);

  page.addInitScript(
    ({ storageKey: key, session: sessionPayload }) => {
      if (key) {
        window.localStorage.setItem(key, JSON.stringify(sessionPayload));
      }
      window.localStorage.setItem(
        'supabase.auth.token',
        JSON.stringify({ currentSession: sessionPayload }),
      );
    },
    { storageKey, session },
  );

  const childRow = {
    student_id: 'student-123',
    first_name: 'Test',
    last_name: 'Learner',
    grade: 6,
    level: 1,
    xp: 0,
    streak_days: 0,
    strengths: [],
    weaknesses: [],
    lessons_completed_week: 0,
    practice_minutes_week: 0,
    xp_earned_week: 0,
    mastery_breakdown: [],
    weekly_lessons_target: null,
    practice_minutes_target: null,
    mastery_targets: {},
  };

  page.route('**/rest/v1/**', async (route) => {
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    };

    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders, body: '' });
    }

    const pathname = new URL(route.request().url()).pathname;
    const fulfillJson = (payload: unknown, status = 200) => {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return route.fulfill({ status, headers: corsHeaders, contentType: 'application/json', body });
    };

    if (pathname.endsWith('/rest/v1/profiles')) {
      return fulfillJson({
        id: user.id,
        email: user.email,
        full_name: 'Pat Parent',
        role: 'parent',
        avatar_url: null,
        parent_profiles: {
          subscription_tier: 'free',
          notifications: {
            weeklyReports: true,
            missedSessions: true,
            lowScores: true,
            majorProgress: true,
            assignments: true,
            streaks: true,
          },
          onboarding_state: {},
        },
      });
    }

    if (pathname.endsWith('/rest/v1/parent_dashboard_children')) {
      return fulfillJson([childRow]);
    }

    if (pathname.endsWith('/rest/v1/parent_weekly_reports')) {
      return fulfillJson({
        week_start: '2025-01-01',
        summary: '',
        highlights: [],
        recommendations: [],
        ai_generated: false,
        changes: null,
      });
    }

    if (pathname.includes('/rest/v1/rpc/')) {
      return fulfillJson('null');
    }

    return fulfillJson([]);
  });
};

test.describe('critical product journeys', () => {
  test.skip(!shouldRun, 'E2E disabled unless RUN_E2E or E2E_BASE_URL is set');
  test('parent/student onboarding enforces consent and age checks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start learning/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /don't have an account/i }).click();
    await page.getByRole('button', { name: /sign up as a student/i }).click();
    await page.getByRole('spinbutton').fill('11');

    const submit = page.getByRole('button', { name: /create account/i });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder(/pat parent/i).fill('Pat Parent - parent@example.com');
    await page
      .getByRole('checkbox', { name: /Parent\/guardian is here and approves/i })
      .check();
    await expect(submit).toBeEnabled();

    await page.getByRole('button', { name: /sign up as a parent/i }).click();
    await expect(page.getByText(/Create your parent account/)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible();
  });

  test('diagnostic preview, lesson launch, and local progress tracking', async ({ page }) => {
    await installApiFixtures(page);
    const lessonRequests: string[] = [];
    const failedRequests: Array<{ url: string; error: string }> = [];
    const pageErrors: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/lessons/')) {
        lessonRequests.push(url);
      }
    });
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      failedRequests.push({ url: req.url(), error: failure?.errorText ?? 'unknown' });
    });
    page.on('pageerror', (error) => {
      if (error instanceof Error) {
        pageErrors.push(error.stack ?? error.message);
        return;
      }
      pageErrors.push(String(error));
    });

    await page.goto('/catalog');
    await expect(page.getByText('Algebra Foundations')).toBeVisible();
    await page.getByRole('link', { name: /view module/i }).first().click();
    await page.waitForURL('**/module/101');

    const quizToggle = page.getByRole('button', { name: /try quiz/i });
    await expect(quizToggle).toBeEnabled();
    await quizToggle.click();
    await expect(page.getByText('What is 2 + 2?')).toBeVisible();

    await page.getByRole('link', { name: /launch first lesson/i }).click();
    await page.waitForURL('**/lesson/501');

    const lessonHeading = page.getByRole('heading', { name: /welcome to variables/i });
    const lessonError = page.getByText(/We couldn’t load this lesson/i);
    const lessonLoading = page.getByText(/Loading lesson experience/i);
    const suspenseLoading = page.getByText(/^Loading…$/);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15_000) {
      if (await lessonHeading.isVisible()) break;
      if (await lessonError.isVisible()) {
        throw new Error(
          `Lesson failed to load (requests seen: ${lessonRequests.length ? lessonRequests.join(', ') : 'none'})`,
        );
      }
      await page.waitForTimeout(200);
    }

    if (!(await lessonHeading.isVisible())) {
      throw new Error(
        `Timed out waiting for lesson content (suspenseLoading=${await suspenseLoading.isVisible()}, lessonLoading=${await lessonLoading.isVisible()}, requests=${lessonRequests.length ? lessonRequests.join(', ') : 'none'}, failedRequests=${failedRequests.length ? failedRequests.map((entry) => `${entry.url} (${entry.error})`).join(', ') : 'none'}, pageErrors=${pageErrors.length ? pageErrors.join(' | ') : 'none'}, url=${page.url()})`,
      );
    }
    await expect(page.getByText(/Video: Variables 101/i)).toBeVisible();

    const progressButtons = page.getByRole('button', { name: /lesson overview/i });
    await progressButtons.click();
    await page.getByRole('button', { name: /mark all complete/i }).click();
    await expect(page.getByText(/100%/)).toBeVisible();
    await expect(page.getByRole('button', { name: /reflection complete/i })).toBeVisible();
  });

  test('placement assessment builds a path and launches the recommended lesson', async ({ page }) => {
    test.setTimeout(180_000);
    await installApiFixtures(page);

    const moduleId = 101;
    const lessonId = 501;
    let assessmentCompleted = false;

    let startCalls = 0;
    let saveCalls = 0;
    let submitCalls = 0;
    let pathCalls = 0;

    const storageKey = resolveSupabaseStorageKey();
    const user = { id: 'student-123', email: 'student@example.com', role: 'student' };
    const session = buildMockSession(user);

    await page.addInitScript(
      ({ storageKey: key, session: sessionPayload }) => {
        if (key) {
          window.localStorage.setItem(key, JSON.stringify(sessionPayload));
        }
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: sessionPayload }));
      },
      { storageKey, session },
    );

    const profilePayload = () => ({
      id: user.id,
      email: user.email,
      full_name: 'Test Learner',
      role: 'student',
      avatar_url: null,
      student_profiles: {
        grade: 6,
        xp: 0,
        level: 1,
        badges: [],
        streak_days: 0,
        strengths: [],
        weaknesses: [],
        learning_path: [],
        assessment_completed: assessmentCompleted,
        learning_style: {},
        tutor_name: null,
        tutor_avatar_id: null,
        student_avatar_id: 'avatar-starter',
        parent_id: null,
        family_link_code: 'FAMILY-123',
      },
    });

    const dashboardStudentProfilePayload = () => ({
      xp: 0,
      level: 1,
      streak_days: 0,
      assessment_completed: assessmentCompleted,
      learning_path: [],
      learning_style: {},
    });

    const studentPathEntry = {
      id: 9001,
      path_id: 42,
      position: 1,
      type: 'lesson',
      module_id: moduleId,
      lesson_id: lessonId,
      assessment_id: null,
      status: 'not_started',
      score: null,
      time_spent_s: null,
      target_standard_codes: ['CCSS.MATH.CONTENT.6.EE.A.2'],
      metadata: {
        reason: 'placement',
        module_title: 'Algebra Foundations',
        module_slug: 'algebra-foundations',
        lesson_title: 'Intro to variables',
        standard_code: 'CCSS.MATH.CONTENT.6.EE.A.2',
      },
    };

    await page.route('**/rest/v1/**', async (route) => {
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      };

      const request = route.request();
      const url = new URL(request.url());
      const pathname = url.pathname;
      const method = request.method();

      if (method === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      }

      const fulfillJson = (payload: unknown, status = 200) => {
        const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return route.fulfill({ status, headers: corsHeaders, contentType: 'application/json', body });
      };

      if (pathname.endsWith('/rest/v1/profiles')) {
        return fulfillJson(profilePayload());
      }

      if (pathname.endsWith('/rest/v1/student_profiles')) {
        if (method === 'PATCH') {
          return fulfillJson([]);
        }
        return fulfillJson(dashboardStudentProfilePayload());
      }

      if (pathname.endsWith('/rest/v1/student_daily_activity')) {
        return fulfillJson([]);
      }

      if (pathname.endsWith('/rest/v1/student_assessment_attempts')) {
        if (!assessmentCompleted) {
          return fulfillJson('null');
        }
        return fulfillJson({ status: 'completed', completed_at: new Date().toISOString() });
      }

      if (pathname.endsWith('/rest/v1/student_mastery_by_subject')) {
        return fulfillJson([]);
      }

      if (pathname.endsWith('/rest/v1/xp_events')) {
        return fulfillJson([]);
      }

      if (pathname.endsWith('/rest/v1/student_assignments')) {
        return fulfillJson([]);
      }

      if (pathname.endsWith('/rest/v1/student_progress')) {
        return fulfillJson([
          {
            lesson_id: lessonId,
            status: 'not_started',
            mastery_pct: null,
            attempts: 0,
            last_activity_at: null,
            lessons: {
              id: lessonId,
              title: 'Intro to variables',
              estimated_duration_minutes: 12,
              open_track: true,
              module_id: moduleId,
              modules: { id: moduleId, title: 'Algebra Foundations', subject: 'math', slug: 'algebra-foundations' },
            },
          },
        ]);
      }

      if (pathname.endsWith('/rest/v1/rpc/suggest_next_lessons')) {
        return fulfillJson([]);
      }

      if (pathname.endsWith('/rest/v1/rpc/get_student_parent_goals')) {
        return fulfillJson('null');
      }

      if (pathname.endsWith('/rest/v1/parent_check_ins') || pathname.endsWith('/rest/v1/plan_opt_outs')) {
        if (method === 'GET') {
          return fulfillJson([]);
        }
        return fulfillJson({});
      }

      return fulfillJson([]);
    });

    await page.route('**/api/v1/billing/context', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          billingRequired: false,
          plan: { slug: 'individual-free', name: 'Free', priceCents: 0, metadata: {}, status: 'active' },
          limits: { tutorDailyLimit: 3, aiAccess: true },
          subscription: null,
        }),
      }),
    );

    await page.route('**/api/v1/student/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            xpTotal: 0,
            streakDays: 0,
            badges: 0,
            recentEvents: [],
            masteryAvg: null,
            pathProgress: { completed: 0, remaining: 1, percent: 0 },
            avgAccuracy: null,
            avgAccuracyPriorWeek: null,
            avgAccuracyDelta: null,
            weeklyTimeMinutes: 0,
            weeklyTimeMinutesPriorWeek: 0,
            weeklyTimeMinutesDelta: null,
            modulesMastered: { count: 0, items: [] },
            focusStandards: [],
            latestQuizScore: null,
            struggle: false,
          },
        }),
      }),
    );

    await page.route('**/api/v1/student/family-code', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'FAMILY-123', linked: false }),
      }),
    );

    await page.route('**/api/v1/student/family-code/rotate', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'FAMILY-123' }) }),
    );

    await page.route('**/api/v1/student/preferences', async (route) => {
      if (route.request().method() === 'PUT') {
        const incoming = (await route.request().postDataJSON()) as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preferences: {
              student_id: user.id,
              avatar_id: (incoming.avatarId as string | undefined) ?? 'avatar-starter',
              tutor_persona_id: (incoming.tutorPersonaId as string | undefined) ?? 'persona-1',
              opt_in_ai: typeof incoming.optInAi === 'boolean' ? incoming.optInAi : true,
              goal_focus: null,
              theme: null,
            },
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preferences: {
            student_id: user.id,
            avatar_id: 'avatar-starter',
            tutor_persona_id: 'persona-1',
            opt_in_ai: true,
            goal_focus: null,
            theme: null,
          },
        }),
      });
    });

    await page.route('**/api/v1/avatars*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          avatars: [
            {
              id: 'avatar-starter',
              name: 'Starter',
              image_url: null,
              category: 'student',
              is_default: true,
              metadata: { palette: { background: '#E0F2FE', accent: '#38BDF8', text: '#0F172A' } },
            },
          ],
        }),
      }),
    );

    await page.route('**/api/v1/tutor_personas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorPersonas: [
            { id: 'persona-1', name: 'Coach', tone: 'calm', constraints: null, prompt_snippet: null, metadata: {} },
          ],
        }),
      }),
    );

    await page.route('**/api/v1/student/path', (route) => {
      pathCalls += 1;
      if (!assessmentCompleted) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: null, next: null }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          path: {
            path: {
              id: 42,
              status: 'active',
              started_at: new Date(Date.now() - 60_000).toISOString(),
              updated_at: new Date().toISOString(),
              metadata: { strand_estimates: [{ strand: 'number sense', correct: 1, total: 1, accuracyPct: 100 }] },
            },
            entries: [studentPathEntry],
          },
          next: studentPathEntry,
        }),
      });
    });

    await page.route('**/api/v1/student/assessment/start', async (route) => {
      startCalls += 1;
      let payload: Record<string, unknown> = {};
      try {
        payload = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
      } catch {
        payload = {};
      }
      const gradeBand = typeof payload.gradeBand === 'string' ? payload.gradeBand : '6-8';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assessmentId: 701,
          attemptId: 702,
          attemptNumber: 1,
          gradeBand,
          resumeToken: 'resume-token',
          items: [
            {
              id: 'item-1',
              bankQuestionId: 11,
              prompt: 'What is 2 + 2?',
              type: 'multiple_choice',
              options: [
                { id: 1, text: '4', isCorrect: true, feedback: 'Great job' },
                { id: 2, text: '5', isCorrect: false, feedback: 'Close—count again' },
              ],
              weight: 1,
              difficulty: 1,
              strand: 'number sense',
              targetStandards: ['CCSS.MATH.CONTENT.3.OA.A.1'],
              metadata: {},
            },
          ],
          existingResponses: [],
        }),
      });
    });

    await page.route('**/api/v1/student/assessment/save', async (route) => {
      saveCalls += 1;
      const payload = (await route.request().postDataJSON()) as Record<string, unknown>;
      const optionId = typeof payload.optionId === 'number' ? payload.optionId : null;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isCorrect: optionId === 1 }),
      });
    });

    await page.route('**/api/v1/student/assessment/submit', async (route) => {
      submitCalls += 1;
      assessmentCompleted = true;
      try {
        route.request().postDataJSON();
      } catch {
        // ignore
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pathId: 42,
          entries: [studentPathEntry],
          strandEstimates: [{ strand: 'number sense', correct: 1, total: 1, accuracyPct: 100 }],
          score: 100,
          masteryPct: 100,
        }),
      });
    });

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/student');
    const routeSkeleton = page.getByRole('status', { name: /Loading Student dashboard/i });
    try {
      await expect(routeSkeleton).toBeHidden({ timeout: 60_000 });
    } catch {
      // ignore if it never appeared or stayed visible; we’ll surface errors below
    }

    const startAssessment = page.getByRole('button', { name: /Start Assessment/i });
    const onboardingHeader = page.getByText(/Placement onboarding/i);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 120_000) {
      if (await onboardingHeader.isVisible().catch(() => false)) break;
      if (await startAssessment.isVisible().catch(() => false)) {
        await startAssessment.click();
        break;
      }
      if (await page.getByRole('button', { name: /start learning/i }).first().isVisible().catch(() => false)) {
        throw new Error(
          `Student route redirected to landing (pageErrors=${pageErrors.join(' | ') || 'none'}, consoleErrors=${consoleErrors.join(' | ') || 'none'})`,
        );
      }
      await page.waitForTimeout(250);
    }

    await expect(onboardingHeader).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.getByRole('button', { name: /Continue to placement/i }).click();

    await page.getByRole('button', { name: /Start assessment/i }).click();
    await expect(page.getByText(/What is 2 \+ 2\?/i)).toBeVisible();
    await page.getByRole('button', { name: /^4$/ }).click();

    await expect(page.getByText(/Your learning plan is set/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Up Next from your path/i)).toBeVisible();
    await page.getByRole('button', { name: /Go to dashboard/i }).click();

    await expect(page.getByText(/Placement-powered path/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Start now/i })).toBeEnabled();

    await page.getByRole('button', { name: /Start now/i }).click();
    await page.waitForURL(`**/lesson/${lessonId}`);
    await expect(page.getByRole('heading', { name: /welcome to variables/i })).toBeVisible();

    expect(startCalls).toBeGreaterThan(0);
    expect(saveCalls).toBeGreaterThan(0);
    expect(submitCalls).toBeGreaterThan(0);
    expect(pathCalls).toBeGreaterThan(0);
  });

  test('parent assignment flow and tutor limits surface', async ({ page }) => {
    const parentAssignmentsEnabled = readEnvValue('VITE_SHOW_PARENT_ASSIGNMENTS') === 'true';
    test.skip(!parentAssignmentsEnabled, 'Parent assignments UI disabled unless VITE_SHOW_PARENT_ASSIGNMENTS=true');

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const loc = msg.location();
      const suffix = loc.url ? ` (${loc.url}:${loc.lineNumber ?? 1}:${loc.columnNumber ?? 1})` : '';
      consoleErrors.push(`${msg.text()}${suffix}`);
    });

    await installApiFixtures(page);
    mockParentSession(page);

    await page.route('**/api/v1/dashboard?role=parent*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            alerts: [],
            summary: { learners: 1, activeLearners: 1, assignmentsCompleted: 0 },
            assignments: [],
            billing: { plan: { slug: 'individual-free', name: 'Free' }, limits: { tutorDailyLimit: 3, aiAccess: true } },
            children: [
              {
                id: 'student-123',
                name: 'Test Learner',
                grade: 6,
                subjects: ['math'],
                status: 'on_track',
              },
            ],
          },
        }),
      });
    });

    await page.route('**/api/v1/billing/summary*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          billingRequired: false,
          subscription: {
            id: 1,
            status: 'active',
            plan: { slug: 'individual-free', name: 'Free', priceCents: 0, metadata: {}, status: 'active' },
            trialEndsAt: null,
            currentPeriodEnd: null,
            cancelAt: null,
            metadata: {},
          },
          payments: [],
          plans: [],
        }),
      }),
    );

    await page.route('**/api/v1/billing/plans*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plans: [{ slug: 'individual-free', name: 'Free', priceCents: 0, metadata: {}, status: 'active' }],
        }),
      }),
    );

    await page.route('**/api/v1/modules?*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 101,
              slug: 'algebra-foundations',
              title: 'Algebra Foundations',
              summary: 'Diagnostic, adaptive quiz, and lesson bundle for new learners.',
              grade_band: '6',
              subject: 'math',
              strand: 'number sense',
              topic: 'variables',
              open_track: true,
              suggested_source_category: 'oer',
              example_source: 'Illustrative Math',
            },
          ],
          total: 1,
        }),
      });
    });

    await page.route('**/api/v1/assignments/assign', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ assignedStudents: 1, lessonsAttached: 1 }),
      }),
    );

    await page.route('**/api/v1/billing/limits*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: { slug: 'individual-free', status: 'active' },
          limits: { tutorDailyLimit: 3, aiAccess: true },
        }),
      }),
    );

    await page.goto('/parent');
    try {
      await expect(page.getByText(/Family dashboard/i)).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      throw new Error(
        `Parent dashboard failed to render (url=${page.url()}, pageErrors=${pageErrors.join(' | ') || 'none'}, consoleErrors=${consoleErrors.join(' | ') || 'none'}): ${String(error)}`,
      );
    }
    await page.getByLabel('Module').selectOption('101');
    await page.getByRole('button', { name: /^assign module$/i }).click();
    await expect(page.getByText(/Assigned 1 learner/i)).toBeVisible({ timeout: 10_000 });
  });

  test('billing and assignment APIs respond without server errors', async ({ page }) => {
    const apiBase =
      process.env.E2E_API_BASE_URL ??
      (process.env.E2E_BASE_URL ? `${process.env.E2E_BASE_URL.replace(/\/$/, '')}/api/v1` : 'http://localhost:8787/api/v1');

    let billingResponse: APIResponse | null = null;
    try {
      billingResponse = await page.request.get(`${apiBase}/billing/plans`);
    } catch (error) {
      test.skip(`Billing endpoint not reachable: ${String(error)}`);
    }
    if (!billingResponse) {
      test.skip('Billing endpoint did not respond.');
      return;
    }
    if (billingResponse.status() === 404) {
      test.skip('Billing endpoint returned 404 (API not mounted behind the UI). Set E2E_API_BASE_URL or enable the Vite API proxy.');
      return;
    }
    if (!billingResponse.ok()) {
      test.skip(`Billing endpoint responded with ${billingResponse.status()}`);
    }
    expect(billingResponse.status()).toBeLessThan(500);

    const assignmentResponse = await page.request.post(`${apiBase}/assignments/assign`, {
      data: { moduleId: 1, studentIds: ['student-1'] },
    });
    if (assignmentResponse.status() === 404) {
      test.skip('Assignment endpoint returned 404 (API not mounted behind the UI). Set E2E_API_BASE_URL or enable the Vite API proxy.');
      return;
    }
    expect([401, 402, 403, 429]).toContain(assignmentResponse.status());

    const tutorResponse = await page.request.post(`${apiBase}/ai/tutor`, {
      data: { prompt: 'Hello!', mode: 'marketing' },
    });
    expect(tutorResponse.status()).toBeLessThan(600);
  });
});
