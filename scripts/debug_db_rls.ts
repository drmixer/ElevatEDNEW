import { createServiceRoleClient, createRlsClient } from './utils/supabase.js';

/**
 * Debug script to check database tables and RLS policies for student dashboard issues
 * 
 * Run with: npx tsx scripts/debug_db_rls.ts
 */

async function main() {
    console.log('=== ElevatED Database & RLS Debug Script ===\n');

    const supabase = createServiceRoleClient();

    // 1. Check if we can connect
    console.log('1. Testing connection...');
    const { data: testData, error: testError } = await supabase.from('profiles').select('id').limit(1);
    if (testError) {
        console.error('❌ Connection failed:', testError.message);
        return;
    }
    console.log('✅ Connection successful\n');

    // 2. Find a test student
    console.log('2. Looking for test students...');
    const { data: students, error: studentError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('role', 'student')
        .limit(5);

    if (studentError) {
        console.error('❌ Error fetching students:', studentError.message);
        return;
    }

    console.log(`Found ${students?.length ?? 0} students:`);
    students?.forEach(s => console.log(`  - ${s.email} (${s.id})`));

    if (!students?.length) {
        console.log('⚠️ No students found in database');
        return;
    }

    const testStudent = students[0];
    console.log(`\nUsing test student: ${testStudent.email}\n`);

    // 3. Check student_profiles table
    console.log('3. Checking student_profiles table...');
    const { data: studentProfile, error: spError } = await supabase
        .from('student_profiles')
        .select('id, grade_level, grade_band, first_name, last_name, family_link_code, parent_id')
        .eq('id', testStudent.id)
        .maybeSingle();

    if (spError) {
        console.error('❌ student_profiles error:', spError.message);
    } else if (!studentProfile) {
        console.log('⚠️ No student_profiles row found for this student');
    } else {
        console.log('✅ student_profiles found:', JSON.stringify(studentProfile, null, 2));
    }

    // 4. Check xp_ledger table
    console.log('\n4. Checking xp_ledger table...');
    const { data: xpLedger, error: xpError } = await supabase
        .from('xp_ledger')
        .select('student_id, xp_total, streak_days, badge_ids')
        .eq('student_id', testStudent.id)
        .maybeSingle();

    if (xpError) {
        console.error('❌ xp_ledger error:', xpError.message);
    } else if (!xpLedger) {
        console.log('⚠️ No xp_ledger row found - this could cause 500 on /student/stats');
        console.log('   Attempting to create default xp_ledger row...');

        const { error: insertError } = await supabase
            .from('xp_ledger')
            .upsert({
                student_id: testStudent.id,
                xp_total: 0,
                streak_days: 0,
                badge_ids: []
            }, { onConflict: 'student_id' });

        if (insertError) {
            console.error('❌ Failed to create xp_ledger:', insertError.message);
        } else {
            console.log('✅ Created default xp_ledger row');
        }
    } else {
        console.log('✅ xp_ledger found:', JSON.stringify(xpLedger, null, 2));
    }

    // 5. Check student_events table
    console.log('\n5. Checking student_events table...');
    const { data: events, error: eventsError } = await supabase
        .from('student_events')
        .select('id, event_type, created_at')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (eventsError) {
        console.error('❌ student_events error:', eventsError.message);
    } else {
        console.log(`✅ Found ${events?.length ?? 0} student events`);
    }

    // 6. Check student_mastery table
    console.log('\n6. Checking student_mastery table...');
    const { data: mastery, error: masteryError } = await supabase
        .from('student_mastery')
        .select('id, mastery_pct')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (masteryError) {
        console.error('❌ student_mastery error:', masteryError.message);
    } else {
        console.log(`✅ Found ${mastery?.length ?? 0} mastery records`);
    }

    // 7. Check student_paths table
    console.log('\n7. Checking student_paths table...');
    const { data: paths, error: pathsError } = await supabase
        .from('student_paths')
        .select('id, status, started_at')
        .eq('student_id', testStudent.id)
        .limit(3);

    if (pathsError) {
        console.error('❌ student_paths error:', pathsError.message);
    } else {
        console.log(`✅ Found ${paths?.length ?? 0} learning paths`);
        paths?.forEach(p => console.log(`  - Path ${p.id}: ${p.status}`));
    }

    // 8. Check student_daily_activity table
    console.log('\n8. Checking student_daily_activity table...');
    const { data: activity, error: activityError } = await supabase
        .from('student_daily_activity')
        .select('activity_date, practice_minutes')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (activityError) {
        console.error('❌ student_daily_activity error:', activityError.message);
    } else {
        console.log(`✅ Found ${activity?.length ?? 0} daily activity records`);
    }

    // 9. Check student_progress table
    console.log('\n9. Checking student_progress table...');
    const { data: progress, error: progressError } = await supabase
        .from('student_progress')
        .select('id, mastery_pct, last_activity_at')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (progressError) {
        console.error('❌ student_progress error:', progressError.message);
    } else {
        console.log(`✅ Found ${progress?.length ?? 0} progress records`);
    }

    // 10. Check student_badges table
    console.log('\n10. Checking student_badges table...');
    const { data: badges, error: badgesError } = await supabase
        .from('student_badges')
        .select('badge_id, earned_at')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (badgesError) {
        console.error('❌ student_badges error:', badgesError.message);
    } else {
        console.log(`✅ Found ${badges?.length ?? 0} badges earned`);
    }

    // 11. Check student_assignments table (was causing 500 in console)
    console.log('\n11. Checking student_assignments table...');
    const { data: assignments, error: assignmentsError } = await supabase
        .from('student_assignments')
        .select('id, status, due_at, assignments(id, title)')
        .eq('student_id', testStudent.id)
        .limit(5);

    if (assignmentsError) {
        console.error('❌ student_assignments error:', assignmentsError.message);
        console.log('   This is likely causing the 500 errors in the console!');
    } else {
        console.log(`✅ Found ${assignments?.length ?? 0} assignments`);
    }

    // 12. Check guardian_child_links table
    console.log('\n12. Checking guardian_child_links table...');
    const { data: guardianLinks, error: guardianError } = await supabase
        .from('guardian_child_links')
        .select('id, parent_id, status')
        .eq('student_id', testStudent.id)
        .limit(3);

    if (guardianError) {
        console.error('❌ guardian_child_links error:', guardianError.message);
    } else {
        console.log(`✅ Found ${guardianLinks?.length ?? 0} guardian links`);
    }

    // 13. Check student_preferences table
    console.log('\n13. Checking student_preferences table...');
    const { data: prefs, error: prefsError } = await supabase
        .from('student_preferences')
        .select('*')
        .eq('student_id', testStudent.id)
        .maybeSingle();

    if (prefsError) {
        console.error('❌ student_preferences error:', prefsError.message);
    } else if (!prefs) {
        console.log('⚠️ No student_preferences row found');
    } else {
        console.log('✅ student_preferences found');
    }

    // 14. Test RLS with an RLS-enabled client
    console.log('\n14. Testing RLS policies...');
    console.log('   (Note: This would require an actual user JWT to test properly)');
    console.log('   Service role bypasses RLS, so no issues detected from service role.\n');

    // Summary
    console.log('=== SUMMARY ===');
    console.log('\nPotential Issues Found:');

    const issues: string[] = [];
    if (!studentProfile) issues.push('- Missing student_profiles row');
    if (!xpLedger) issues.push('- Missing xp_ledger row (may have been auto-created above)');
    if (assignmentsError) issues.push('- student_assignments table error (causing 500s)');

    if (issues.length === 0) {
        console.log('  No major database issues detected with service role client.');
        console.log('  If you\'re still seeing 500 errors, the issue may be RLS policies');
        console.log('  blocking the authenticated user, or a code bug in the API.\n');
    } else {
        issues.forEach(i => console.log(i));
    }

    console.log('\n✅ Debug script complete.');
}

main().catch(console.error);
