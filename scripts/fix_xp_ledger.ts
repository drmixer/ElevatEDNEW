import { createServiceRoleClient } from './utils/supabase.js';

/**
 * Fix missing xp_ledger rows for all students
 * 
 * Run with: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/fix_xp_ledger.ts
 */

async function main() {
    console.log('=== Fixing Missing xp_ledger Rows ===\n');

    const supabase = createServiceRoleClient();

    // Get all students
    const { data: students, error: studentError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'student');

    if (studentError) {
        console.error('Error fetching students:', studentError.message);
        return;
    }

    console.log(`Found ${students?.length ?? 0} students\n`);

    let fixed = 0;
    let already = 0;
    let errors = 0;

    for (const student of students ?? []) {
        // Check if xp_ledger exists
        const { data: existing, error: checkError } = await supabase
            .from('xp_ledger')
            .select('student_id')
            .eq('student_id', student.id)
            .maybeSingle();

        if (checkError) {
            console.error(`  ❌ Error checking ${student.email}:`, checkError.message);
            errors++;
            continue;
        }

        if (existing) {
            console.log(`  ✓ ${student.email} - already has xp_ledger`);
            already++;
            continue;
        }

        // Create missing row
        const { error: insertError } = await supabase
            .from('xp_ledger')
            .upsert({
                student_id: student.id,
                xp_total: 0,
                streak_days: 0,
                badge_ids: []
            }, { onConflict: 'student_id' });

        if (insertError) {
            console.error(`  ❌ Error creating for ${student.email}:`, insertError.message);
            errors++;
        } else {
            console.log(`  ✅ ${student.email} - created xp_ledger`);
            fixed++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Already had xp_ledger: ${already}`);
    console.log(`Created xp_ledger: ${fixed}`);
    console.log(`Errors: ${errors}`);
}

main().catch(console.error);
