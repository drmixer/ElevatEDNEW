import { createServiceRoleClient } from './utils/supabase.js';

async function main() {
    const supabase = createServiceRoleClient();

    // Check assessments
    const { data: assessments, error: assessError } = await supabase
        .from('assessments')
        .select('id, title, module_id, metadata')
        .is('module_id', null)
        .limit(20);

    if (assessError) {
        console.error('Error loading assessments:', assessError);
        return;
    }

    console.log('Placement assessments (module_id is null):');
    assessments?.forEach((a) => {
        const meta = a.metadata as Record<string, unknown> | null;
        console.log(`  ID: ${a.id}, Title: ${a.title}, Purpose: ${meta?.purpose}, GradeBand: ${meta?.grade_band}`);
    });

    // Check sections for the 6-8 placement assessment (ID 2763)
    const assessmentId = 2763;
    console.log(`\nChecking sections for assessment ${assessmentId}:`);

    const { data: sections, error: sectionsError } = await supabase
        .from('assessment_sections')
        .select('id, title, section_order')
        .eq('assessment_id', assessmentId);

    if (sectionsError) {
        console.error('Error loading sections:', sectionsError);
    } else {
        console.log('Sections:', sections);

        if (sections?.length) {
            const sectionIds = sections.map(s => s.id);
            const { data: questions, error: qError } = await supabase
                .from('assessment_questions')
                .select('id, question_id, section_id')
                .in('section_id', sectionIds);

            if (qError) {
                console.error('Error loading questions:', qError);
            } else {
                console.log(`Total questions linked: ${questions?.length ?? 0}`);

                // Check question options
                if (questions?.length) {
                    const questionIds = questions.map(q => q.question_id);
                    const { data: options, error: optError } = await supabase
                        .from('question_options')
                        .select('id, question_id')
                        .in('question_id', questionIds);

                    if (optError) {
                        console.error('Error loading options:', optError);
                    } else {
                        console.log(`Total options: ${options?.length ?? 0}`);
                    }
                }
            }
        } else {
            console.log('No sections found for assessment 2763 - this is the issue!');
        }
    }
}

main().catch(console.error);
