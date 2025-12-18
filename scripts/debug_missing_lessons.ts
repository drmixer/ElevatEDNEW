/**
 * Debug: Find why 190 lessons aren't getting practice questions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    // Get ALL lessons (not using inner join)
    const { data: allLessons, error: allError } = await supabase
        .from('lessons')
        .select('id, title, module_id');

    console.log('Total lessons in lessons table:', allLessons?.length);
    if (allError) console.log('Error:', allError);

    // Get lessons with modules using inner join (what our script uses)
    const { data: lessonsWithModules, error: joinError } = await supabase
        .from('lessons')
        .select(`
      id,
      title,
      module_id,
      modules!inner(id, slug, subject, grade_band)
    `);

    console.log('Lessons with modules (inner join):', lessonsWithModules?.length);
    if (joinError) console.log('Join error:', joinError);

    // Find lessons without modules
    const withModuleIds = new Set(lessonsWithModules?.map(l => l.id) || []);
    const orphanLessons = (allLessons || []).filter(l => !withModuleIds.has(l.id));

    console.log('Orphan lessons (no module):', orphanLessons.length);

    if (orphanLessons.length > 0) {
        console.log('\nSample orphan lessons:');
        orphanLessons.slice(0, 10).forEach(l => {
            console.log(`  ID ${l.id}: ${l.title} (module_id: ${l.module_id})`);
        });
    }

    // Check if those orphan lessons have skills
    const { data: orphanSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id')
        .in('lesson_id', orphanLessons.map(l => l.id));

    console.log('\nOrphan lessons with skills:', orphanSkills?.length || 0);
}

main().catch(console.error);
