/**
 * Generate Practice Questions for All Lessons
 * 
 * This script:
 * 1. Finds all lessons without practice questions
 * 2. Creates skills for each lesson based on its topic
 * 3. Generates 4 practice questions per lesson
 * 4. Links lessons to skills and questions
 * 
 * Usage:
 *   npx tsx scripts/generate_practice_for_all_lessons.ts --dry-run
 *   npx tsx scripts/generate_practice_for_all_lessons.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LessonToProcess {
    id: number;
    title: string;
    module_id: number;
    module_slug: string;
    module_title: string;
    subject_id: number;
    subject_name: string;
    grade_band: string;
    content: string | null;
}

interface GeneratedQuestion {
    prompt: string;
    type: 'multiple_choice';
    difficulty: number;
    explanation: string;
    options: Array<{
        text: string;
        isCorrect: boolean;
        feedback: string;
    }>;
}

// Question templates by subject
const QUESTION_TEMPLATES: Record<string, Array<(lesson: LessonToProcess, concept: string) => GeneratedQuestion>> = {
    'Mathematics': [
        (lesson, concept) => ({
            prompt: `What is the main concept of ${concept}?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `This question helps reinforce understanding of ${concept}.`,
            options: [
                { text: `Understanding how to apply ${concept.toLowerCase()} to solve problems`, isCorrect: true, feedback: 'Correct! This captures the main idea.' },
                { text: `Memorizing formulas without understanding`, isCorrect: false, feedback: 'Mathematics is about understanding, not just memorization.' },
                { text: `Only using calculators`, isCorrect: false, feedback: 'Calculators help but understanding is key.' },
                { text: `Avoiding word problems`, isCorrect: false, feedback: 'Word problems help apply concepts to real situations.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `When working with ${concept.toLowerCase()}, which strategy is most helpful?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Effective strategies make learning ${concept.toLowerCase()} easier.`,
            options: [
                { text: `Breaking down the problem into smaller steps`, isCorrect: true, feedback: 'Correct! Breaking problems into steps makes them manageable.' },
                { text: `Guessing randomly`, isCorrect: false, feedback: 'Strategic thinking leads to better results than guessing.' },
                { text: `Skipping steps to save time`, isCorrect: false, feedback: 'Skipping steps often leads to errors.' },
                { text: `Only looking at the answer`, isCorrect: false, feedback: 'Understanding the process is as important as the answer.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `Which real-life situation might involve ${concept.toLowerCase()}?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `${concept} has many real-world applications.`,
            options: [
                { text: `Problem-solving in everyday situations and careers`, isCorrect: true, feedback: 'Correct! Math concepts apply to many real situations.' },
                { text: `Only in math class`, isCorrect: false, feedback: 'Math is used everywhere in life!' },
                { text: `Never in real life`, isCorrect: false, feedback: 'Math skills are essential in daily life.' },
                { text: `Only by mathematicians`, isCorrect: false, feedback: 'Everyone uses math concepts regularly.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `What should you do if you get stuck on a ${concept.toLowerCase()} problem?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `Problem-solving strategies help overcome challenges in ${concept.toLowerCase()}.`,
            options: [
                { text: `Review the concept, try a different approach, or ask for help`, isCorrect: true, feedback: 'Correct! These are all good strategies when stuck.' },
                { text: `Give up immediately`, isCorrect: false, feedback: 'Persistence is key to learning math.' },
                { text: `Skip it and never return`, isCorrect: false, feedback: 'Coming back to challenges helps you grow.' },
                { text: `Copy someone else's answer`, isCorrect: false, feedback: 'Understanding is more valuable than copying.' },
            ],
        }),
    ],
    'Science': [
        (lesson, concept) => ({
            prompt: `What is the scientific method used when studying ${concept.toLowerCase()}?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `The scientific method is essential for understanding ${concept}.`,
            options: [
                { text: `Observe, hypothesize, experiment, analyze, conclude`, isCorrect: true, feedback: 'Correct! This is the scientific method.' },
                { text: `Guess without testing`, isCorrect: false, feedback: 'Science requires testing ideas.' },
                { text: `Accept everything you read`, isCorrect: false, feedback: 'Scientists question and verify information.' },
                { text: `Only memorize facts`, isCorrect: false, feedback: 'Science is about understanding, not just memorizing.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `Why is ${concept.toLowerCase()} important in science?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Understanding ${concept} helps us learn about the natural world.`,
            options: [
                { text: `It helps us understand and explain natural phenomena`, isCorrect: true, feedback: 'Correct! Science helps us understand our world.' },
                { text: `It has no practical use`, isCorrect: false, feedback: 'Science has many practical applications.' },
                { text: `Only scientists need to know`, isCorrect: false, feedback: 'Scientific literacy benefits everyone.' },
                { text: `It's only for tests`, isCorrect: false, feedback: 'Science knowledge applies beyond tests.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `When conducting an experiment about ${concept.toLowerCase()}, what is most important?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Good experimental practices are key to learning about ${concept}.`,
            options: [
                { text: `Controlling variables and recording accurate observations`, isCorrect: true, feedback: 'Correct! This ensures reliable results.' },
                { text: `Getting the answer you want`, isCorrect: false, feedback: 'Scientists accept results even if unexpected.' },
                { text: `Rushing through quickly`, isCorrect: false, feedback: 'Careful work leads to better science.' },
                { text: `Ignoring unexpected results`, isCorrect: false, feedback: 'Unexpected results often lead to discoveries.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `How does understanding ${concept.toLowerCase()} help in daily life?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} has applications in everyday life.`,
            options: [
                { text: `It helps us make informed decisions about health, environment, and technology`, isCorrect: true, feedback: 'Correct! Science helps us in many ways.' },
                { text: `It doesn't help at all`, isCorrect: false, feedback: 'Science knowledge is very useful daily.' },
                { text: `Only for science careers`, isCorrect: false, feedback: 'Everyone benefits from scientific understanding.' },
                { text: `Just for passing tests`, isCorrect: false, feedback: 'Science literacy helps beyond school.' },
            ],
        }),
    ],
    'English Language Arts': [
        (lesson, concept) => ({
            prompt: `What is the purpose of ${concept.toLowerCase()} in reading and writing?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} is an important skill in language arts.`,
            options: [
                { text: `To communicate ideas clearly and understand texts better`, isCorrect: true, feedback: 'Correct! Clear communication is the goal.' },
                { text: `To make reading harder`, isCorrect: false, feedback: 'ELA skills make reading easier, not harder.' },
                { text: `Only for English class`, isCorrect: false, feedback: 'These skills apply everywhere.' },
                { text: `To memorize rules`, isCorrect: false, feedback: 'Understanding is more important than memorizing.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `When practicing ${concept.toLowerCase()}, what strategy works best?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Effective strategies improve your ${concept.toLowerCase()} skills.`,
            options: [
                { text: `Read regularly, practice writing, and get feedback`, isCorrect: true, feedback: 'Correct! Practice with feedback helps you improve.' },
                { text: `Never read books`, isCorrect: false, feedback: 'Reading is essential for language development.' },
                { text: `Avoid writing`, isCorrect: false, feedback: 'Writing practice is crucial.' },
                { text: `Ignore feedback`, isCorrect: false, feedback: 'Feedback helps you grow as a communicator.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `How can you apply ${concept.toLowerCase()} outside of school?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `${concept} skills are valuable beyond the classroom.`,
            options: [
                { text: `In everyday communication, work, and personal expression`, isCorrect: true, feedback: 'Correct! Language skills apply everywhere.' },
                { text: `Never`, isCorrect: false, feedback: 'ELA skills are used constantly in life.' },
                { text: `Only when writing essays`, isCorrect: false, feedback: 'Communication happens in many forms.' },
                { text: `Just in English-speaking countries`, isCorrect: false, feedback: 'Language skills are universal.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `What makes ${concept.toLowerCase()} effective?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `Understanding what makes ${concept.toLowerCase()} effective helps you master it.`,
            options: [
                { text: `Clarity, purpose, and connecting with your audience`, isCorrect: true, feedback: 'Correct! These elements make communication effective.' },
                { text: `Using complicated words`, isCorrect: false, feedback: 'Clarity is more important than complexity.' },
                { text: `Writing as much as possible`, isCorrect: false, feedback: 'Quality matters more than quantity.' },
                { text: `Never revising your work`, isCorrect: false, feedback: 'Revision improves all writing.' },
            ],
        }),
    ],
    'Social Studies': [
        (lesson, concept) => ({
            prompt: `Why is studying ${concept.toLowerCase()} important?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} helps us understand our world and society.`,
            options: [
                { text: `To understand society, history, and how people interact`, isCorrect: true, feedback: 'Correct! Social studies helps us understand our world.' },
                { text: `It has no importance`, isCorrect: false, feedback: 'Social studies is essential for citizenship.' },
                { text: `Only for historians`, isCorrect: false, feedback: 'Everyone benefits from this knowledge.' },
                { text: `Just to pass tests`, isCorrect: false, feedback: 'This knowledge helps in life decisions.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `How does ${concept.toLowerCase()} connect to current events?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Understanding ${concept} helps us understand today's world.`,
            options: [
                { text: `Past events and systems shape present-day situations`, isCorrect: true, feedback: 'Correct! History and society are connected.' },
                { text: `It doesn't connect at all`, isCorrect: false, feedback: 'Current events have historical roots.' },
                { text: `Only in textbooks`, isCorrect: false, feedback: 'Social studies applies to real life.' },
                { text: `Just for debates`, isCorrect: false, feedback: 'This knowledge applies everywhere.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `What skills do you develop when learning about ${concept.toLowerCase()}?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `${concept} develops important life skills.`,
            options: [
                { text: `Critical thinking, perspective-taking, and informed citizenship`, isCorrect: true, feedback: 'Correct! These skills are valuable for life.' },
                { text: `Only memorization`, isCorrect: false, feedback: 'Social studies develops thinking skills.' },
                { text: `No useful skills`, isCorrect: false, feedback: 'Many skills come from social studies.' },
                { text: `Just test-taking`, isCorrect: false, feedback: 'Skills extend beyond tests.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `How can understanding ${concept.toLowerCase()} help you be a better citizen?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} prepares you for civic engagement.`,
            options: [
                { text: `By helping you make informed decisions and participate in society`, isCorrect: true, feedback: 'Correct! Knowledge empowers citizens.' },
                { text: `It can't help`, isCorrect: false, feedback: 'Informed citizens make better communities.' },
                { text: `Only for voting`, isCorrect: false, feedback: 'Citizenship involves more than voting.' },
                { text: `By avoiding participation`, isCorrect: false, feedback: 'Engagement improves society.' },
            ],
        }),
    ],
    'Electives': [
        (lesson, concept) => ({
            prompt: `What can you learn from studying ${concept.toLowerCase()}?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} teaches valuable skills and knowledge.`,
            options: [
                { text: `Practical skills, creativity, and new perspectives`, isCorrect: true, feedback: 'Correct! Electives offer diverse learning.' },
                { text: `Nothing useful`, isCorrect: false, feedback: 'All subjects offer valuable learning.' },
                { text: `Only hobbies`, isCorrect: false, feedback: 'These skills often become careers.' },
                { text: `Just for fun`, isCorrect: false, feedback: 'Learning can be fun AND useful.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `How might ${concept.toLowerCase()} apply to future careers?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `Many careers connect to ${concept}.`,
            options: [
                { text: `Many careers require these skills and knowledge`, isCorrect: true, feedback: 'Correct! Skills transfer to many careers.' },
                { text: `It never applies`, isCorrect: false, feedback: 'Skills from electives are widely applicable.' },
                { text: `Only for that specific job`, isCorrect: false, feedback: 'Skills transfer across fields.' },
                { text: `Careers don't need skills`, isCorrect: false, feedback: 'All careers require skills.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `What makes learning ${concept.toLowerCase()} engaging?`,
            type: 'multiple_choice',
            difficulty: 1,
            explanation: `${concept} offers unique ways to learn and create.`,
            options: [
                { text: `Hands-on activities, creativity, and personal expression`, isCorrect: true, feedback: 'Correct! Active learning is engaging.' },
                { text: `Only reading textbooks`, isCorrect: false, feedback: 'Electives often involve doing, not just reading.' },
                { text: `Memorizing facts`, isCorrect: false, feedback: 'Application and creation are key.' },
                { text: `Taking tests`, isCorrect: false, feedback: 'Learning goes beyond tests.' },
            ],
        }),
        (lesson, concept) => ({
            prompt: `Why is ${concept.toLowerCase()} valuable for personal growth?`,
            type: 'multiple_choice',
            difficulty: 2,
            explanation: `${concept} contributes to personal development.`,
            options: [
                { text: `It builds new abilities, confidence, and well-rounded knowledge`, isCorrect: true, feedback: 'Correct! Learning expands who you are.' },
                { text: `It doesn't help growth`, isCorrect: false, feedback: 'All learning contributes to growth.' },
                { text: `Only for grades`, isCorrect: false, feedback: 'Personal development matters beyond grades.' },
                { text: `Just to fill time`, isCorrect: false, feedback: 'Time spent learning is valuable.' },
            ],
        }),
    ],
};

// Extract concept from lesson title
function extractConcept(title: string): string {
    // Remove common prefixes
    let concept = title
        .replace(/^(Launch Lesson|Intro)[::]?\s*/i, '')
        .replace(/\s*Launch Lesson$/i, '')
        .replace(/\s*\(Grade \d+\)$/i, '')
        .replace(/\s*\(intro\)$/i, '')
        .replace(/\s*\(advanced\)$/i, '')
        .replace(/\s*\(basic\)$/i, '')
        .trim();

    // If too short, use the full title
    if (concept.length < 5) {
        concept = title;
    }

    return concept;
}

