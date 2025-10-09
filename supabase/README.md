# Supabase Setup

1. Create a Supabase project and capture the `Project URL` and `anon` API key.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install the Supabase CLI (`npm install -g supabase`) if you have not already.
4. Run `supabase link --project-ref YOUR_PROJECT_REF` to connect the local CLI to your project.
5. Apply the database schema and RLS policies:
   ```bash
   supabase db push --file supabase/schema.sql
   ```
6. Verify the tables (`profiles`, `student_profiles`, `parent_profiles`) and policies were created in the Supabase dashboard before running the app.

The trigger `public.handle_new_auth_user` keeps the profile tables in sync with new users who register through Supabase Auth. Update the function as needed while new profile-related features are added.
