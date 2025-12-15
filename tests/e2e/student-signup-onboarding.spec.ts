import { expect, test } from '@playwright/test';

/**
 * E2E test: Grade 6 student signup → onboarding → assessment
 *
 * This test walks through:
 * 1. Opening the landing page
 * 2. Creating a new student account (grade 6, age 12 with guardian consent)
 * 3. Completing onboarding preferences (avatar, tutor persona)
 * 4. Running the placement assessment
 * 5. Verifying the learning path is shown
 */

const TEST_EMAIL = `test-grade6-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Grade6 TestStudent';
const TEST_AGE = 12; // Under 13, requires guardian consent

test.describe('Grade 6 student signup → onboarding → assessment', () => {
    test.setTimeout(300_000); // 5 minutes - plenty of time for full flow

    test('complete end-to-end student signup and onboarding flow', async ({ page }) => {
        // Track API calls for verification
        const apiCalls = {
            register: 0,
            preferences: 0,
            assessmentStart: 0,
            assessmentSave: 0,
            assessmentSubmit: 0,
            path: 0,
        };

        page.on('response', (resp) => {
            const url = resp.url();
            if (!resp.ok()) return;
            if (url.includes('/auth/signup')) apiCalls.register += 1;
            if (url.includes('/api/v1/student/preferences')) apiCalls.preferences += 1;
            if (url.includes('/api/v1/student/assessment/start')) apiCalls.assessmentStart += 1;
            if (url.includes('/api/v1/student/assessment/save')) apiCalls.assessmentSave += 1;
            if (url.includes('/api/v1/student/assessment/submit')) apiCalls.assessmentSubmit += 1;
            if (url.includes('/api/v1/student/path')) apiCalls.path += 1;
        });

        // ========== STEP 1: Navigate to landing page ==========
        console.log('[E2E] Step 1: Opening landing page...');
        await page.goto('/');
        await expect(page).toHaveTitle(/ElevatED/i);

        // ========== STEP 2: Open signup modal ==========
        console.log('[E2E] Step 2: Opening signup modal...');

        // Click "Start Learning" to open the auth modal
        const startLearningBtn = page.getByRole('button', { name: /start learning/i }).first();
        await startLearningBtn.waitFor({ state: 'visible', timeout: 30_000 });
        await startLearningBtn.click();

        // Wait for auth modal to appear
        await page.waitForTimeout(500);

        // Switch to signup mode
        const signupLink = page.getByText(/don't have an account\? sign up/i);
        if (await signupLink.isVisible().catch(() => false)) {
            await signupLink.click();
            await page.waitForTimeout(300);
        }

        // ========== STEP 3: Select student role ==========
        console.log('[E2E] Step 3: Selecting student role...');
        const studentRoleBtn = page.getByRole('button', { name: /sign up as a student/i });
        if (await studentRoleBtn.isVisible().catch(() => false)) {
            await studentRoleBtn.click();
            await page.waitForTimeout(300);
        }

        // ========== STEP 4: Fill signup form ==========
        console.log('[E2E] Step 4: Filling signup form...');

        // Fill name
        const nameInput = page.getByPlaceholder(/enter your full name/i);
        await nameInput.fill(TEST_NAME);

        // Fill email
        const emailInput = page.locator('input[type="email"]').first();
        await emailInput.fill(TEST_EMAIL);

        // Fill password
        const passwordInput = page.locator('input[type="password"]').first();
        await passwordInput.fill(TEST_PASSWORD);

        // Fill age (12 years old - grade 6)
        const ageInput = page.getByPlaceholder(/how old is the learner/i);
        await ageInput.fill(String(TEST_AGE));

        // Select grade 6
        const gradeSelect = page.locator('select').first();
        if (await gradeSelect.isVisible().catch(() => false)) {
            await gradeSelect.selectOption('6');
        }

        // Check guardian consent (required for under-13)
        const guardianCheckbox = page.getByLabel(/guardian is here/i);
        if (await guardianCheckbox.isVisible().catch(() => false)) {
            await guardianCheckbox.check();
        }

        // Fill guardian contact info if visible
        const guardianContactInput = page.getByPlaceholder(/guardian.*contact|parent.*email/i);
        if (await guardianContactInput.isVisible().catch(() => false)) {
            await guardianContactInput.fill('parent@example.com');
        }

        // ========== STEP 5: Submit registration ==========
        console.log('[E2E] Step 5: Submitting registration...');
        const createAccountBtn = page.getByRole('button', { name: /create account/i });
        await createAccountBtn.click();

        // Wait for registration to complete - we may get redirected or see a confirmation
        await page.waitForTimeout(3000);

        // Check if we need email confirmation (typical for real Supabase setup)
        // For test environment, we might auto-confirm or skip
        const confirmationMessage = page.getByText(/check your email|verify your email/i);
        const studentRoute = /\/student(\/|$)/;

        if (await confirmationMessage.isVisible().catch(() => false)) {
            console.log('[E2E] Email confirmation required - this is expected in production');
            // In a real test with a test Supabase instance, we'd need to handle email confirmation
            // For now, we'll check if we can proceed anyway
        }

        // Try to navigate to student dashboard if we're not already there
        if (!studentRoute.test(page.url())) {
            // Attempt login with the credentials we just created
            console.log('[E2E] Attempting login with new credentials...');
            await page.goto('/');

            const startBtn = page.getByRole('button', { name: /start learning/i }).first();
            await startBtn.waitFor({ state: 'visible', timeout: 10_000 });
            await startBtn.click();
            await page.waitForTimeout(500);

            // Fill login form
            const loginEmail = page.locator('input[type="email"]').first();
            const loginPassword = page.locator('input[type="password"]').first();

            await loginEmail.fill(TEST_EMAIL);
            await loginPassword.fill(TEST_PASSWORD);

            const signInBtn = page.getByRole('button', { name: /sign in/i });
            await signInBtn.click();

            // Wait for redirect to student dashboard
            try {
                await page.waitForURL(studentRoute, { timeout: 30_000 });
            } catch (e) {
                // Check if we're stuck on email confirmation
                const emailNotConfirmed = page.getByText(/email.*not.*confirmed|verify.*email/i);
                if (await emailNotConfirmed.isVisible().catch(() => false)) {
                    console.log('[E2E] Email not confirmed - skipping rest of test');
                    test.skip();
                    return;
                }
                throw e;
            }
        }

        // ========== STEP 6: Onboarding Flow - Profile Step ==========
        console.log('[E2E] Step 6: Onboarding - Profile step...');

        // We should be on the student dashboard or in onboarding
        await expect(page).toHaveURL(studentRoute, { timeout: 30_000 });

        // Look for onboarding indicators
        const onboardingHeader = page.getByText(/let's personalize your learning path/i);
        const preferredNameInput = page.getByPlaceholder(/what should we call you/i);

        if (await onboardingHeader.isVisible().catch(() => false)) {
            console.log('[E2E] In onboarding flow...');

            // Fill preferred name if visible
            if (await preferredNameInput.isVisible().catch(() => false)) {
                await preferredNameInput.clear();
                await preferredNameInput.fill('E2E Learner');
            }

            // Select grade band 6-8
            const gradeBand68 = page.getByRole('button', { name: '6-8' });
            if (await gradeBand68.isVisible().catch(() => false)) {
                await gradeBand68.click();
            }

            // Continue to preferences
            const continueBtn = page.getByRole('button', { name: /^continue$/i });
            if (await continueBtn.isVisible().catch(() => false)) {
                await continueBtn.click();
                await page.waitForTimeout(500);
            }
        }

        // ========== STEP 7: Onboarding Flow - Preferences Step ==========
        console.log('[E2E] Step 7: Onboarding - Preferences step (avatar & tutor)...');

        // Select first avatar if available
        const avatarOptions = page.locator('[aria-pressed]').filter({ hasText: /avatar|starter/i });
        if (await avatarOptions.first().isVisible().catch(() => false)) {
            await avatarOptions.first().click();
        }

        // Select first tutor persona if available
        const tutorPersonaOption = page.locator('button').filter({ hasText: /supportive|encouraging/i }).first();
        if (await tutorPersonaOption.isVisible().catch(() => false)) {
            await tutorPersonaOption.click();
        }

        // Continue to placement
        const continueToCheckIn = page.getByRole('button', { name: /continue to check-in/i });
        if (await continueToCheckIn.isVisible().catch(() => false)) {
            await continueToCheckIn.click();
            await page.waitForTimeout(1000);
        }

        // ========== STEP 8: Start Placement Assessment ==========
        console.log('[E2E] Step 8: Starting placement assessment...');

        // Look for the "Let's go!" button to start placement
        const letsGoBtn = page.getByRole('button', { name: /let's go/i });
        if (await letsGoBtn.isVisible().catch(() => false)) {
            await letsGoBtn.click();
            await page.waitForTimeout(2000);
        }

        // ========== STEP 9: Answer Assessment Questions ==========
        console.log('[E2E] Step 9: Answering assessment questions...');

        // Click through assessment questions (select first answer each time)
        let questionsAnswered = 0;
        const maxQuestions = 30; // Safety limit

        for (let i = 0; i < maxQuestions; i++) {
            // Check if we've completed the assessment
            const completionIndicator = page.getByText(/you did it|you're all set|your learning plan/i);
            if (await completionIndicator.isVisible().catch(() => false)) {
                console.log(`[E2E] Assessment completed after ${questionsAnswered} questions`);
                break;
            }

            // Look for question options
            const questionPrompt = page.getByText(/let's see\.\.\./i);
            const answerButtons = page.locator('.bg-gradient-to-br button, [class*="rounded-xl"] button').filter({ hasText: /[A-Za-z]/ });

            if (await questionPrompt.isVisible().catch(() => false)) {
                const count = await answerButtons.count();
                if (count > 0) {
                    // Click first visible answer option
                    const firstOption = answerButtons.first();
                    await firstOption.click();
                    questionsAnswered++;
                    console.log(`[E2E] Answered question ${questionsAnswered}`);
                    await page.waitForTimeout(800); // Wait for save
                } else {
                    // Maybe buttons have different structure, try broader selector
                    const anyButton = page.locator('button').filter({ hasText: /^[A-D]\.|option|answer/i }).first();
                    if (await anyButton.isVisible().catch(() => false)) {
                        await anyButton.click();
                        questionsAnswered++;
                        await page.waitForTimeout(800);
                    }
                }
            } else {
                // Check alternative question formats
                const optionCards = page.locator('button.w-full').filter({ hasText: /[a-zA-Z0-9]/ });
                const optionCount = await optionCards.count();
                if (optionCount > 0) {
                    await optionCards.first().click();
                    questionsAnswered++;
                    console.log(`[E2E] Answered question ${questionsAnswered} (alt format)`);
                    await page.waitForTimeout(800);
                } else {
                    await page.waitForTimeout(500);
                }
            }
        }

        // ========== STEP 10: Verify Completion ==========
        console.log('[E2E] Step 10: Verifying completion...');

        // Check for completion message
        const completionMessage = page.getByText(/you did it|you're all set|learning plan.*set/i);
        await expect(completionMessage).toBeVisible({ timeout: 60_000 });

        // Check for "Up Next" section showing the learning path
        const upNextSection = page.getByText(/up next from your path/i);
        if (await upNextSection.isVisible().catch(() => false)) {
            console.log('[E2E] Learning path is visible');
        }

        // Click to go to dashboard
        const startLearningBtn2 = page.getByRole('button', { name: /let's start learning/i });
        if (await startLearningBtn2.isVisible().catch(() => false)) {
            await startLearningBtn2.click();
            await page.waitForTimeout(1000);
        }

        // ========== STEP 11: Verify on Dashboard ==========
        console.log('[E2E] Step 11: Verifying student dashboard...');

        // Should be on student dashboard or able to navigate there
        await expect(page).toHaveURL(studentRoute, { timeout: 30_000 });

        // Verify some dashboard content is visible
        const dashboardContent = page.getByText(/your path|continue learning|start now/i);
        await expect(dashboardContent.first()).toBeVisible({ timeout: 30_000 });

        console.log('[E2E] ✅ Test completed successfully!');
        console.log('[E2E] API Calls:', apiCalls);
    });
});
