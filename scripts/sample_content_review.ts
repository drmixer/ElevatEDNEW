/**
 * Sample Content Review Script
 * Pulls sample lessons and questions from different grades to review quality
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

interface Module {
    grade_band: string;
    subject: string;
    title: string;
}

interface Lesson {
    id: number;
    title: string;
    content: string | null;
    difficulty: number | null;
    modules: Module;
}

interface Question {
    id: number;
    question_text: string;
    difficulty: number | null;
}

interface QuestionOption {
    question_id: number;
    option_text: string;
    is_correct: boolean;
}

async function sampleContent() {
    console.log('\n' + '='.repeat(60));
    console.log('  SAMPLE LESSON & QUESTION CONTENT REVIEW');
    console.log('='.repeat(60) + '\n');

    // Get lessons from different grades and subjects
    const samples = [
        { grade: 'K', subject: 'Mathematics' },
        { grade: 'K', subject: 'English Language Arts' },
        { grade: '2', subject: 'Mathematics' },
        { grade: '2', subject: 'English Language Arts' },
        { grade: '5', subject: 'Mathematics' },
        { grade: '5', subject: 'English Language Arts' },
        { grade: '7', subject: 'Mathematics' },
        { grade: '7', subject: 'Science' },
    ];

    for (const sample of samples) {
        const { data: lessons } = await supabase
            .from('lessons')
            .select(`
        id, title, content, difficulty,
        modules!inner(grade_band, subject, title)
      `)
            .eq('modules.grade_band', sample.grade)
            .eq('modules.subject', sample.subject)
            .limit(1);

        if (lessons && lessons[0]) {
            const lesson = lessons[0] as unknown as Lesson;

            console.log('\n' + '-'.repeat(60));
            console.log(`GRADE ${sample.grade} | ${sample.subject}`);
            console.log('-'.repeat(60));
            console.log(`Lesson Title: ${lesson.title}`);
            console.log(`Difficulty Level: ${lesson.difficulty ?? 'Not set'}`);
            console.log(`Module: ${lesson.modules.title}`);
            console.log('\nContent Preview (first 800 chars):');
            console.log('-'.repeat(40));

            const content = lesson.content || '[No content]';
            console.log(content.substring(0, 800));
            if (content.length > 800) console.log('...[truncated]');

            // Get questions for this lesson
            const { data: skills } = await supabase
                .from('lesson_skills')
                .select('skill_id')
                .eq('lesson_id', lesson.id);

            if (skills && skills.length > 0) {
                const skillIds = skills.map(s => s.skill_id);
                const { data: qSkills } = await supabase
                    .from('question_skills')
                    .select('question_id')
                    .in('skill_id', skillIds)
                    .limit(3);

                if (qSkills && qSkills.length > 0) {
                    const qIds = qSkills.map(q => q.question_id);
                    const { data: questions } = await supabase
                        .from('question_bank')
                        .select('id, question_text, difficulty')
                        .in('id', qIds) as { data: Question[] | null };

                    const { data: options } = await supabase
                        .from('question_options')
                        .select('*')
                        .in('question_id', qIds) as { data: QuestionOption[] | null };

                    console.log('\nAssociated Practice Questions:');
                    console.log('-'.repeat(40));

                    for (const q of questions || []) {
                        console.log(`\n  Q: ${q.question_text}`);
                        console.log(`  Difficulty: ${q.difficulty ?? 'Not set'}`);
                        const opts = options?.filter(o => o.question_id === q.id) || [];
                        console.log('  Options:');
                        for (const opt of opts) {
                            const marker = opt.is_correct ? '✓' : ' ';
                            console.log(`    [${marker}] ${opt.option_text}`);
                        }
                    }
                } else {
                    console.log('\n  ⚠️  No questions linked to this lesson');
                }
            } else {
                console.log('\n  ⚠️  No skills linked to this lesson');
            }
        } else {
            console.log(`\n⚠️  No lessons found for Grade ${sample.grade} ${sample.subject}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  END OF SAMPLE REVIEW');
    console.log('='.repeat(60) + '\n');
}

sampleContent().catch(console.error);
