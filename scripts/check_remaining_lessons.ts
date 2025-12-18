/**
 * Quick analysis of remaining lessons without practice
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    // Get all lessons with their module info
    const { data: lessons } = await supabase
        .from('lessons')
        .select(`
      id, 
      title, 
      module_id, 
      modules!inner(slug, subject, grade_band)
    `);

    // Get lessons that have skills linked
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id');

    const lessonsWithSkills = new Set(lessonSkills?.map(ls => ls.lesson_id) || []);

    // Find lessons still without practice
    interface MissingLesson {
        id: number;
        title: string;
        subject: string;
        grade: string;
    }

    const missing: MissingLesson[] = (lessons || [])
        .filter(l => !lessonsWithSkills.has(l.id))
        .map(l => ({
            id: l.id,
            title: l.title,
            subject: (l.modules as { subject?: string })?.subject || 'Unknown',
            grade: (l.modules as { grade_band?: string })?.grade_band || ''
        }));

    // Group by subject
    const bySubject: Record<string, number> = {};
    for (const lesson of missing) {
        bySubject[lesson.subject] = (bySubject[lesson.subject] || 0) + 1;
    }

    console.log('Lessons still missing practice by subject:');
    Object.entries(bySubject)
        .sort((a, b) => b[1] - a[1])
        .forEach(([s, count]) => {
            console.log(`  ${s}: ${count}`);
        });

    console.log('\nSample lessons still missing:');
    missing.slice(0, 15).forEach(l => {
        console.log(`  [${l.grade}] ${l.title}`);
    });

    console.log(`\nTotal still missing: ${missing.length}`);
}

main().catch(console.error);
