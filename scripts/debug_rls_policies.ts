import { createServiceRoleClient } from './utils/supabase.js';

/**
 * Debug script to check RLS policies and table permissions
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/debug_rls_policies.ts
 */

async function main() {
    console.log('=== ElevatED RLS Policy Debug Script ===\n');

    const supabase = createServiceRoleClient();

    // 1. Check table existence
    console.log('1. Checking table structures...\n');

    const tables = [
        'student_assignments',
        'assignments',
        'xp_ledger',
        'student_profiles',
        'student_events',
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`  ❌ ${table}: ${error.message}`);
        } else {
            console.log(`  ✅ ${table}: exists and accessible`);
        }
    }

    // 2. Check student_assignments table more thoroughly
    console.log('\n2. Checking student_assignments structure...');
    const { data: saData, error: saError } = await supabase
        .from('student_assignments')
        .select('id, student_id, status, due_at, assignment_id')
        .limit(3);

    if (saError) {
        console.log(`  ❌ student_assignments query failed: ${saError.message}`);
        console.log(`     Code: ${saError.code}`);
        console.log(`     Details: ${saError.details}`);
        console.log(`     Hint: ${saError.hint}`);
    } else {
        console.log(`  ✅ student_assignments has ${saData?.length ?? 0} rows`);
    }

    // 3. Check assignments table
    console.log('\n3. Checking assignments table...');
    const { data: aData, error: aError } = await supabase
        .from('assignments')
        .select('id, title, metadata')
        .limit(3);

    if (aError) {
        console.log(`  ❌ assignments query failed: ${aError.message}`);
        console.log(`     Code: ${aError.code}`);
        console.log(`     Details: ${aError.details}`);
    } else {
        console.log(`  ✅ assignments has ${aData?.length ?? 0} rows`);
    }

    // 4. Try the exact query that's failing in production
    console.log('\n4. Testing production query pattern...');

    // Get a student ID first
    const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .limit(1);

    const studentId = students?.[0]?.id;
    if (!studentId) {
        console.log('  ⚠️ No students found to test with');
    } else {
        console.log(`  Using student: ${studentId}`);

        // Test the exact failing query
        const { data: assignmentsData, error: assignmentsError } = await supabase
            .from('student_assignments')
            .select('id, status, due_at, assignments(id, title, metadata)')
            .eq('student_id', studentId)
            .order('due_at', { ascending: true })
            .limit(4);

        if (assignmentsError) {
            console.log(`  ❌ Production query FAILED: ${assignmentsError.message}`);
            console.log(`     Code: ${assignmentsError.code}`);
            console.log(`     Details: ${assignmentsError.details}`);
            console.log(`     Hint: ${assignmentsError.hint}`);
        } else {
            console.log(`  ✅ Production query succeeded: ${assignmentsData?.length ?? 0} assignments`);
        }
    }

    // 5. Get RLS policy info (if available)
    console.log('\n5. Checking for common RLS issues...');

    // Check if there are any RLS policies on student_assignments
    const { data: rlsCheck, error: rlsError } = await supabase.rpc('check_table_rls', {
        table_name: 'student_assignments'
    });

    if (rlsError) {
        console.log('  ℹ️ RLS check function not available (this is expected)');
        console.log('     RLS policies need to be checked directly in Supabase dashboard');
    } else {
        console.log('  RLS Info:', rlsCheck);
    }

    console.log('\n=== Summary ===');
    console.log('If student_assignments queries are failing with 500:');
    console.log('  1. Check RLS policy allows students to read their own assignments');
    console.log('  2. Verify the assignments foreign key relationship exists');
    console.log('  3. Ensure the table has data for the student');
    console.log('\n✅ Debug complete.');
}

main().catch(console.error);