// Generate questions for a lesson
function generateQuestionsForLesson(lesson: LessonToProcess): GeneratedQuestion[] {
    const templates = QUESTION_TEMPLATES[lesson.subject_name] || QUESTION_TEMPLATES['Electives'];
    const concept = extractConcept(lesson.title);

    return templates.map(template => template(lesson, concept));
}

// Create skill name from lesson
function createSkillName(lesson: LessonToProcess): string {
    const concept = extractConcept(lesson.title);
    return `${lesson.subject_name}: ${concept}`;
}

async function getLessonsNeedingPractice(): Promise<LessonToProcess[]> {
    // Get all lessons with their module info
    // Note: modules.subject is a text field, not a FK
    // Must paginate because Supabase has 1000 row default limit

    const allLessons: Array<{ id: number; title: string; content: string | null; module_id: number; modules: { id: number; slug: string; title: string; grade_band: string; subject: string } }> = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data: batch, error: batchError } = await supabase
            .from('lessons')
            .select(`
          id,
          title,
          content,
          module_id,
          modules!inner (
            id,
            slug,
            title,
            grade_band,
            subject
          )
        `)
            .range(offset, offset + batchSize - 1);

        if (batchError) {
            console.error('Error fetching lessons:', batchError);
            break;
        }

        if (!batch || batch.length === 0) {
            break;
        }

        allLessons.push(...batch);
        console.log(`  Fetched ${allLessons.length} lessons...`);

        if (batch.length < batchSize) {
            break; // Last batch
        }

        offset += batchSize;
    }

    // Get subjects to map names to IDs
    const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name');

    const subjectMap = new Map<string, number>();
    for (const s of subjects || []) {
        subjectMap.set(s.name, s.id);
    }

    // Get lessons that already have skills linked (also paginate)
    const allLessonSkills: Array<{ lesson_id: number }> = [];
    offset = 0;

    while (true) {
        const { data: batch } = await supabase
            .from('lesson_skills')
            .select('lesson_id')
            .range(offset, offset + batchSize - 1);

        if (!batch || batch.length === 0) break;
        allLessonSkills.push(...batch);
        if (batch.length < batchSize) break;
        offset += batchSize;
    }

    const lessonsWithSkills = new Set(allLessonSkills.map(ls => ls.lesson_id));
    console.log(`  Lessons already with skills: ${lessonsWithSkills.size}`);

    // Filter and transform
    const needsPractice: LessonToProcess[] = [];

    for (const lesson of allLessons) {
        if (!lessonsWithSkills.has(lesson.id)) {
            const module = lesson.modules;
            const subjectName = module?.subject || 'Unknown';
            const subjectId = subjectMap.get(subjectName) || 0;

            needsPractice.push({
                id: lesson.id,
                title: lesson.title,
                module_id: lesson.module_id,
                module_slug: module?.slug || '',
                module_title: module?.title || '',
                subject_id: subjectId,
                subject_name: subjectName,
                grade_band: module?.grade_band || '',
                content: lesson.content,
            });
        }
    }

    return needsPractice;
}

