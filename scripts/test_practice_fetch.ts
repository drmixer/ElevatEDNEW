/**
 * Test Practice Questions Fetch
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchPracticeQuestions(lessonId: number, limit = 4) {
    // Get lesson skills
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('skill_id')
        .eq('lesson_id', lessonId);

    const skillIds = (lessonSkills || []).map(ls => ls.skill_id).filter(Boolean);
    console.log('Skills:', skillIds);

    if (!skillIds.length) {
        console.log('No skills found');
        return [];
    }

    // Get questions for skills
    const { data: questionSkills } = await supabase
        .from('question_skills')
        .select('question_id, skill_id')
        .in('skill_id', skillIds)
        .limit(limit * 4);

    const questionIds = [...new Set((questionSkills || []).map(qs => qs.question_id))];
    console.log('Question IDs:', questionIds.slice(0, 10));

    if (!questionIds.length) {
        console.log('No questions found');
        return [];
    }

    // Get question details
    const { data: questions } = await supabase
        .from('question_bank')
        .select('id, prompt, question_options(id, content, is_correct)')
        .in('id', questionIds.slice(0, limit));

    console.log('\nPractice Questions:');
    for (const q of questions || []) {
        console.log('Q' + q.id + ':', (q.prompt?.substring(0, 60) || '') + '...');
        console.log('  Options:', (q.question_options as Array<{ id: number; content: string; is_correct: boolean }>)?.length || 0);
    }

    return questions;
}

fetchPracticeQuestions(3, 4).catch(console.error);
