import { createServiceRoleClient } from './utils/supabase.js';

async function main() {
    const supabase = createServiceRoleClient();
    const studentId = 'ee4783d3-07eb-4e96-bd8c-cd716f5eb1fc';

    // Check student assessment attempts
    const { data: attempts, error } = await supabase
        .from('student_assessment_attempts')
        .select('id, assessment_id, attempt_number, status')
        .eq('student_id', studentId);

    console.log('Assessment attempts for student:', attempts);
    if (error) console.error('Error:', error);

    // Try the full placement query that the server uses
    console.log('\nChecking full placement assessment query...');
    const { data: assessmentData, error: assessError } = await supabase
        .from('assessments')
        .select('id, module_id, metadata')
        .is('module_id', null)
        .order('id', { ascending: false })
        .limit(200);

    if (assessError) {
        console.error('Assessment query error:', assessError);
    } else {
        const placements = (assessmentData ?? []).filter(a => {
            const meta = a.metadata as Record<string, unknown> | null;
            return meta?.purpose === 'placement' && meta?.grade_band === '6-8';
        });
        console.log('6-8 Placement assessments found:', placements);
    }
}

main().catch(console.error);
