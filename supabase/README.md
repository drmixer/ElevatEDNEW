# Supabase Setup

1. Create a Supabase project and capture the `Project URL` and `anon` API key.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install the Supabase CLI (`npm install -g supabase`) if you have not already.
4. Link the local CLI to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
5. Push the migrations to provision the schema, policies, seed data:
   ```bash
   supabase migration up
   ```
   This will run the files in `supabase/migrations` (currently `001_core_schema.sql` through `006_subscriptions_notifications.sql`).
6. Confirm the core tables and RLS policies in the Supabase dashboard before running the app. Highlights:
   - Identity & onboarding: `profiles`, `parent_profiles`, `student_profiles`, `guardian_child_links`, trigger `handle_new_auth_user`.
   - Learning content: `subjects`, `topics`, `adaptive_levels`, `lessons`, `lesson_steps`, `question_bank`, `question_options`.
   - Progress tracking: `student_progress`, `student_assessment_attempts`, `student_assessment_responses`, `practice_sessions`, `practice_events`.
   - Curriculum metadata: `skills`, `lesson_skills`, `question_skills`, `student_mastery`, `student_mastery_events`.
   - Motivation: `badge_definitions`, `student_badges`, `xp_events`, `streak_logs`.
   - Engagement & ops: `assignments`, `student_assignments`, `subscription*`, `payments`, `billing_events`, `notifications`.

### Auth bootstrap

The trigger `public.handle_new_auth_user` automatically writes to `profiles` (and `parent_profiles` for guardians) whenever an auth user is created. Update the trigger/function as additional metadata or onboarding flows are introduced.
