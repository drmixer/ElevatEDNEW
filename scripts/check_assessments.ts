import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    // Check assessments structure
    const { data: assessments, error } = await supabase
        .from('assessments')
        .select('*')
        .limit(10);

    console.log('Assessments sample (first 10):');
    if (assessments && assessments.length > 0) {
        console.log('Columns:', Object.keys(assessments[0]).join(', '));
        assessments.forEach(a => {
            console.log(`  ID ${a.id}: ${a.name || a.title || 'no name'} - grade_band: ${a.grade_band || 'null'}`);
        });
    } else {
        console.log('No assessments found');
    }

    if (error) console.log('Error:', error);

    // Check assessment_questions structure
    const { data: questions } = await supabase
        .from('assessment_questions')
        .select('*')
        .limit(3);

    console.log('\nAssessment questions sample:');
    if (questions && questions.length > 0) {
        console.log('Columns:', Object.keys(questions[0]).join(', '));
        questions.forEach(q => {
            console.log(`  Q${q.id}: assessment_id=${q.assessment_id}, type=${q.type || q.question_type}`);
        });
    }
}

check().catch(console.error);
