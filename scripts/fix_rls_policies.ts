import { createServiceRoleClient } from './utils/supabase.js';

/**
 * Fix RLS policies that are causing infinite recursion and timeouts
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/fix_rls_policies.ts
 */

async function main() {
    console.log('=== Fixing RLS Policies ===\n');

    const supabase = createServiceRoleClient();

    // 1. First, let's check what policies exist on student_assignments
    console.log('1. Checking current policies on student_assignments...');

    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
        sql: `
            SELECT
                policyname,
                permissive,
                roles,
                cmd,
                qual::text as using_clause,
                with_check::text as with_check_clause
            FROM pg_policies
            WHERE tablename = 'student_assignments'
            ORDER BY policyname;
        `
    });

    if (policiesError) {
        console.log('  Note: exec_sql RPC not available, will try direct approach');
        console.log('  Error:', policiesError.message);
    } else {
        console.log('  Current policies:', JSON.stringify(policies, null, 2));
    }

    // 2. Drop problematic policies and recreate them correctly
    console.log('\n2. Fixing student_assignments RLS policies...');

    // We'll use raw SQL queries through the Supabase client
    // First, let's try to drop existing policies and create new ones

    const fixStatements = [
        // Drop all existing policies on student_assignments
        `DROP POLICY IF EXISTS "Students can read their own assignments" ON student_assignments;`,
        `DROP POLICY IF EXISTS "students_read_own" ON student_assignments;`,
        `DROP POLICY IF EXISTS "student_assignments_select" ON student_assignments;`,
        `DROP POLICY IF EXISTS "Enable read access for students" ON student_assignments;`,
        `DROP POLICY IF EXISTS "student_read_own_assignments" ON student_assignments;`,

        // Create a simple, non-recursive policy
        `CREATE POLICY "student_read_own_assignments" ON student_assignments
            FOR SELECT
            USING (student_id = auth.uid());`,

        `CREATE POLICY "student_update_own_assignments" ON student_assignments
            FOR UPDATE
            USING (student_id = auth.uid())
            WITH CHECK (student_id = auth.uid());`,
    ];

    // Try to execute via service role using raw SQL
    for (const sql of fixStatements) {
        console.log(`  Executing: ${sql.slice(0, 60)}...`);

        const { error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            // exec_sql might not exist, we need another approach
            if (error.message.includes('function') && error.message.includes('does not exist')) {
                console.log('\n  ⚠️ exec_sql function not available.');
                console.log('  You need to run these SQL commands in Supabase Dashboard:');
                console.log('\n  === SQL TO RUN IN SUPABASE DASHBOARD ===\n');
                console.log(`
-- First, drop problematic policies
DROP POLICY IF EXISTS "Students can read their own assignments" ON student_assignments;
DROP POLICY IF EXISTS "students_read_own" ON student_assignments;
DROP POLICY IF EXISTS "student_assignments_select" ON student_assignments;
DROP POLICY IF EXISTS "Enable read access for students" ON student_assignments;
DROP POLICY IF EXISTS "student_read_own_assignments" ON student_assignments;
DROP POLICY IF EXISTS "student_update_own_assignments" ON student_assignments;

-- Create simple, non-recursive policies
CREATE POLICY "student_read_own_assignments" ON student_assignments
    FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "student_update_own_assignments" ON student_assignments
    FOR UPDATE
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

-- Also fix xp_ledger if needed
DROP POLICY IF EXISTS "Students can read their own XP" ON xp_ledger;
DROP POLICY IF EXISTS "xp_ledger_select" ON xp_ledger;

CREATE POLICY "student_read_own_xp" ON xp_ledger
    FOR SELECT
    USING (student_id = auth.uid());
                `);
                console.log('\n  ========================================\n');
                break;
            }
            console.log(`  ❌ Error: ${error.message}`);
        } else {
            console.log('  ✅ Success');
        }
    }

    // 3. Also fix xp_ledger policies
    console.log('\n3. Checking xp_ledger policies...');

    // Try direct table access test
    const { error: xpTestError } = await supabase
        .from('xp_ledger')
        .select('student_id')
        .limit(1);

    if (xpTestError) {
        console.log('  xp_ledger has issues:', xpTestError.message);
    } else {
        console.log('  ✅ xp_ledger accessible via service role');
    }

    console.log('\n=== Done ===');
    console.log('\nIf exec_sql is not available, please run the SQL statements above');
    console.log('in the Supabase Dashboard SQL Editor.');
}

main().catch(console.error);
