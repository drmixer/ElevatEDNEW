import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    // Check what grade_band values exist in modules
    const { data: modules, error } = await supabase
        .from('modules')
        .select('grade_band, subject')
        .order('grade_band');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const gradeBands = new Map<string, number>();
    const subjects = new Map<string, number>();
    modules?.forEach(m => {
        gradeBands.set(m.grade_band, (gradeBands.get(m.grade_band) || 0) + 1);
        subjects.set(m.subject, (subjects.get(m.subject) || 0) + 1);
    });

    console.log('Grade bands in modules table:');
    for (const [band, count] of gradeBands) {
        console.log('  ', band, ':', count, 'modules');
    }

    console.log('\nSubjects:');
    for (const [subj, count] of subjects) {
        console.log('  ', subj, ':', count);
    }

    // Check if there are any modules for grades 6, 7, or 8
    const { data: grade678 } = await supabase
        .from('modules')
        .select('id, title, subject, grade_band')
        .in('grade_band', ['6', '7', '8', '6-8'])
        .limit(10);

    console.log('\nModules for grades 6-8:', grade678?.length || 0);
    if (grade678 && grade678.length > 0) {
        grade678.slice(0, 5).forEach(m => console.log('  ', m.title, '-', m.subject, '- Grade', m.grade_band));
    }
}

check().catch(console.error);
