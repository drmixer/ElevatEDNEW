import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _STUDENT_ID = '7534cea0-d6a2-4cac-bca9-cfb16df83039';
const GRADE_LEVEL = 7;
const PATH_ID = 4; // Created in previous run
const SUBJECT_PRIORITY = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies', 'Electives'];

async function rebuildPath() {
    console.log('Adding entries to path 4 for test student (grade 7)...');

    // Get modules for grades 6, 7, 8
    const { data: modules, error: modError } = await supabase
        .from('modules')
        .select('id, title, subject, grade_band')
        .in('grade_band', ['6', '7', '8'])
        .order('id', { ascending: true });

    if (modError) {
        console.error('Error fetching modules:', modError);
        return;
    }

    // Sort by: exact grade match first, then by subject priority
    const sorted = [...(modules || [])].sort((a, b) => {
        const aExact = a.grade_band === String(GRADE_LEVEL);
        const bExact = b.grade_band === String(GRADE_LEVEL);
        if (aExact !== bExact) return bExact ? 1 : -1;
        const aPriority = SUBJECT_PRIORITY.indexOf(a.subject);
        const bPriority = SUBJECT_PRIORITY.indexOf(b.subject);
        const aIdx = aPriority >= 0 ? aPriority : 999;
        const bIdx = bPriority >= 0 ? bPriority : 999;
        return aIdx - bIdx;
    });

    const pathModules = sorted.slice(0, 10);
    console.log('Selected modules:');
    pathModules.forEach((m, i) => console.log(`  ${i + 1}. ${m.title}`));

    // Insert path entries without the reason field
    const entries = pathModules.map((m, i) => ({
        path_id: PATH_ID,
        position: i + 1,
        type: 'module',
        module_id: m.id,
        status: 'not_started',
        metadata: {
            module_title: m.title,
            subject: m.subject,
            grade_band: m.grade_band,
        },
    }));

    const { data: insertedEntries, error: entryError } = await supabase
        .from('student_path_entries')
        .insert(entries)
        .select();

    if (entryError) {
        console.error('Error inserting entries:', entryError);
        return;
    }

    console.log(`\n✅ Created ${insertedEntries?.length || 0} path entries for test student`);
}

rebuildPath().catch(console.error);
