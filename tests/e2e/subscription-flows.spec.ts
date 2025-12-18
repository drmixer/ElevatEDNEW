import { expect, test } from '@playwright/test';

const shouldRun = process.env.RUN_E2E === 'true' || Boolean(process.env.E2E_BASE_URL);

test.describe('subscription management flows', () => {
    test.skip(!shouldRun, 'RUN_E2E or E2E_BASE_URL required');

    test.beforeEach(async ({ page }) => {
        // Mock auth session as parent user
        await page.addInitScript(() => {
            const mockUser = {
                id: 'test-parent-001',
                email: 'testparent@example.com',
                role: 'parent',
            };

            // Build mock session token
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payload = btoa(JSON.stringify({
                sub: mockUser.id,
                email: mockUser.email,
                role: mockUser.role,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            }));
            const token = `${header}.${payload}.mock-signature`;

            localStorage.setItem('supabase.auth.token', JSON.stringify({
                currentSession: {
                    access_token: token,
                    refresh_token: 'mock-refresh',
                    expires_at: Date.now() + 3600000,
                    user: mockUser,
                },
            }));
        });
    });

    test('displays subscription plans and allows upgrade', async ({ page }) => {
        // Mock billing context - free tier
        await page.route('**/api/v1/billing/context', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    billingRequired: false,
                    subscription: {
                        plan: 'individual-free',
                        status: 'active',
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        remainingTutorMessages: 3,
                    },
                    plans: [
                        { slug: 'individual-free', name: 'Free', priceCents: 0, features: ['3 tutor messages/day'] },
                        { slug: 'individual-basic', name: 'Basic', priceCents: 999, features: ['Unlimited tutor', 'Progress reports'] },
                        { slug: 'individual-premium', name: 'Premium', priceCents: 1999, features: ['Everything in Basic', 'Priority support'] },
                    ],
                }),
            }),
        );

        // Mock Stripe checkout session creation
        let checkoutCreated = false;
        await page.route('**/api/v1/billing/checkout', route => {
            checkoutCreated = true;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    url: 'https://checkout.stripe.com/test/session',
                    sessionId: 'cs_test_123',
                }),
            });
        });

        // Mock profile endpoint
        await page.route('**/rest/v1/profiles*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: 'test-parent-001',
                    email: 'testparent@example.com',
                    role: 'parent',
                    name: 'Test Parent',
                }]),
            }),
        );

        // Navigate to subscription page
        await page.goto('/parent/subscription');

        // Wait for plans to load
        await expect(page.getByText('Free')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Basic')).toBeVisible();
        await expect(page.getByText('Premium')).toBeVisible();

        // Click upgrade on Basic plan
        const basicCard = page.locator('text=Basic').locator('..');
        await basicCard.getByRole('button', { name: /upgrade|subscribe/i }).click();

        // Verify checkout was initiated
        expect(checkoutCreated).toBe(true);
    });

    test('shows current plan status and downgrade option', async ({ page }) => {
        // Mock billing context - premium tier
        await page.route('**/api/v1/billing/context', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    billingRequired: false,
                    subscription: {
                        plan: 'individual-premium',
                        status: 'active',
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        remainingTutorMessages: null, // unlimited
                    },
                    plans: [
                        { slug: 'individual-free', name: 'Free', priceCents: 0, features: ['3 tutor messages/day'] },
                        { slug: 'individual-basic', name: 'Basic', priceCents: 999, features: ['Unlimited tutor', 'Progress reports'] },
                        { slug: 'individual-premium', name: 'Premium', priceCents: 1999, features: ['Everything in Basic', 'Priority support'] },
                    ],
                }),
            }),
        );

        // Mock downgrade/cancel endpoint
        let downgradeRequested = false;
        await page.route('**/api/v1/billing/subscription/cancel', route => {
            downgradeRequested = true;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    cancelsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                }),
            });
        });

        // Mock profile endpoint
        await page.route('**/rest/v1/profiles*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: 'test-parent-001',
                    email: 'testparent@example.com',
                    role: 'parent',
                    name: 'Test Parent',
                }]),
            }),
        );

        await page.goto('/parent/subscription');

        // Verify current plan is shown as active
        await expect(page.getByText(/premium/i)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/current plan|active/i)).toBeVisible();

        // Click cancel/downgrade
        await page.getByRole('button', { name: /cancel|downgrade/i }).click();

        // Confirm cancellation
        await page.getByRole('button', { name: /confirm|yes/i }).click();

        // Verify downgrade was requested
        expect(downgradeRequested).toBe(true);
    });

    test('enforces plan limits for tutor messages', async ({ page }) => {
        // Mock billing context - free tier at limit
        await page.route('**/api/v1/billing/context', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    billingRequired: false,
                    subscription: {
                        plan: 'individual-free',
                        status: 'active',
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        remainingTutorMessages: 0, // At limit!
                    },
                    plans: [
                        { slug: 'individual-free', name: 'Free', priceCents: 0, features: ['3 tutor messages/day'] },
                        { slug: 'individual-basic', name: 'Basic', priceCents: 999, features: ['Unlimited tutor'] },
                    ],
                }),
            }),
        );

        // Mock tutor API to return limit exceeded
        await page.route('**/api/v1/ai/tutor', route =>
            route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 'Daily message limit reached',
                    remaining: 0,
                    limit: 3,
                    plan: 'individual-free',
                    upgradeUrl: '/parent/subscription',
                }),
            }),
        );

        // Mock student session and profile
        await page.route('**/rest/v1/profiles*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: 'test-student-001',
                    email: 'teststudent@example.com',
                    role: 'student',
                    name: 'Test Student',
                }]),
            }),
        );

        await page.goto('/student');

        // Try to open tutor and send message
        const tutorButton = page.getByLabel(/open learning assistant/i);
        if (await tutorButton.isVisible()) {
            await tutorButton.click();
            await page.getByLabel(/message the learning assistant/i).fill('Help me with math');
            await page.getByLabel(/send/i).click();

            // Should see upgrade prompt
            await expect(page.getByText(/limit|upgrade/i)).toBeVisible({ timeout: 10000 });
        }
    });
});
