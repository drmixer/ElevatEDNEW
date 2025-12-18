/**
 * Apply the diagnostic_status migration to the database
 */

import 'dotenv/config';
import { createServiceRoleClient } from './utils/supabase.js';

async function applyMigration() {
    const supabase = createServiceRoleClient();

    console.log('Applying diagnostic_status migration...');

    // Check if table is accessible
    const { error: checkError } = await supabase
        .from('student_profiles')
        .select('id')
        .limit(1);

    if (checkError) {
        console.error('Failed to access student_profiles:', checkError);
        process.exit(1);
    }

    // Try to select the new column to see if it exists
    const { error: columnCheck } = await supabase
        .from('student_profiles')
        .select('diagnostic_status')
        .limit(1);

    if (!columnCheck) {
        console.log('diagnostic_status column already exists!');
        return;
    }

    // The column doesn't exist - we need to add it via SQL
    // Since we can't run raw SQL without admin access, we'll document the needed migration
    console.log('\n⚠️  The diagnostic_status column needs to be added to student_profiles.');
    console.log('\nTo apply this migration, run the following SQL in the Supabase dashboard:\n');
    console.log(`
-- Add diagnostic status columns
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS diagnostic_status text
  CHECK (diagnostic_status IN ('not_started', 'in_progress', 'completed', 'skipped')),
ADD COLUMN IF NOT EXISTS diagnostic_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS diagnostic_subject text,
ADD COLUMN IF NOT EXISTS diagnostic_grade text,
ADD COLUMN IF NOT EXISTS diagnostic_score numeric,
ADD COLUMN IF NOT EXISTS diagnostic_metadata jsonb DEFAULT '{}'::jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_profiles_diagnostic_status
  ON student_profiles (diagnostic_status)
  WHERE diagnostic_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_profiles_diagnostic_completed
  ON student_profiles (diagnostic_completed_at DESC)
  WHERE diagnostic_completed_at IS NOT NULL;
  `);

    console.log('\nAlternatively, link your project and run:');
    console.log('  npx supabase login');
    console.log('  npx supabase link --project-ref YOUR_PROJECT_REF');
    console.log('  npx supabase db push');
}

applyMigration().catch(console.error);
