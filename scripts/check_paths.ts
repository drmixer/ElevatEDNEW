import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const studentId = '7534cea0-d6a2-4cac-bca9-cfb16df83039';

    // Check student_paths table
    const { data: paths, error: pathsError } = await supabase
        .from('student_paths')
        .select('id, student_id, status, created_at')
        .eq('student_id', studentId)
        .limit(5);

    console.log('Paths error:', pathsError);
    console.log('Student paths:', paths);

    if (paths && paths.length > 0) {
        const pathId = paths[0].id;
        const { data: entries, error: entriesError } = await supabase
            .from('student_path_entries')
            .select('*')
            .eq('path_id', pathId)
            .order('position')
            .limit(10);

        console.log('Entries error:', entriesError);
        console.log('\nPath entries:', entries?.length || 0);
        if (entries && entries.length > 0) {
            entries.slice(0, 5).forEach(e => console.log('  ', e.position, e.type, e.module_id, e.status));
        }
    }
}

check().catch(console.error);
