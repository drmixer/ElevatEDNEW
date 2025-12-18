/**
 * Seed Practice Questions Script
 *
 * Seeds practice questions from authored JSON files and links them to lessons via skills.
 * This establishes the lesson_skills and question_skills relationships.
 *
 * Run: npx tsx scripts/seed_practice_questions.ts [--dry-run] [--apply]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Practice data files to process
const PRACTICE_FILES = [
    'authored_practice_items.json',
    'ela_authored_practice_items.json',
    'science_authored_practice_items.json',
    'arts_music_authored_practice_items.json',
    'cs_authored_practice_items.json',
    'health_pe_authored_practice_items.json',
    'financial_literacy_authored_practice_items.json',
];

interface PracticeOption {
    text: string;
    isCorrect: boolean;
    feedback?: string;
}

interface PracticeItem {
    moduleSlug: string;
    lessonSlug?: string;
    prompt: string;
    type: string;
    difficulty: number;
    explanation?: string;
    skills: string[];
    standards?: string[];
    tags?: string[];
    options: PracticeOption[];
}

interface ModuleRecord {
    id: number;
    slug: string;
    subject: string;
}

interface LessonRecord {
    id: number;
    slug: string;
    module_id: number;
}

interface SkillRecord {
    id: number;
    name: string;
    subject_id: number;
}

interface SubjectRecord {
    id: number;
    name: string;
}

// Cache for database lookups
const moduleCache = new Map<string, ModuleRecord>();
const lessonCache = new Map<string, LessonRecord>();
const skillCache = new Map<string, SkillRecord>();
const subjectCache = new Map<string, SubjectRecord>();

async function loadModules(): Promise<void> {
    const { data, error } = await supabase
        .from('modules')
        .select('id, slug, subject');

    if (error) throw new Error(`Failed to load modules: ${error.message}`);

    for (const module of data || []) {
        moduleCache.set(module.slug, {
            id: module.id as number,
            slug: module.slug as string,
            subject: module.subject as string,
        });
    }
    console.log(`Loaded ${moduleCache.size} modules`);
}

async function loadLessons(): Promise<void> {
    const { data, error } = await supabase
        .from('lessons')
        .select('id, slug, module_id');

    if (error) throw new Error(`Failed to load lessons: ${error.message}`);

    for (const lesson of data || []) {
        lessonCache.set(lesson.slug, {
            id: lesson.id as number,
            slug: lesson.slug as string,
            module_id: lesson.module_id as number,
        });
    }
    console.log(`Loaded ${lessonCache.size} lessons`);
}

async function loadSubjects(): Promise<void> {
    const { data, error } = await supabase
        .from('subjects')
        .select('id, name');

    if (error) throw new Error(`Failed to load subjects: ${error.message}`);

    for (const subject of data || []) {
        subjectCache.set(subject.name, {
            id: subject.id as number,
            name: subject.name as string,
        });
    }
    console.log(`Loaded ${subjectCache.size} subjects`);
}

async function loadSkills(): Promise<void> {
    const { data, error } = await supabase
        .from('skills')
        .select('id, name, subject_id');

    if (error) throw new Error(`Failed to load skills: ${error.message}`);

    for (const skill of data || []) {
        skillCache.set(skill.name, {
            id: skill.id as number,
            name: skill.name as string,
            subject_id: skill.subject_id as number,
        });
    }
    console.log(`Loaded ${skillCache.size} existing skills`);
}

async function ensureSkill(skillName: string, subjectName: string): Promise<number> {
    // Check cache first
    if (skillCache.has(skillName)) {
        return skillCache.get(skillName)!.id;
    }

    // Get subject ID
    let subjectId: number | null = null;
    if (subjectCache.has(subjectName)) {
        subjectId = subjectCache.get(subjectName)!.id;
    }

    // Try to find or create the skill
    const { data: existing } = await supabase
        .from('skills')
        .select('id')
        .eq('name', skillName)
        .maybeSingle();

    if (existing?.id) {
        skillCache.set(skillName, {
            id: existing.id as number,
            name: skillName,
            subject_id: subjectId!,
        });
        return existing.id as number;
    }

    // Create new skill
    const { data: inserted, error } = await supabase
        .from('skills')
        .insert({
            name: skillName,
            subject_id: subjectId,
            description: `Skill: ${skillName.replace(/_/g, ' ')}`,
            metadata: { seeded: true, seeded_at: new Date().toISOString() },
        })
        .select('id')
        .single();

    if (error) {
        console.warn(`Failed to create skill ${skillName}: ${error.message}`);
        return 0;
    }

    const skillId = inserted.id as number;
    skillCache.set(skillName, {
        id: skillId,
        name: skillName,
        subject_id: subjectId!,
    });

    return skillId;
}

async function findLessonForModule(moduleSlug: string, lessonSlug?: string): Promise<number | null> {
    // Try explicit lesson slug first
    if (lessonSlug && lessonCache.has(lessonSlug)) {
        return lessonCache.get(lessonSlug)!.id;
    }

    // Find module
    const module = moduleCache.get(moduleSlug);
    if (!module) return null;

    // Find any lesson for this module
    for (const lesson of lessonCache.values()) {
        if (lesson.module_id === module.id) {
            return lesson.id;
        }
    }

    // Try fuzzy matching on slug patterns
    const modulePattern = moduleSlug.replace(/-/g, '');
    for (const [slug, lesson] of lessonCache.entries()) {
        if (slug.replace(/-/g, '').includes(modulePattern)) {
            return lesson.id;
        }
    }

    return null;
}

async function linkLessonToSkill(lessonId: number, skillId: number, dryRun: boolean): Promise<boolean> {
    if (dryRun) return true;

    const { error } = await supabase
        .from('lesson_skills')
        .upsert(
            { lesson_id: lessonId, skill_id: skillId },
            { onConflict: 'lesson_id,skill_id' }
        );

    return !error;
}

async function createQuestion(
    item: PracticeItem,
    skillIds: number[],
    subjectId: number | null,
    dryRun: boolean
): Promise<number | null> {
    if (dryRun) return 1; // Return dummy ID for dry run

    // First check if question already exists
    const { data: existing } = await supabase
        .from('question_bank')
        .select('id')
        .eq('prompt', item.prompt)
        .maybeSingle();

    if (existing?.id) {
        // Link existing question to skills
        for (const skillId of skillIds) {
            await supabase
                .from('question_skills')
                .upsert(
                    { question_id: existing.id as number, skill_id: skillId },
                    { onConflict: 'question_id,skill_id' }
                );
        }
        return existing.id as number;
    }

    // Use the first available subject if none provided
    if (!subjectId && subjectCache.size > 0) {
        subjectId = Array.from(subjectCache.values())[0].id;
    }

    // Create the question in question_bank
    const { data, error } = await supabase
        .from('question_bank')
        .insert({
            subject_id: subjectId,
            question_type: item.type || 'multiple_choice',
            prompt: item.prompt,
            solution_explanation: item.explanation || null,
            difficulty: item.difficulty || 2,
            tags: item.tags || ['practice'],
            metadata: {
                seeded: true,
                seeded_at: new Date().toISOString(),
                moduleSlug: item.moduleSlug,
                standards: item.standards || [],
            },
        })
        .select('id')
        .single();

    if (error) {
        console.warn(`Failed to create question: ${error.message}`);
        return null;
    }

    const questionId = data.id as number;

    // Create options in question_options table
    const optionsToInsert = item.options.map((opt, index) => ({
        question_id: questionId,
        option_order: index,
        content: opt.text,
        is_correct: opt.isCorrect,
        feedback: opt.feedback || null,
    }));

    const { error: optError } = await supabase
        .from('question_options')
        .insert(optionsToInsert);

    if (optError) {
        console.warn(`Failed to create options for question ${questionId}: ${optError.message}`);
    }

    // Link question to skills
    for (const skillId of skillIds) {
        await supabase
            .from('question_skills')
            .upsert(
                { question_id: questionId, skill_id: skillId },
                { onConflict: 'question_id,skill_id' }
            );
    }

    return questionId;
}

async function processPracticeFile(filename: string, dryRun: boolean): Promise<{
    questionsCreated: number;
    skillsLinked: number;
    errors: number;
}> {
    const filepath = path.join(process.cwd(), 'data', 'practice', filename);

    if (!fs.existsSync(filepath)) {
        console.warn(`File not found: ${filepath}`);
        return { questionsCreated: 0, skillsLinked: 0, errors: 0 };
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    let parsedData: unknown;

    try {
        parsedData = JSON.parse(content);
    } catch (e) {
        console.error(`Failed to parse ${filename}: ${e}`);
        return { questionsCreated: 0, skillsLinked: 0, errors: 1 };
    }

    // Handle both array format and object-keyed format
    let items: PracticeItem[] = [];

    if (Array.isArray(parsedData)) {
        // Direct array format
        items = parsedData as PracticeItem[];
    } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Object keyed by module slug
        for (const [moduleSlug, questions] of Object.entries(parsedData)) {
            if (Array.isArray(questions)) {
                for (const q of questions) {
                    items.push({
                        ...q,
                        moduleSlug,
                        skills: q.skills || [moduleSlug.split('-').slice(-1)[0]], // Extract skill from slug if not provided
                    });
                }
            }
        }
    }

    if (items.length === 0) {
        console.warn(`${filename} has no items`);
        return { questionsCreated: 0, skillsLinked: 0, errors: 0 };
    }

    let questionsCreated = 0;
    let skillsLinked = 0;
    let errors = 0;

    for (const item of items) {
        if (!item.prompt || !item.options || !item.skills) {
            continue;
        }

        // Find the lesson
        const lessonId = await findLessonForModule(item.moduleSlug, item.lessonSlug);

        // Get subject for skill creation
        const module = moduleCache.get(item.moduleSlug);
        const subjectName = module?.subject || 'General';

        // Ensure skills exist and link to lesson
        const skillIds: number[] = [];
        for (const skillName of item.skills) {
            const skillId = await ensureSkill(skillName, subjectName);
            if (skillId > 0) {
                skillIds.push(skillId);

                // Link skill to lesson if we found one
                if (lessonId) {
                    const linked = await linkLessonToSkill(lessonId, skillId, dryRun);
                    if (linked) skillsLinked++;
                }
            }
        }

        // Create the question
        if (skillIds.length > 0) {
            const subjectId = subjectCache.get(subjectName)?.id || null;
            const questionId = await createQuestion(item, skillIds, subjectId, dryRun);
            if (questionId) {
                questionsCreated++;
            } else {
                errors++;
            }
        }
    }

    return { questionsCreated, skillsLinked, errors };
}

async function main() {
    console.log('=== SEED PRACTICE QUESTIONS ===\n');

    const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
        console.log('🚀 APPLY MODE - Changes will be saved to database\n');
    }

    // Load cached data
    console.log('Loading existing data...');
    await loadSubjects();
    await loadModules();
    await loadLessons();
    await loadSkills();
    console.log('');

    let totalQuestions = 0;
    let totalSkillsLinked = 0;
    let totalErrors = 0;

    for (const filename of PRACTICE_FILES) {
        console.log(`Processing ${filename}...`);
        const result = await processPracticeFile(filename, dryRun);

        console.log(`  Questions: ${result.questionsCreated}, Skills linked: ${result.skillsLinked}, Errors: ${result.errors}`);

        totalQuestions += result.questionsCreated;
        totalSkillsLinked += result.skillsLinked;
        totalErrors += result.errors;
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`Total questions created/found: ${totalQuestions}`);
    console.log(`Total lesson-skill links: ${totalSkillsLinked}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`New skills created: ${skillCache.size}`);

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run with --apply to save changes.');
    } else {
        console.log('\n✅ Changes have been applied to the database!');
    }
}

main().catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
