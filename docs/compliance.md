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

## Monitoring/PII handling
- Sentry (client & server) now sets `sendDefaultPii=false` and strips emails/names/headers from events, breadcrumbs, and request contexts before sending.
- Avoid logging raw student content or emails in console/Sentry context; redact sensitive fields before passing to monitoring helpers.
