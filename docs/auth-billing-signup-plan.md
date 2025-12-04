# ElevatED Auth, Signup, and Plans Roadmap

End‑to‑end plan to make self‑serve parent and student signup reliable, integrate email verification, and wire in per‑individual plans (Free / Pro / Premium) with future multi‑student discounts.

---

## Phase 1 — Fix Auth Loop & Email Verification

Goal: After signup, users don’t get bounced back to “sign in”; email confirmation and session handling behave predictably for both parents and students.

- **1.1 Verify Supabase auth configuration**
  - Confirm email confirmations are enabled for new users.
  - Ensure redirect URL includes `https://<app-domain>/auth/callback`.
  - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` point at the same Supabase project as our migrations.

- **1.2 Clarify signup outcomes in the UI**
  - `AuthContext.register` currently throws a “check your email” message when Supabase returns no session (pending email confirmation).
  - Update `AuthModal` to:
    - Distinguish between “hard error” and “sign‑up successful, email confirmation required”.
    - Show a clear “Check your email to confirm your account” state instead of looking like a failure.
    - Keep the modal open and avoid silently dropping the user back into the login form without context.

- **1.3 Add `/auth/callback` handler route**
  - Introduce a lightweight React route at `/auth/callback` that:
    - Renders a “Verifying your email…” screen.
    - Relies on `supabaseClient` (`detectSessionInUrl: true`) to process the URL hash, then calls `useAuth().refreshUser()`.
    - Once a user is loaded, redirects to the appropriate dashboard (`/parent` or `/student` via `roleHome`).

- **1.4 Confirm session restore on refresh**
  - Validate `AuthProvider`’s `getSession` + `onAuthStateChange` logic restores the user on page load before rendering the landing page.
  - Keep the existing loading/splash state until auth initialization finishes, so users don’t briefly see the unauthenticated landing page.

- **1.5 Handle change-email re-verification on login**
  - When a user changes their email and then tries to log in before confirming the new address (Supabase `email_not_confirmed`), show targeted messaging on the login screen: “You changed your email to <new-email>; confirm it to continue.”
  - Add a “Resend confirmation” action that calls `auth.resend({ type: 'email_change', email: newEmail })`, surfaces rate-limit errors, and records `auth_login_email_not_confirmed` via `recordReliabilityCheckpoint`.
  - Keep the user on the login form with the new email prefilled; provide a support link if the new address is unreachable.

- **1.6 Add a global “resend verification” entry point**
  - On the landing/sign-in page, expose a small “Didn’t get a verification email?” entry point that accepts an email and role, then calls `auth.resend({ type: 'signup', email, options })` with the same redirect URL used at signup.
  - Keep responses non-enumerating (“If an account exists, we’ve sent a new link”), throttle resends, and show a short-lived success banner.
  - Reuse this path from the change-email messaging in 1.5 so users can recover without digging through the modal flow.

**Outcome:** Parents and students can sign up, see explicit “check your email” instructions, resend verification globally, recover from change-email re-verification, and land in the correct dashboard without the current “sign in again” loop.

---

## Phase 2 — Student Data Model for Self‑Serve Signup

Goal: Make student self‑signup work cleanly with the existing schema, which currently assumes all students belong to a “parent” for billing and dashboards.

- **2.1 Decide student billing model**
  - **Option A — Student as their own payer (recommended for minimal schema change):**
    - Every account that can pay (including self‑serve students) has a row in `parent_profiles`.
    - `student_profiles.parent_id` can point at either a “real” parent or the student’s own `parent_profiles` row.
  - **Option B — Independent students without a parent:**
    - Relax `student_profiles.parent_id` NOT NULL constraint.
    - Update queries/views that assume a parent exists (dashboard, billing context, guardian links).
  - Document the decision and downstream implications for billing and dashboards.

- **2.2 Extend `handle_new_auth_user` to create student_profiles**
  - Today `public.handle_new_auth_user`:
    - Creates/updates `profiles` based on `raw_user_meta_data->>'role'`.
    - Creates `parent_profiles` only when `resolved_role = 'parent'`.
  - Update this function (via a new migration) to:
    - For `resolved_role = 'student'`, insert a minimal `student_profiles` row:
      - `id = new.id`.
      - `first_name` from metadata or derived from email.
      - `grade_level` / `grade` from metadata when available; otherwise sensible defaults.
      - `learning_style` as empty JSON.
      - Ensure `family_link_code` defaults are respected (from migration 014).
    - Set `parent_id` according to the chosen model:
      - Option A: create a corresponding `parent_profiles` row for the student as payer and set `parent_id = new.id`.
      - Option B: allow `parent_id` to be null after relaxing the constraint.

- **2.3 Confirm profile fetching still works**
  - `fetchUserProfile` already:
    - Joins `profiles` with `student_profiles`, `parent_profiles`, and `admin_profiles`.
    - Normalizes into `Student` or `Parent` based on `profiles.role`.
  - Validate:
    - Self‑serve students get a valid `Student` object even when there is no separate “guardian” parent.
    - Creating a `parent_profiles` row for a student (Option A) does not change the `role` returned; role continues to come from `profiles.role`.

**Outcome:** Every student signup results in a usable `student_profiles` row. Self‑serve students can immediately use adaptive paths and dashboards, and the billing “owner” story is clear.

---

## Phase 3 — Role‑Specific Signup Flows (Parent vs Student)

Goal: Implement the exact flows for parent and student signup, including age/consent rules and correct landing pages.

- **3.1 Parent signup UX**
  - Flow:
    1. User selects “I’m a parent” in `AuthModal`.
    2. Enters name, email, password.
    3. `register(email, password, name, 'parent', …)` calls Supabase `signUp`.
    4. If email confirmation is required, show the dedicated “check your email” state.
    5. After clicking the verification link, `/auth/callback` resolves the session and redirects to `/parent`.
  - Implementation details:
    - Confirm `AuthModal` passes `role='parent'`.
    - Confirm `profiles.role` is `parent` and `parent_profiles` is created by the trigger.
    - Ensure `/parent` is protected by `ProtectedRoute` and renders `ParentDashboard`.

- **3.2 Student signup UX**
  - Flow:
    1. User selects “I’m a student” in `AuthModal`.
    2. Enters name, email, password, age, and optional guardian contact.
    3. Under‑13: require guardian consent checkbox and enforce it in both `AuthModal` and `register`.
    4. Complete Supabase `signUp` with consent metadata (actor, timestamps, contact).
    5. Email verification + `/auth/callback` → redirect to `/student` (StudentDashboard).
  - Implementation details:
    - Confirm `role='student'` and consent metadata are correctly passed from `AuthModal` to `register`.
    - Ensure `student_profiles` exists (Phase 2) and that `StudentDashboard` does not assume a parent/link exists yet.
    - Later: enable parent linking via `family_link_code` and `link_guardian_with_code` when a guardian signs up.

- **3.3 Error messaging and observability**
  - Differentiate common failure states:
    - Email already in use.
    - Invalid credentials.
    - Email not confirmed yet.
  - Use existing `recordReliabilityCheckpoint` calls to record:
    - `auth_register` success/failure, including `role` and consent signals.
    - `auth_login` failures (with safe metadata only).

**Outcome:** Parents and students each get a clear path: signup → email verification → appropriate dashboard, with age and consent rules correctly enforced.

---

## Phase 4 — Plan Selection After Signup

Goal: After a new account is verified, users are guided through picking a plan (even if billing is bypassed in dev), instead of silently falling into a default.

- **4.1 Clarify who owns subscriptions**
  - Parents:
    - Subscriptions are keyed off `parent_profiles.id` (existing billing implementation).
    - Plan selection happens early in the parent experience (first login or onboarding flow in `ParentDashboard`).
  - Self‑serve students:
    - If we adopt Option A (student as payer), reuse the same subscription model keyed on their `parent_profiles` row.
    - If we adopt Option B (no parent profile), we will need a dedicated path for student subscriptions or a generalized “payer profile”.

- **4.2 Use existing billing APIs and service functions**
  - Backend routes already exist:
    - `/api/v1/billing/plans` returns active plans.
    - `/api/v1/billing/summary` returns subscription + payments for parents.
    - `/api/v1/billing/context` returns effective plan + limits for any authenticated user (parent or student).
    - `/api/v1/billing/checkout` and `/api/v1/billing/portal` manage Stripe checkout/portal.
  - Frontend services:
    - `fetchBillingPlans`, `fetchBillingSummary`, `fetchBillingContext`, `startCheckoutSession`, `openBillingPortal` are all implemented.
  - Plan:
    - For new parents with no subscription, redirect `/parent` → an onboarding step or `/parent/choose-plan` that uses `availablePlans` from `EntitlementsContext`.
    - For self‑serve students, optionally add `/student/choose-plan` powered by `fetchBillingContext`.

- **4.3 Integrate sandbox/bypass mode for testing**
  - Use `BILLING_SANDBOX_MODE` and `isBillingBypassed` to:
    - Allow dev/staging environments to “activate” a plan without touching Stripe.
    - Keep the same `/billing/checkout` API and `startCheckoutSession(planSlug)` client interface.
  - UX:
    - In sandbox/bypass mode, clicking a plan card immediately grants the subscription and navigates back to the dashboard with a clear “Plan activated (sandbox)” banner.

- **4.4 Admin‑controlled billing switch (feature flag)**
  - Introduce a platform configuration flag, e.g. `billing.enabled` or `billing.require_subscription`, stored in the existing platform config system.
  - Behaviour when **billing is disabled**:
    - Signup and login flows work without requiring users to pick a plan or complete checkout.
    - All plan/entitlement checks treat users as having at least a baseline plan (e.g. “individual-free” or a special “dev-premium” profile) so features aren’t blocked.
    - Billing UI (plan picker, upgrade prompts) can be hidden or marked as “coming soon”.
  - Behaviour when **billing is enabled**:
    - New parents/students are guided through the plan selection flow defined in 4.1–4.3.
    - Existing subscriptions remain honored; the flag only controls whether subscription is required/blocking.
  - Wire this flag through:
    - Server: key billing enforcement checks (e.g. AI tutor access, `/billing/checkout` guardrails) read the flag in addition to `BILLING_SANDBOX_MODE`.
    - Client: `EntitlementsContext` and plan‑selection UX read the flag to decide whether to prompt for a plan or silently fall back to a default.

- **4.5 Admin Dashboard control surface**
  - Use the existing Admin Dashboard (`src/components/Admin/AdminDashboard.tsx`) as the control surface for this flag:
    - Add a simple toggle in the “config” section to switch billing on/off (backed by `updatePlatformConfig`).
    - Show the current billing mode (e.g. “Billing: Off (users can sign up and use immediately)” vs “Billing: On (plan required)”).
    - Log changes via the existing admin audit logging (`logAdminAuditEvent`) with metadata (actor, previous→new state).
  - If we ever deploy to an environment without the Admin Dashboard:
    - Create a minimal admin settings page gated behind the `admin` role that exposes at least this billing toggle.
    - Reuse the same platform config key so behaviour is consistent across environments.

**Outcome:** New accounts are funneled into an explicit plan choice backed by existing billing APIs, with a safe bypass for testing environments.

---

## Phase 5 — Plan & Pricing Design (Free / Pro / Premium + Multi‑Student Discounts)

Goal: Replace current “family” plans with per‑individual Free / Pro / Premium offerings, and prepare for multi‑student discounts when a payer manages multiple students.

- **5.1 Define new plans in the `plans` table**
  - Introduce three core plans:
    - `individual-free`: basic features, limited usage, 0¢.
    - `individual-pro`: better features and limits, e.g. 699¢ ($6.99)/month.
    - `individual-premium`: all features and unlimited use, e.g. 999¢ ($9.99)/month.
  - Store capabilities in `plans.metadata`, e.g.:
    - `lesson_limit`, `ai_tutor_daily_limit`.
    - Flags like `advanced_analytics`, `weekly_ai_summaries`, `weekly_digest`.
    - Discount configuration, such as:
      - `second_student_discount_pct`, `third_plus_student_discount_pct`.
  - Decide how to treat existing `family-*` plans:
    - Keep them for legacy users but hide from new signups, or
    - Migrate existing subscriptions to equivalent `individual-*` plans.

- **5.2 Update server‑side limits and entitlements**
  - `server/billing.ts`:
    - Update or generalize `planLimits` to understand `individual-*` slugs and/or use plan metadata to drive limits.
  - `src/lib/entitlements.ts`:
    - Replace `DEFAULT_PLAN_CONFIG` keys with `individual-*` slugs.
    - Set:
      - `seatLimit: 1` for individual plans.
      - Appropriate `lessonLimit`, `aiTutorDailyLimit`, and tiers (`free`, `plus`, `premium`).
    - Let `priceCents` come from `plan.price_cents` with sane defaults.

- **5.3 Represent multi‑student discounts**
  - Data model:
    - Use `plans.metadata` to capture discount rules (e.g., % off for second and third+ students).
    - Optionally add a helper view or function to compute an effective per‑student price for a given parent’s child count.
  - Stripe integration (MVP wiring):
    - Initially, keep Stripe simple (one flat price per plan, quantity = number of students) and rely on sandbox bypass for testing.
    - Later, introduce:
      - Tiered Stripe pricing, or
      - Multiple price IDs per plan (e.g., base + discounted add‑ons) mapped from metadata.

- **5.4 Parent dashboard plan UX**
  - Use `availablePlans` from `EntitlementsContext` in `ParentDashboard` to:
    - Display Free/Pro/Premium with prices and high‑level features.
    - Show an “estimated monthly total” based on:
      - Current or target number of linked students.
      - Discount rules from plan metadata.
  - Keep the UI per‑individual (no explicit “family plan” language), but surface the effect of adding more students via discounts.

**Outcome:** The data model and UI reflect Free / Pro / Premium per‑individual plans with coherent pricing and a path to implement real multi‑student discounts in Stripe.

---

## Phase 6 — Testing, Rollout, and Guardrails

Goal: Ship the new auth and plan flows safely, with confidence that they work across roles and environments.

- **6.1 Automated tests**
  - Extend existing tests for:
    - `AuthModal` (already tested) to cover:
      - Under‑13 vs 13+ consent logic.
      - “Check your email” success state after signup.
    - Trigger‑driven profile creation:
      - New student signup → `profiles` + `student_profiles` (and optionally `parent_profiles`) rows exist with expected defaults.
    - Billing context:
      - Parent with active subscription.
      - Student linked to a parent.
      - Self‑serve student without a parent (depending on the chosen model).
    - Entitlements mapping:
      - Free / Pro / Premium produce expected limits and flags.

- **6.2 Staging validation**
  - Deploy the changes to a staging environment wired to a staging Supabase project and (optionally) a test Stripe account.
  - Manually verify:
    - Parent and student signup flows end‑to‑end (including email verification).
    - Plan selection and entitlements on both dashboards.
    - Guardian linking using `family_link_code` where applicable.

- **6.3 Production rollout strategy**
  - Migration considerations:
    - Map existing “family” subscriptions to new plans or keep compatibility logic for legacy users.
    - Avoid forcing existing users through new signup or plan‑selection flows.
  - Observability:
    - Ensure `recordReliabilityCheckpoint` and server logs capture:
      - Signup failures by role.
      - Plan selection and checkout errors.
    - Add lightweight dashboards/alerts for spikes in auth or billing errors.

**Outcome:** The new signup and plan flows are well-tested, validated in staging, and rolled out with observability so regressions are caught quickly.

---

## Phase 7 — Account Deletion & Erasure Requests

Goal: Give parents a clear, compliant way to delete their own account and optionally any linked students, with a support-backed fallback.

- **7.1 Parent-facing deletion entry point**
  - In Parent settings, add a “Delete my account” flow with scope selection: “Delete only my parent account” vs “Delete my account and all linked students.”
  - Require an explicit confirmation step (typed phrase or checkbox), explain billing cancellation, data removal timeline, and that access ends immediately.

- **7.2 Fulfillment path and safeguards**
  - Implement an API path (service-role gated) that marks the parent (and selected students) as `pending_deletion`, cancels active Stripe subscriptions, and enqueues a background deletion job.
  - If service-role access isn’t ready, fall back to a support flow: submit a ticket with account IDs, scope, and request ID; block login by marking profiles as `pending_deletion` until support completes the runbook.
  - Ensure cascades remove or anonymize `profiles`, `student_profiles`, assignments, progress, and billing artifacts without breaking referential integrity.

- **7.3 Notifications and audit trail**
  - Email the parent (and optionally student/guardian addresses) with confirmation, timeline, and a support contact; send a completion email once deletion is finalized.
  - Log `account_deletion_requested` / `account_deletion_completed` via `recordReliabilityCheckpoint` and `logAdminAuditEvent` with actor, scope, reason, and request ID.

- **7.4 Admin visibility**
  - Add an Admin dashboard view for pending/completed deletions with metadata, ability to cancel/approve, and links to support tickets or job logs.

**Outcome:** Parents can self-serve or request deletion (including linked students) with billing cancellation, auditability, and a safe fallback to support while backend automation matures.

---

## Gaps & Risks to Track

- **Account lifecycle coverage**
  - Add end‑to‑end flows for:
    - “Forgot password” (request, email link, reset form).
    - Change email (including re‑verification of the new address).
    - Delete account / request account deletion for both parents and students.
  - Ensure these use Supabase auth APIs and respect our consent/compliance expectations.

- **Email verification UX**
  - Provide “Resend verification email” on the “check your email” state.
  - Handle expired/invalid links with a friendly screen and a way to request a fresh link, instead of a generic error.

- **Role safety and elevation**
  - Ensure users cannot self‑select or change their `admin` role via metadata.
  - Define and implement a safe manual promotion path (e.g., admin‑only tooling or SQL runbook) and a demotion path that does not corrupt parent/student data.

- **Parent–student linking edges**
  - Student‑first scenarios:
    - A student signs up alone, then a parent joins later and links via `family_link_code`.
    - UX for entering the code on the parent side, success/invalid code feedback, and confirmation banners.
  - Parent‑first scenarios:
    - Parent creates multiple children, invites them, or links existing student accounts.
    - Clear messaging when seat/plan limits (once enforced) block adding more students.

- **Onboarding after first login**
  - Parent:
    - First‑time checklist (add students, choose plan if required, set notification preferences).
    - Basic guidance toward using the dashboard (where to see progress, assignments, billing).
  - Student:
    - Confirm grade and subject focus.
    - Optional placement or quick start flow.
    - Short “tour” of dashboard and tutor so students know where to start.

- **Billing state transitions (once enabled)**
  - Define what happens when:
    - A subscription lapses or a payment fails (limited mode vs read‑only vs blocked).
    - A parent upgrades/downgrades or cancels; how existing students are affected.
  - Ensure all feature gates (AI tutor, lesson caps, new assignments) consistently read entitlements and the billing toggle.

- **Support and observability**
  - Add user‑visible “something went wrong” fallbacks with a link or flow to contact support.
  - Create minimal admin views/queries for:
    - Recent signup failures and email verification issues.
    - Billing errors (checkout failures, webhook failures, payment declines).
  - Tie these into existing logging/metrics where possible.

- **Mobile and deep‑link behaviour**
  - Validate that:
    - Email verification links and post‑checkout redirects behave correctly on mobile browsers.
    - Deep links to lessons/dashboards while logged out:
      - Route through auth/signup as needed.
      - Land the user back at the intended destination after login/verification.

---

## Open Decisions / Follow‑Ups

- Final choice between student billing models (Option A vs Option B) and their implications.
- Exact discount percentages for additional students (e.g., –20% for second, –30% for third+ vs another curve).
- Whether students are allowed to self‑manage billing, or if only “parent/payer” profiles can own subscriptions.


Answers for those open decisions:

Students should not be able to sign up for anything other than the free plan themselves. Parents would need to be invited by student to create parent account and sign up for paid plan. For the discounts, - 20% for any additional students. Students cannot manage billing. parent accounts only handle billing related things.