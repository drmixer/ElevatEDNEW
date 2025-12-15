import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTestStudent() {
    // Find test student
    const { data: students } = await supabase
        .from('student_profiles')
        .select('id, first_name, last_name, grade, grade_band')
        .ilike('first_name', '%test%')
        .limit(5);

    console.log('Test students:', students);

    if (students && students.length > 0) {
        const testStudent = students[0];
        console.log('\nTest student profile:', testStudent);

        // Check their learning path
        const { data: pathEntries } = await supabase
            .from('student_learning_path')
            .select('id, position, module_id, status, metadata')
            .eq('student_id', testStudent.id)
            .order('position', { ascending: true })
            .limit(10);

        console.log('\nLearning path entries:', pathEntries?.length || 0);
        if (pathEntries && pathEntries.length > 0) {
            // Get module details for each entry
            const moduleIds = pathEntries.filter(e => e.module_id).map(e => e.module_id);
            const { data: modules } = await supabase
                .from('modules')
                .select('id, title, subject, grade_band')
                .in('id', moduleIds);

            const moduleMap = new Map(modules?.map(m => [m.id, m]) || []);

            console.log('\nPath entries with module details:');
            for (const entry of pathEntries.slice(0, 5)) {
                const module = moduleMap.get(entry.module_id);
                console.log(`  ${entry.position}. ${module?.title || 'Unknown'} (${module?.subject || '?'}, Grade ${module?.grade_band || '?'})`);
            }
        }
    }
}

checkTestStudent().catch(console.error);