async function createSkillIfNeeded(
    skillName: string,
    subjectId: number,
    dryRun: boolean
): Promise<number> {
    // Check if skill exists
    const { data: existing } = await supabase
        .from('skills')
        .select('id')
        .eq('name', skillName)
        .single();

    if (existing) {
        return existing.id;
    }

    if (dryRun) {
        console.log(`  [DRY RUN] Would create skill: ${skillName}`);
        return -1;
    }

    // Create new skill
    const { data: newSkill, error } = await supabase
        .from('skills')
        .insert({
            name: skillName,
            subject_id: subjectId,
            description: `Skill related to ${skillName}`,
        })
        .select('id')
        .single();

    if (error) {
        console.error(`Error creating skill: ${error.message}`);
        return -1;
    }

    return newSkill.id;
}

async function createQuestion(
    question: GeneratedQuestion,
    skillId: number,
    subjectId: number,
    gradeBand: string,
    dryRun: boolean
): Promise<number | null> {
    if (dryRun) {
        return -1;
    }

    // Create the question using correct column names from schema
    const { data: newQuestion, error: qError } = await supabase
        .from('question_bank')
        .insert({
            prompt: question.prompt,
            question_type: question.type,  // Changed from 'type'
            difficulty: question.difficulty,
            solution_explanation: question.explanation,  // Changed from 'explanation'
            subject_id: subjectId,
            // grade_band doesn't exist in this table
            // status doesn't exist in this table
            metadata: {
                grade_band: gradeBand,
                generated: true,
                generated_at: new Date().toISOString()
            }
        })
        .select('id')
        .single();

    if (qError) {
        console.error(`Error creating question: ${qError.message}`);
        return null;
    }

    // Create options using correct column names
    const optionsToInsert = question.options.map((opt, idx) => ({
        question_id: newQuestion.id,
        content: opt.text,  // Changed from 'text'
        is_correct: opt.isCorrect,
        feedback: opt.feedback,
        option_order: idx + 1,  // Changed from 'display_order'
    }));

    const { error: optError } = await supabase
        .from('question_options')
        .insert(optionsToInsert);

    if (optError) {
        console.error(`Error creating options: ${optError.message}`);
    }

    // Link question to skill
    const { error: linkError } = await supabase
        .from('question_skills')
        .insert({
            question_id: newQuestion.id,
            skill_id: skillId,
        });

    if (linkError) {
        console.error(`Error linking question to skill: ${linkError.message}`);
    }

    return newQuestion.id;
}

