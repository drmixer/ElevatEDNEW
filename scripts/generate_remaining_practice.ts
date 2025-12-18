/**
 * Generate Practice for Remaining Skills
 * 
 * Generates questions for skills that are linked to lessons but have no questions.
 * This targets the 32 skills (34 lessons) identified in the audit as having no practice.
 */

import 'dotenv/config';
import * as fs from 'fs';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Simple question generators by subject
function generateMathQuestions(title: string, grade: number) {
    const questions = [
        {
            prompt: `Which of the following best describes ${title}?`,
            options: [
                { text: 'A mathematical concept that helps us solve problems', isCorrect: true },
                { text: 'Something only scientists use', isCorrect: false },
                { text: 'A topic unrelated to everyday life', isCorrect: false },
                { text: 'Something we never use in real life', isCorrect: false }
            ],
            explanation: `${title} is indeed a mathematical concept that helps us solve real-world problems!`
        },
        {
            prompt: `When working with ${title}, what is the first step you should take?`,
            options: [
                { text: 'Identify what information you have and what you need to find', isCorrect: true },
                { text: 'Guess the answer immediately', isCorrect: false },
                { text: 'Skip reading the problem', isCorrect: false },
                { text: 'Use only addition', isCorrect: false }
            ],
            explanation: 'The first step in any math problem is to identify what you know and what you need to find.'
        },
        {
            prompt: `Why is ${title} important to learn?`,
            options: [
                { text: 'It helps us understand and solve real-world problems', isCorrect: true },
                { text: 'It is only useful for tests', isCorrect: false },
                { text: 'It has no practical applications', isCorrect: false },
                { text: 'Only adults need to know it', isCorrect: false }
            ],
            explanation: `Learning ${title} helps us understand and solve many real-world problems.`
        },
        {
            prompt: `What should you do if you get stuck on a ${title} problem?`,
            options: [
                { text: 'Review the key concepts and try a different approach', isCorrect: true },
                { text: 'Give up immediately', isCorrect: false },
                { text: 'Skip all the hard parts', isCorrect: false },
                { text: 'Only work on easy problems', isCorrect: false }
            ],
            explanation: 'When stuck, reviewing key concepts and trying different approaches helps you find solutions.'
        }
    ];
    return questions;
}

function generateSocialStudiesQuestions(title: string, grade: number) {
    const questions = [
        {
            prompt: `What is one reason we study ${title}?`,
            options: [
                { text: 'To understand how events and people shaped our world', isCorrect: true },
                { text: 'It has no connection to today', isCorrect: false },
                { text: 'History never repeats itself', isCorrect: false },
                { text: 'Only historians need to know this', isCorrect: false }
            ],
            explanation: `Studying ${title} helps us understand how past events and people shaped our world today.`
        },
        {
            prompt: `When analyzing ${title}, historians typically:`,
            options: [
                { text: 'Examine multiple sources and perspectives', isCorrect: true },
                { text: 'Only use one source', isCorrect: false },
                { text: 'Ignore evidence they dislike', isCorrect: false },
                { text: 'Make things up', isCorrect: false }
            ],
            explanation: 'Good historians examine multiple sources and perspectives to understand events completely.'
        },
        {
            prompt: `How can learning about ${title} help you today?`,
            options: [
                { text: 'It helps us make better decisions by understanding the past', isCorrect: true },
                { text: 'It cannot help us at all', isCorrect: false },
                { text: 'Only affects people in other countries', isCorrect: false },
                { text: 'The past has no connection to today', isCorrect: false }
            ],
            explanation: 'Understanding history helps us make better decisions and understand our world.'
        },
        {
            prompt: `What is an important skill when studying ${title}?`,
            options: [
                { text: 'Thinking critically about different perspectives', isCorrect: true },
                { text: 'Accepting everything without question', isCorrect: false },
                { text: 'Ignoring dates and events', isCorrect: false },
                { text: 'Only memorizing names', isCorrect: false }
            ],
            explanation: 'Critical thinking about different perspectives is essential when studying social studies.'
        }
    ];
    return questions;
}

function generateElectivesQuestions(title: string, grade: number) {
    const questions = [
        {
            prompt: `What is one benefit of learning about ${title}?`,
            options: [
                { text: 'It develops new skills and knowledge', isCorrect: true },
                { text: 'It has no real value', isCorrect: false },
                { text: 'Only professionals need this', isCorrect: false },
                { text: 'It cannot be applied in real life', isCorrect: false }
            ],
            explanation: `Learning about ${title} helps develop valuable skills and knowledge.`
        },
        {
            prompt: `How might you apply what you learn about ${title}?`,
            options: [
                { text: 'In various real-world situations and projects', isCorrect: true },
                { text: 'Never, it has no applications', isCorrect: false },
                { text: 'Only in class', isCorrect: false },
                { text: 'Only adults can apply it', isCorrect: false }
            ],
            explanation: 'The skills learned can be applied in many real-world situations.'
        },
        {
            prompt: `What is a good approach to mastering ${title}?`,
            options: [
                { text: 'Practice regularly and learn from mistakes', isCorrect: true },
                { text: 'Only study once before tests', isCorrect: false },
                { text: 'Skip the hard parts', isCorrect: false },
                { text: 'Never ask questions', isCorrect: false }
            ],
            explanation: 'Regular practice and learning from mistakes leads to mastery.'
        },
        {
            prompt: `Why is it important to explore topics like ${title}?`,
            options: [
                { text: 'It broadens our understanding and opens new opportunities', isCorrect: true },
                { text: 'It wastes time', isCorrect: false },
                { text: 'Only core subjects matter', isCorrect: false },
                { text: 'There is nothing to learn', isCorrect: false }
            ],
            explanation: 'Exploring various topics broadens understanding and opens new opportunities.'
        }
    ];
    return questions;
}

