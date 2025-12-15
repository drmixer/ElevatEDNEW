import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const STUDENT_ID = '7534cea0-d6a2-4cac-bca9-cfb16df83039';
const GRADE_LEVEL = 7;

// Prioritize subjects in order
const SUBJECT_PRIORITY = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies', 'Electives'];

async function rebuildPath() {
    console.log('Rebuilding learning path for test student...');

    // Get modules for grades 6, 7, 8 (student is grade 7)
    const { data: modules, error } = await supabase
        .from('modules')
        .select('id, title, subject, grade_band')
        .in('grade_band', ['6', '7', '8'])
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching modules:', error);
        return;
    }

    console.log(`Found ${modules?.length || 0} modules for grades 6-8`);

    // Sort by: exact grade match first, then by subject priority
    const sorted = [...(modules || [])].sort((a, b) => {
        // Exact grade first
        const aExact = a.grade_band === String(GRADE_LEVEL);
        const bExact = b.grade_band === String(GRADE_LEVEL);
        if (aExact !== bExact) return bExact ? 1 : -1;

        // Then by subject priority
        const aPriority = SUBJECT_PRIORITY.indexOf(a.subject);
        const bPriority = SUBJECT_PRIORITY.indexOf(b.subject);
        const aIdx = aPriority >= 0 ? aPriority : 999;
        const bIdx = bPriority >= 0 ? bPriority : 999;
        return aIdx - bIdx;
    });

    // Take top 10 modules
    const pathModules = sorted.slice(0, 10);
    console.log('\nSelected modules for path:');
    pathModules.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.title} (${m.subject}, Grade ${m.grade_band})`);
    });

    // Delete existing path entries
    const { error: deleteError } = await supabase
        .from('student_learning_path')
        .delete()
        .eq('student_id', STUDENT_ID);

    if (deleteError) {
        console.error('Error deleting old path:', deleteError);
        return;
    }

    // Insert new path entries
    const entries = pathModules.map((m, i) => ({
        student_id: STUDENT_ID,
        position: i + 1,
        type: 'module' as const,
        module_id: m.id,
        status: 'not_started' as const,
        reason: 'initial_path',
        metadata: {
            module_title: m.title,
            subject: m.subject,
            grade_band: m.grade_band,
        },
    }));

    const { data: insertedData, error: insertError } = await supabase
        .from('student_learning_path')
        .insert(entries)
        .select();

    if (insertError) {
        console.error('Error inserting path:', insertError);
        return;
    }

    console.log(`\n✅ Created ${insertedData?.length || 0} path entries for test student`);
}

rebuildPath().catch(console.error);