async function linkLessonToSkill(
    lessonId: number,
    skillId: number,
    dryRun: boolean
): Promise<boolean> {
    if (dryRun) {
        return true;
    }

    const { error } = await supabase
        .from('lesson_skills')
        .upsert({
            lesson_id: lessonId,
            skill_id: skillId,
        }, {
            onConflict: 'lesson_id,skill_id'
        });

    if (error && !error.message.includes('duplicate')) {
        console.error(`Error linking lesson to skill: ${error.message}`);
        return false;
    }

    return true;
}

async function processLesson(
    lesson: LessonToProcess,
    dryRun: boolean,
    stats: { skills: number; questions: number; links: number; errors: number }
): Promise<void> {
    // Create skill for this lesson
    const skillName = createSkillName(lesson);
    const skillId = await createSkillIfNeeded(skillName, lesson.subject_id, dryRun);

    if (skillId === -1 && !dryRun) {
        stats.errors++;
        return;
    }

    if (!dryRun && skillId > 0) {
        stats.skills++;
    }

    // Link lesson to skill
    const linked = await linkLessonToSkill(lesson.id, skillId, dryRun);
    if (linked && !dryRun) {
        stats.links++;
    }

    // Generate questions
    const questions = generateQuestionsForLesson(lesson);

    for (const question of questions) {
        const questionId = await createQuestion(
            question,
            skillId,
            lesson.subject_id,
            lesson.grade_band,
            dryRun
        );

        if (questionId && !dryRun) {
            stats.questions++;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const apply = args.includes('--apply');
    const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;

    if (!dryRun && !apply) {
        console.log('Usage: npx tsx scripts/generate_practice_for_all_lessons.ts [--dry-run | --apply] [--limit=N]');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run  Preview what would be created without making changes');
        console.log('  --apply    Actually create skills, questions, and links');
        console.log('  --limit=N  Only process N lessons (for testing)');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('GENERATE PRACTICE QUESTIONS FOR ALL LESSONS');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY (making changes)'}`);
    console.log('');

    // Get lessons needing practice
    console.log('Fetching lessons without practice questions...');
    let lessons = await getLessonsNeedingPractice();
    console.log(`Found ${lessons.length} lessons needing practice questions.`);

    if (limit > 0) {
        lessons = lessons.slice(0, limit);
        console.log(`Processing only first ${limit} lessons (--limit flag).`);
    }

    // Show distribution by subject
    const bySubject = new Map<string, number>();
    for (const lesson of lessons) {
        bySubject.set(lesson.subject_name, (bySubject.get(lesson.subject_name) || 0) + 1);
    }

    console.log('\nDistribution by subject:');
    for (const [subject, count] of Array.from(bySubject.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${subject}: ${count} lessons`);
    }

    console.log('');

    // Process lessons
    const stats = { skills: 0, questions: 0, links: 0, errors: 0 };
    let processed = 0;

    for (const lesson of lessons) {
        processed++;
        if (processed % 50 === 0 || processed === lessons.length) {
            console.log(`Processing ${processed}/${lessons.length}...`);
        }

        try {
            await processLesson(lesson, dryRun, stats);
        } catch (e) {
            console.error(`Error processing lesson ${lesson.id}: ${e}`);
            stats.errors++;
        }
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Lessons processed: ${processed}`);
    console.log(`Skills ${dryRun ? 'would be' : ''} created: ${stats.skills}`);
    console.log(`Questions ${dryRun ? 'would be' : ''} created: ${stats.questions}`);
    console.log(`Lesson-skill links ${dryRun ? 'would be' : ''} created: ${stats.links}`);
    console.log(`Errors: ${stats.errors}`);

    if (dryRun) {
        console.log('');
        console.log('This was a dry run. To apply changes, run with --apply');
    }
}

main().catch(console.error);
