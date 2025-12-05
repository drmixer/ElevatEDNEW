# Billing & Subscriptions (Stripe)

This environment expects Stripe to power subscriptions and to mirror state into Supabase tables (`plans`, `subscriptions`, `subscription_history`, `payments`, `billing_events`).

## Configuration
- Required env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Price IDs map to plan slugs:
  - Preferred: `STRIPE_PRICE_INDIVIDUAL_FREE` → `individual-free`; `STRIPE_PRICE_INDIVIDUAL_PLUS` → `individual-plus`; `STRIPE_PRICE_INDIVIDUAL_PRO` → `individual-pro`.
  - Legacy (still honored for existing subs): `STRIPE_PRICE_FAMILY_FREE` → `family-free`; `STRIPE_PRICE_FAMILY_PLUS` → `family-plus`; `STRIPE_PRICE_FAMILY_PREMIUM` → `family-premium`.
- Optional: `APP_BASE_URL` for checkout/portal return URLs; `ENFORCE_PLAN_LIMITS=true` to gate AI assistant for free plans.
- Bypass flags:
  - `BILLING_SANDBOX_MODE=true` skips Stripe entirely and auto-activates subscriptions.
  - `BILLING_BYPASS_PARENTS=<id-or-email,comma-separated>` auto-activates a premium plan for those parents.

## Webhooks
- Endpoint: `POST /api/v1/billing/webhook`.
- Send Stripe events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`. Others are stored as `billing_events` for observability.
- Each checkout/subscription includes `metadata.parent_id` so events can be reconciled to the parent profile. RLS is bypassed with the service-role client in the webhook handler.

## Plan provisioning
1) Create/update plans in Supabase `plans` (slugs: `individual-free`, `individual-plus`, `individual-pro`; keep `family-*` active only for legacy users). Update `price_cents` and `metadata` (e.g., `{ "lesson_limit": 100 }`) as needed.
2) Create/confirm Stripe Prices for each plan and set the corresponding env vars.
3) Deploy with updated env and restart the API worker so `server/billing.ts` picks up the mappings.

## Handling edge cases
- Unknown price IDs → webhook throws and logs; add the missing price mapping or deactivate the Stripe price.
- Missing `parent_id` in events → webhook returns 400; ensure checkout payloads always include `metadata.parent_id`.
- Parents without a Stripe customer can still view plans; attempting portal access without a customer returns a 400 prompting them to start checkout first.
- If a subscription is deleted in Stripe, the webhook will mark it `canceled` and keep history/payments intact.

## Testing
- Use Stripe test keys and CLI to forward events to `/api/v1/billing/webhook`.
- Parent UI: visit the dashboard billing card, click “Upgrade” to start checkout (test mode), and “Manage billing” to open the portal once a customer is created.
