import { createServiceRoleClient } from './utils/supabase.js';

async function main() {
    const supabase = createServiceRoleClient();

    // Find our test student
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .ilike('email', '%e2etest%')
        .limit(5);

    if (profileError) {
        console.error('Error:', profileError);
        return;
    }

    console.log('Test profiles:', profiles);

    if (profiles?.length) {
        const studentId = profiles[0].id;
        console.log(`\nChecking student profile for: ${studentId}`);

        const { data: studentProfile, error: spError } = await supabase
            .from('student_profiles')
            .select('id, grade_level, grade_band, first_name, last_name')
            .eq('id', studentId)
            .single();

        if (spError) {
            console.error('Student profile error:', spError);
        } else {
            console.log('Student profile:', studentProfile);
        }

        // Check student preferences
        const { data: prefs, error: prefsError } = await supabase
            .from('student_preferences')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (prefsError) {
            console.error('Preferences error:', prefsError);
        } else {
            console.log('Preferences:', prefs);
        }
    }
}

main().catch(console.error);
