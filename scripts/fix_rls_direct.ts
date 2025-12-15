import pg from 'pg';
import process from 'node:process';

const { Client } = pg;

/**
 * Fix RLS policies directly via PostgreSQL connection
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/fix_rls_direct.ts
 */

async function main() {
    console.log('=== Fixing RLS Policies Directly ===\n');

    const databaseUrl = process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (!databaseUrl) {
        console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found in environment');
        return;
    }

    console.log('Connecting to database...');

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected!\n');

        // 1. Check current policies
        console.log('1. Current policies on problem tables:\n');

        const { rows: currentPolicies } = await client.query(`
            SELECT tablename, policyname, permissive, roles, cmd, qual::text as using_clause
            FROM pg_policies 
            WHERE tablename IN ('student_assignments', 'xp_ledger', 'student_events')
            ORDER BY tablename, policyname;
        `);

        console.table(currentPolicies.map(p => ({
            table: p.tablename,
            policy: p.policyname,
            cmd: p.cmd,
            using: p.using_clause?.slice(0, 80) + (p.using_clause?.length > 80 ? '...' : '')
        })));

        // 2. Fix student_assignments policies
        console.log('\n2. Fixing student_assignments policies...');

        const studentAssignmentsFixes = [
            // Drop all existing SELECT policies
            `DROP POLICY IF EXISTS "Students can read their own assignments" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "students_read_own" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "student_assignments_select" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "Enable read access for students" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "student_read_own_assignments" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "student_update_own_assignments" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "Students can view own assignments" ON public.student_assignments;`,
            `DROP POLICY IF EXISTS "Students can update own assignments" ON public.student_assignments;`,

            // Create simple non-recursive policy
            `CREATE POLICY "student_read_own_assignments" ON public.student_assignments
                FOR SELECT TO authenticated
                USING (student_id = auth.uid());`,

            `CREATE POLICY "student_update_own_assignments" ON public.student_assignments
                FOR UPDATE TO authenticated
                USING (student_id = auth.uid())
                WITH CHECK (student_id = auth.uid());`,
        ];

        for (const sql of studentAssignmentsFixes) {
            try {
                await client.query(sql);
                console.log(`  ✅ ${sql.slice(0, 50)}...`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                // Ignore "does not exist" errors when dropping
                if (msg.includes('does not exist')) {
                    console.log(`  ⏭️ ${sql.slice(0, 50)}... (policy didn't exist)`);
                } else {
                    console.log(`  ❌ ${sql.slice(0, 50)}... Error: ${msg}`);
                }
            }
        }

        // 3. Fix xp_ledger policies
        console.log('\n3. Fixing xp_ledger policies...');

        const xpLedgerFixes = [
            `DROP POLICY IF EXISTS "Students can read their own XP" ON public.xp_ledger;`,
            `DROP POLICY IF EXISTS "xp_ledger_select" ON public.xp_ledger;`,
            `DROP POLICY IF EXISTS "student_read_own_xp" ON public.xp_ledger;`,
            `DROP POLICY IF EXISTS "Enable read access for students" ON public.xp_ledger;`,

            `CREATE POLICY "student_read_own_xp" ON public.xp_ledger
                FOR SELECT TO authenticated
                USING (student_id = auth.uid());`,
        ];

        for (const sql of xpLedgerFixes) {
            try {
                await client.query(sql);
                console.log(`  ✅ ${sql.slice(0, 50)}...`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('does not exist')) {
                    console.log(`  ⏭️ ${sql.slice(0, 50)}... (policy didn't exist)`);
                } else {
                    console.log(`  ❌ ${sql.slice(0, 50)}... Error: ${msg}`);
                }
            }
        }

        // 4. Fix student_events policies
        console.log('\n4. Fixing student_events policies...');

        const studentEventsFixes = [
            `DROP POLICY IF EXISTS "Students can read their own events" ON public.student_events;`,
            `DROP POLICY IF EXISTS "student_events_select" ON public.student_events;`,
            `DROP POLICY IF EXISTS "student_read_own_events" ON public.student_events;`,
            `DROP POLICY IF EXISTS "Enable read access for students" ON public.student_events;`,

            `CREATE POLICY "student_read_own_events" ON public.student_events
                FOR SELECT TO authenticated
                USING (student_id = auth.uid());`,
        ];

        for (const sql of studentEventsFixes) {
            try {
                await client.query(sql);
                console.log(`  ✅ ${sql.slice(0, 50)}...`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('does not exist')) {
                    console.log(`  ⏭️ ${sql.slice(0, 50)}... (policy didn't exist)`);
                } else {
                    console.log(`  ❌ ${sql.slice(0, 50)}... Error: ${msg}`);
                }
            }
        }

        // 5. Verify the fixes
        console.log('\n5. Verifying policies after fix:\n');

        const { rows: newPolicies } = await client.query(`
            SELECT tablename, policyname, cmd, qual::text as using_clause
            FROM pg_policies 
            WHERE tablename IN ('student_assignments', 'xp_ledger', 'student_events')
            ORDER BY tablename, policyname;
        `);

        console.table(newPolicies.map(p => ({
            table: p.tablename,
            policy: p.policyname,
            cmd: p.cmd,
            using: p.using_clause?.slice(0, 60)
        })));

        console.log('\n✅ RLS policies fixed successfully!');
        console.log('\nNote: If you\'re still seeing 500 errors, you may need to:');
        console.log('  1. Redeploy the application to pick up code fixes');
        console.log('  2. Clear any cached API responses');

    } catch (err) {
        console.error('❌ Database error:', err);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
