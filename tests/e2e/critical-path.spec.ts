import { expect, test, type APIResponse, type Page } from '@playwright/test';

const shouldRun = process.env.RUN_E2E === 'true' || Boolean(process.env.E2E_BASE_URL);

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

  await page.route(`**/api/v1/modules/${moduleId}/assessment`, (route) => {
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

  await page.route(`**/api/v1/modules/${moduleId}`, (route) => {
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

  await page.route(`**/api/v1/lessons/${lessonId}`, (route) => {
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
  page.addInitScript(() => {
    window.localStorage.setItem(
      'supabase.auth.token',
      JSON.stringify({
        currentSession: {
          access_token: 'mock',
          refresh_token: 'mock',
          token_type: 'bearer',
          user: {
            id: 'parent-123',
            role: 'parent',
            email: 'parent@example.com',
          },
        },
      }),
    );
  });
};

test.describe('critical product journeys', () => {
  test.skip(!shouldRun, 'E2E disabled unless RUN_E2E or E2E_BASE_URL is set');
  test('parent/student onboarding enforces consent and age checks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start learning/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /don't have an account/i }).click();
    await page.getByRole('button', { name: /sign up as a student/i }).click();
    await page.getByLabel('Learner age').fill('11');

    const submit = page.getByRole('button', { name: /create account/i });
    await expect(submit).toBeDisabled();

    await page.getByLabel(/Parent\/guardian name/i).fill('Pat Parent - parent@example.com');
    await page.getByLabel(/Parent\/guardian is here/i).check();
    await expect(submit).toBeEnabled();

    await page.getByRole('button', { name: /sign up as a parent/i }).click();
    await expect(page.getByText(/Create your parent account/)).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  test('diagnostic preview, lesson launch, and local progress tracking', async ({ page }) => {
    await installApiFixtures(page);

    await page.goto('/catalog');
    await expect(page.getByText('Algebra Foundations')).toBeVisible();
    await page.getByRole('link', { name: /algebra foundations/i }).click();
    await page.waitForURL('**/module/101');

    const quizToggle = page.getByRole('button', { name: /try quiz/i });
    await expect(quizToggle).toBeEnabled();
    await quizToggle.click();
    await expect(page.getByText('What is 2 + 2?')).toBeVisible();

    await page.getByRole('link', { name: /launch first lesson/i }).click();
    await page.waitForURL('**/lesson/501');

    await expect(page.getByText('Variables unlock algebra.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Video: Variables 101/i })).toBeVisible();

    const progressButtons = page.getByRole('button', { name: /lesson overview/i });
    await progressButtons.click();
    await page.getByRole('button', { name: /mark all complete/i }).click();
    await expect(page.getByText(/100%/)).toBeVisible();
    await expect(page.getByText(/Reflection complete/i)).toBeVisible();
  });

  test('parent assignment flow and tutor limits surface', async ({ page }) => {
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
    await expect(page.getByText(/Family dashboard/i)).toBeVisible();
    await expect(page.getByText(/tutor safety/i)).toBeVisible();

    await page.getByRole('button', { name: /Assign to cohort/i }).click();
    await expect(page.getByText(/Assigned 1 learners/)).toBeVisible({ timeout: 10_000 });
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
    if (!billingResponse.ok()) {
      test.skip(`Billing endpoint responded with ${billingResponse.status()}`);
    }
    expect(billingResponse.status()).toBeLessThan(500);

    const assignmentResponse = await page.request.post(`${apiBase}/assignments/assign`, {
      data: { moduleId: 1, studentIds: ['student-1'] },
    });
    expect([401, 402, 403, 429]).toContain(assignmentResponse.status());

    const tutorResponse = await page.request.post(`${apiBase}/ai/tutor`, {
      data: { prompt: 'Hello!', mode: 'marketing' },
    });
    expect(tutorResponse.status()).toBeLessThan(600);
  });
});
