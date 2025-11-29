# Security, Privacy & Compliance Notes

## Legal surfaces
- Public routes: `/legal/privacy` and `/legal/terms`, linked from the landing page, auth modal, and signed-in settings.
- Pages are written with COPPA/FERPA expectations (no data sales, under-13 through guardians, family data rights).

## Data rights (export/deletion)
- Table: `public.privacy_requests` (enum types `privacy_request_type`, `privacy_request_status`).
- Parents/guardians can submit requests from the Family Dashboard (`Data rights & privacy` card). RLS requires `requester_id = auth.uid()` **and** `public.is_guardian(student_id)`.
- Admin/service-role can read/update all requests. Suggested resolution flow:
  ```sql
  -- Mark a request as fulfilled/rejected after handling
  update public.privacy_requests
  set status = 'fulfilled',
      admin_notes = 'Export delivered via secure link',
      handled_by = '<admin-uuid>',
      resolved_at = now()
  where id = <request_id>;
  ```
- Exports/deletions should be executed via admin tooling or supervised scripts; this UI only captures/verifies requests.

## Access control & admin visibility
- Guardianship checks: `public.is_guardian(student_id)` used across RLS policies to scope child data.
- Admin elevation: `public.is_platform_admin()` (based on `admin_profiles`) gates admin-only policies and APIs.
- Admin viewing of student data now records an audit log entry (`admin_audit_logs`) when the Admin Dashboard loads (`event_type: view_student_data`, metadata includes counts). Logs readable by platform admins.
- Tests guard the common RLS queries: guardian link lookups filter by `parent_id`, and privacy request listing filters by both `requester_id` and `student_id` so only linked guardians see requests.
- Product model refinements: student sessions and practice events roll up under a parent subscription; lesson progress can be stored locally when unauthenticated and syncs to Supabase once a student session is present. Billing context is derived from parent subscriptions (or bypass list) and is required for AI tutor access when `ENFORCE_PLAN_LIMITS` is enabled.

## Monitoring/PII handling
- Sentry (client & server) now sets `sendDefaultPii=false` and strips emails/names/headers from events, breadcrumbs, and request contexts before sending.
- Avoid logging raw student content or emails in console/Sentry context; redact sensitive fields before passing to monitoring helpers.
- Alerts: backend surfaces `alert:error_spike` (5 minute error spikes), `alert:billing_webhook_failed` (Stripe delivery issues), and `[ai] rate limit/plan gated` warnings. Configure Sentry or Slack alerts on these signals for fast detection without exposing PII.

## Incident handling
- **Detection:** Watch Sentry `alert:*` messages and Supabase log drains for spikes or RLS denials. Import queue warnings/errors are mirrored to monitoring to catch ingestion regressions.
- **Containment:** For AI/billing defects, temporarily disable enforcement via `ENFORCE_PLAN_LIMITS=false` or switch `BILLING_SANDBOX_MODE=true` while investigating. For student data exposure risk, pause the affected route behind edge maintenance mode where available.
- **Response:** Document the affected tables/users, run a targeted Supabase query to verify scope, and add a note to the privacy request record if data rights are implicated. Replay Stripe webhooks only after root cause is fixed and logged.
- **Recovery:** Capture a short retro (cause, blast radius, mitigation, follow-ups) and link any Supabase SQL patches or RLS changes applied so audit trails remain attached to the incident.