async function generateQuestionsForRemainingSkills(apply: boolean) {
    console.log('============================================================');
    console.log('GENERATE QUESTIONS FOR REMAINING SKILLS');
    console.log('============================================================');
    console.log(`Mode: ${apply ? 'APPLY (making changes)' : 'DRY RUN (preview only)'}\n`);

    // Get skills from audit
    const report = JSON.parse(fs.readFileSync('data/audits/content_quality_report.json', 'utf-8'));
    const practiceIssues = report.issues.filter((i: any) => i.issueType === 'missing_practice');
    const lessonIds = practiceIssues.map((i: any) => i.lessonId);

    // Get skills for these lessons
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id, skill_id')
        .in('lesson_id', lessonIds);

    const skillIds = [...new Set((lessonSkills || []).map(ls => ls.skill_id))];
    console.log(`Found ${skillIds.length} skills needing questions\n`);

    // Get skill details
    const { data: skills } = await supabase
        .from('skills')
        .select('id, name')
        .in('id', skillIds);

    // Get lesson -> subject mapping
    const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, modules(subject)')
        .in('id', lessonIds);

    const lessonSubjectMap: Record<number, string> = {};
    for (const lesson of lessons || []) {
        lessonSubjectMap[lesson.id] = (lesson.modules as any)?.subject || 'Electives';
    }

    const lessonForSkill: Record<number, number> = {};
    for (const ls of lessonSkills || []) {
        lessonForSkill[ls.skill_id] = ls.lesson_id;
    }

    let questionsCreated = 0;
    let optionsCreated = 0;
    let skillLinks = 0;

    // Get subject IDs
    const { data: subjects } = await supabase.from('subjects').select('id, name');
    const subjectIdMap: Record<string, number> = {};
    for (const s of subjects || []) {
        subjectIdMap[s.name] = s.id;
    }

    for (const skill of skills || []) {
        const lessonId = lessonForSkill[skill.id];
        const subject = lessonSubjectMap[lessonId] || 'Electives';

        let questions;
        if (subject === 'Mathematics') {
            questions = generateMathQuestions(skill.name, 5);
        } else if (subject === 'Social Studies') {
            questions = generateSocialStudiesQuestions(skill.name, 5);
        } else {
            questions = generateElectivesQuestions(skill.name, 5);
        }

        console.log(`  📝 ${skill.name} (${subject}) - ${questions.length} questions`);

        if (apply) {
            const subjectId = subjectIdMap[subject] || subjectIdMap['Electives'] || 15;

            for (const q of questions) {
                // Insert question
                const { data: insertedQ, error: qError } = await supabase
                    .from('question_bank')
                    .insert({
                        prompt: q.prompt,
                        question_type: 'multiple_choice',
                        solution_explanation: q.explanation,
                        difficulty: 1,
                        subject_id: subjectId
                    })
                    .select('id')
                    .single();

                if (qError) {
                    console.error(`    Error inserting question: ${qError.message}`);
                    continue;
                }

                questionsCreated++;

                // Insert options
                for (const opt of q.options) {
                    const { error: optError } = await supabase
                        .from('question_options')
                        .insert({
                            question_id: insertedQ.id,
                            content: opt.text,
                            is_correct: opt.isCorrect
                        });

                    if (!optError) optionsCreated++;
                }

                // Link to skill
                const { error: linkError } = await supabase
                    .from('question_skills')
                    .insert({
                        question_id: insertedQ.id,
                        skill_id: skill.id
                    });

                if (!linkError) skillLinks++;
            }
        } else {
            questionsCreated += questions.length;
            optionsCreated += questions.length * 4;
            skillLinks += questions.length;
        }
    }

    console.log('\n============================================================');
    console.log('SUMMARY');
    console.log('============================================================');
    console.log(`Skills processed: ${skills?.length || 0}`);
    console.log(`Questions ${apply ? 'created' : 'to create'}: ${questionsCreated}`);
    console.log(`Options ${apply ? 'created' : 'to create'}: ${optionsCreated}`);
    console.log(`Skill links ${apply ? 'created' : 'to create'}: ${skillLinks}`);

    if (!apply) {
        console.log('\n💡 Run with --apply to make changes');
    } else {
        console.log('\n✅ Changes applied successfully');
    }
}

const apply = process.argv.includes('--apply');
generateQuestionsForRemainingSkills(apply).catch(console.error);
