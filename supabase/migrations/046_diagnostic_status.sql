-- Migration: Add diagnostic_status columns to student_profiles
-- This enables tracking of diagnostic completion status per student

-- Add diagnostic status columns
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS diagnostic_status text
  CHECK (diagnostic_status IN ('not_started', 'in_progress', 'completed', 'skipped')),
ADD COLUMN IF NOT EXISTS diagnostic_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS diagnostic_subject text,
ADD COLUMN IF NOT EXISTS diagnostic_grade text,
ADD COLUMN IF NOT EXISTS diagnostic_score numeric,
ADD COLUMN IF NOT EXISTS diagnostic_metadata jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN student_profiles.diagnostic_status IS 'Current status of the placement diagnostic: not_started, in_progress, completed, skipped';
COMMENT ON COLUMN student_profiles.diagnostic_completed_at IS 'Timestamp when the diagnostic was completed';
COMMENT ON COLUMN student_profiles.diagnostic_subject IS 'Subject of the last completed diagnostic';
COMMENT ON COLUMN student_profiles.diagnostic_grade IS 'Grade level of the last completed diagnostic';
COMMENT ON COLUMN student_profiles.diagnostic_score IS 'Score percentage from the diagnostic (0-100)';
COMMENT ON COLUMN student_profiles.diagnostic_metadata IS 'Additional diagnostic data including strand scores, placement recommendations';

-- Create index for efficiently finding students by diagnostic status
CREATE INDEX IF NOT EXISTS idx_student_profiles_diagnostic_status
  ON student_profiles (diagnostic_status)
  WHERE diagnostic_status IS NOT NULL;

-- Create index for finding recently completed diagnostics
CREATE INDEX IF NOT EXISTS idx_student_profiles_diagnostic_completed
  ON student_profiles (diagnostic_completed_at DESC)
  WHERE diagnostic_completed_at IS NOT NULL;
