/**
 * Fix Teacher-Facing Language
 * 
 * Transforms teacher-facing language in Science lessons into student-facing language.
 * Example: "students can observe" -> "You can observe"
 *          "Students will note" -> "You'll notice"
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabase: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LessonRecord {
    id: number;
    title: string;
    content: string;
}

// Replacements for teacher-facing language -> student-facing language
const REPLACEMENTS: Array<[RegExp, string]> = [
    // "students can/will/should observe" -> "You can observe"
    [/students? can observe/gi, 'you can observe'],
    [/students? will observe/gi, 'you\'ll observe'],
    [/students? should observe/gi, 'try to observe'],

    // "students can/will/should note" -> "You'll notice"
    [/students? can note/gi, 'you might notice'],
    [/students? will note/gi, 'you\'ll notice'],
    [/students? should note/gi, 'take note'],

    // "students can/will/should discuss" -> "Think about"
    [/students? can discuss/gi, 'think about'],
    [/students? will discuss/gi, 'consider'],
    [/students? should discuss/gi, 'reflect on'],

    // Other common teacher phrases
    [/students? will learn/gi, 'you\'ll learn'],
    [/students? can learn/gi, 'you can learn'],
    [/students? should learn/gi, 'you\'ll discover'],

    [/the student will/gi, 'you will'],
    [/the student can/gi, 'you can'],
    [/the student should/gi, 'you should'],

    // Presentation language
    [/present (to |the )?students/gi, 'explore'],
    [/show students/gi, 'explore'],
    [/have students/gi, 'try to'],
    [/ask students/gi, 'think about'],
    [/allow students/gi, 'feel free'],

    // Third-person to second-person
    [/students begin/gi, 'start'],
    [/students explore/gi, 'explore'],
    [/students discover/gi, 'discover'],
    [/students learn/gi, 'you learn'],
];

function transformContent(content: string): string {
    let transformed = content;

    for (const [pattern, replacement] of REPLACEMENTS) {
        transformed = transformed.replace(pattern, replacement);
    }

    return transformed;
}

function needsFixing(content: string): boolean {
    const teacherPattern = /students? (will|should|can) (note|observe|discuss)/i;
    return teacherPattern.test(content);
}

async function fetchLessonsNeedingFix(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content')
            .range(start, start + pageSize - 1);

        if (error) {
            throw new Error(`Failed to fetch lessons: ${error.message}`);
        }

        if (!data || data.length === 0) break;

        allLessons.push(...(data as LessonRecord[]));
        start += pageSize;

        if (data.length < pageSize) break;
    }

    return allLessons.filter(lesson => needsFixing(lesson.content));
}

async function updateLessonContent(id: number, content: string): Promise<void> {
    const { error } = await supabase
        .from('lessons')
        .update({ content })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update lesson ${id}: ${error.message}`);
    }
}

async function main() {
    console.log('=== FIX TEACHER-FACING LANGUAGE ===\n');

    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');

    console.log('Fetching lessons with teacher-facing language...\n');
    const lessons = await fetchLessonsNeedingFix();
    console.log(`Found ${lessons.length} lessons needing fixes\n`);

    if (lessons.length === 0) {
        console.log('✅ No lessons need teacher-facing language fixes!');
        return;
    }

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 3 examples:\n');
        for (const lesson of lessons.slice(0, 3)) {
            console.log('='.repeat(60));
            console.log(`ID: ${lesson.id} | ${lesson.title}`);

            // Find and show context around the problematic text
            const teacherPattern = /students? (will|should|can) (note|observe|discuss)/gi;
            const matches = lesson.content.match(teacherPattern);
            console.log('\nMatches found:', matches?.join(', '));

            const fixed = transformContent(lesson.content);

            // Show a diff of the changes
            console.log('\n--- Before/After for first match:');
            if (matches && matches[0]) {
                const idx = lesson.content.toLowerCase().indexOf(matches[0].toLowerCase());
                if (idx >= 0) {
                    const before = lesson.content.substring(Math.max(0, idx - 30), idx + matches[0].length + 30);
                    console.log('Before:', before);
                    console.log('After: ', fixed.substring(Math.max(0, idx - 30), idx + 50));
                }
            }
            console.log('');
        }
        console.log('\nRun without --preview to apply changes.');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    console.log(dryRun ? '🔍 DRY RUN MODE\n' : '🚀 Fixing lessons...\n');

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];

        try {
            const fixedContent = transformContent(lesson.content);

            if (!dryRun) {
                await updateLessonContent(lesson.id, fixedContent);
            }

            successCount++;

            if ((i + 1) % 50 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} fixed, ${errorCount} errors)`);
            }
        } catch (err) {
            errorCount++;
            console.log(`Error on lesson ${lesson.id}:`, err);
        }
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`Total processed: ${lessons.length}`);
    console.log(`Successfully fixed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Teacher-facing language has been replaced with student-facing language!');
    }
}

main().catch(console.error);
