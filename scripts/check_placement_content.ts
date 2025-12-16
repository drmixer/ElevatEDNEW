import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkAssessmentContent() {
    const placementIds = [2759, 2761, 2763]; // The placement assessments found earlier

    console.log('Checking placement assessment content...\n');

    for (const assessmentId of placementIds) {
        console.log(`=== Assessment ${assessmentId} ===`);

        // Get assessment info
        const { data: assessment } = await supabase
            .from('assessments')
            .select('id, title, metadata')
            .eq('id', assessmentId)
            .single();

        console.log(`Title: ${assessment?.title}`);
        const meta = assessment?.metadata as Record<string, unknown> | null;
        console.log(`Grade Band: ${meta?.grade_band || meta?.gradeBand}`);

        // Check sections
        const { data: sections } = await supabase
            .from('assessment_sections')
            .select('id, section_order, title')
            .eq('assessment_id', assessmentId)
            .order('section_order');

        console.log(`Sections: ${sections?.length || 0}`);

        if (sections && sections.length > 0) {
            const sectionIds = sections.map(s => s.id);

            // Check questions in sections
            const { data: questionLinks } = await supabase
                .from('assessment_questions')
                .select('question_id, section_id')
                .in('section_id', sectionIds);

            console.log(`Question links: ${questionLinks?.length || 0}`);

            if (questionLinks && questionLinks.length > 0) {
                const questionIds = [...new Set(questionLinks.map(q => q.question_id))];

                // Check if questions exist in question_bank
                const { data: questions } = await supabase
                    .from('question_bank')
                    .select('id, prompt, question_type')
                    .in('id', questionIds);

                console.log(`Questions in question_bank: ${questions?.length || 0}`);

                if (questions && questions.length > 0) {
                    // Check options
                    const { data: options } = await supabase
                        .from('question_options')
                        .select('id, question_id')
                        .in('question_id', questionIds);

                    console.log(`Options: ${options?.length || 0}`);
                }
            }
        }
        console.log('');
    }
}

checkAssessmentContent().catch(console.error);
