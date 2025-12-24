/**
 * Fix Subject Mislabeling Script
 * 
 * This script fixes lessons that have incorrect subject assignments.
 * For example, "Identifying Main Idea" should be ELA, not Math.
 * 
 * Run with: npx ts-node scripts/fix_subject_mislabeling.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Keywords that indicate a lesson should be a specific subject
const SUBJECT_INDICATORS: Record<string, string[]> = {
    english: [
        'main idea',
        'reading comprehension',
        'vocabulary',
        'grammar',
        'punctuation',
        'spelling',
        'writing',
        'paragraph',
        'sentence',
        'prefix',
        'suffix',
        'root word',
        'phonics',
        'rhyme',
        'syllable',
        'noun',
        'verb',
        'adjective',
        'adverb',
        'pronoun',
        'conjunction',
        'preposition',
        'fiction',
        'nonfiction',
        'poetry',
        'narrative',
        'summary',
        'inference',
        'context clue',
        'author',
        'character',
        'setting',
        'plot',
        'theme',
        'genre',
    ],
    math: [
        'addition',
        'subtraction',
        'multiplication',
        'division',
        'fraction',
        'decimal',
        'percent',
        'geometry',
        'algebra',
        'equation',
        'number',
        'digit',
        'place value',
        'measurement',
        'perimeter',
        'area',
        'volume',
        'angle',
        'triangle',
        'rectangle',
        'circle',
        'graph',
        'data',
        'probability',
        'ratio',
        'proportion',
    ],
    science: [
        'biology',
        'chemistry',
        'physics',
        'ecosystem',
        'habitat',
        'organism',
        'cell',
        'atom',
        'molecule',
        'energy',
        'force',
        'motion',
        'matter',
        'states of matter',
        'plant',
        'animal',
        'weather',
        'climate',
        'earth',
        'space',
        'solar system',
        'planet',
        'gravity',
        'magnetism',
        'electricity',
        'life cycle',
        'food chain',
        'photosynthesis',
    ],
    social_studies: [
        'history',
        'geography',
        'government',
        'citizenship',
        'community',
        'culture',
        'map',
        'continent',
        'country',
        'state',
        'city',
        'economy',
        'trade',
        'resource',
        'democracy',
        'constitution',
        'president',
        'civil rights',
        'war',
        'revolution',
        'explorer',
        'colony',
        'independence',
    ],
};

interface LessonRow {
    id: number;
    title: string;
    module_id: number | null;
}

interface ModuleRow {
    id: number;
    subject: string;
    title: string;
}

function detectCorrectSubject(title: string): string | null {
    const lowerTitle = title.toLowerCase();

    for (const [subject, keywords] of Object.entries(SUBJECT_INDICATORS)) {
        for (const keyword of keywords) {
            if (lowerTitle.includes(keyword)) {
                return subject;
            }
        }
    }

    return null;
}

async function fixSubjectMislabeling() {
    console.log('🔍 Scanning for mislabeled lessons...\n');

    // Get all lessons with their module info
    const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title, module_id');

    if (lessonsError) {
        console.error('Failed to fetch lessons:', lessonsError);
        return;
    }

    // Get all modules
    const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, subject, title');

    if (modulesError) {
        console.error('Failed to fetch modules:', modulesError);
        return;
    }

    const moduleMap = new Map<number, ModuleRow>();
    (modules as ModuleRow[]).forEach(mod => moduleMap.set(mod.id, mod));

    const mislabeled: Array<{
        lessonId: number;
        lessonTitle: string;
        moduleId: number;
        currentSubject: string;
        suggestedSubject: string;
    }> = [];

    for (const lesson of lessons as LessonRow[]) {
        if (!lesson.module_id) continue;

        const module = moduleMap.get(lesson.module_id);
        if (!module) continue;

        const detectedSubject = detectCorrectSubject(lesson.title);

        if (detectedSubject && detectedSubject !== module.subject) {
            mislabeled.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                moduleId: lesson.module_id,
                currentSubject: module.subject,
                suggestedSubject: detectedSubject,
            });
        }
    }

    if (mislabeled.length === 0) {
        console.log('✅ No mislabeled lessons found!');
        return;
    }

    console.log(`Found ${mislabeled.length} potentially mislabeled lessons:\n`);

    for (const item of mislabeled) {
        console.log(`  📚 "${item.lessonTitle}"`);
        console.log(`     Current: ${item.currentSubject} → Suggested: ${item.suggestedSubject}`);
        console.log(`     Lesson ID: ${item.lessonId}, Module ID: ${item.moduleId}\n`);
    }

    // Ask if we should fix them (in a real scenario, you'd want a confirmation)
    console.log('\n🛠️  To fix these issues, you need to either:');
    console.log('   1. Update the module subject in the database');
    console.log('   2. Move the lesson to a correctly-labeled module');
    console.log('   3. Create new modules with correct subjects\n');

    // For now, let's just log the SQL that would fix modules
    console.log('📋 SQL to update module subjects (review before running):\n');

    const moduleUpdates = new Map<number, string>();
    for (const item of mislabeled) {
        // Only update if we haven't already queued this module
        if (!moduleUpdates.has(item.moduleId)) {
            moduleUpdates.set(item.moduleId, item.suggestedSubject);
        }
    }

    for (const [moduleId, newSubject] of moduleUpdates) {
        console.log(`UPDATE modules SET subject = '${newSubject}' WHERE id = ${moduleId};`);
    }

    console.log('\n⚠️  Review the above SQL carefully before executing in your database.');
}

fixSubjectMislabeling().catch(console.error);
