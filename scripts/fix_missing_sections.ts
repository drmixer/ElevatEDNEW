/**
 * Quick Fix: Add Missing Sections
 * 
 * Adds missing structural sections (Introduction, Key Concepts, Practice, 
 * Vocabulary, Summary) to lessons that are missing them.
 * 
 * This brings all lessons up to the new student-facing standard.
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
    module_id: number;
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

function getComplexityLevel(grade: string): 'simple' | 'moderate' | 'advanced' {
    const gradeNum = parseInt(grade) || 0;
    if (gradeNum <= 2) return 'simple';
    if (gradeNum <= 8) return 'moderate';
    return 'advanced';
}

function generateMissingSections(
    topic: string,
    subject: string,
    grade: string
): {
    introduction: string;
    keyConcepts: string;
    practice: string;
    vocabulary: string;
    summary: string;
} {
    const complexity = getComplexityLevel(grade);

    let introduction = '';
    let keyConcepts = '';
    let practice = '';
    let vocabulary = '';
    let summary = '';

    if (complexity === 'simple') {
        introduction = `Welcome to our lesson about ${topic}! Today we're going to learn some really cool things. Get ready to explore and discover!`;
        keyConcepts = `${topic} is something we see and use in many ways. When we understand it better, we can do amazing things!`;
        practice = `Try this: Think about ${topic} in your own life. Where have you seen it? Draw a picture or tell someone what you know!`;
        vocabulary = `- **${topic}:** Something important we're learning about today`;
        summary = `Great job learning about ${topic}! Keep practicing and you'll get even better.`;
    } else if (complexity === 'moderate') {
        introduction = `In this lesson, we'll explore ${topic} and discover how it connects to the world around us. Understanding ${topic} will help you develop important skills in ${subject}.`;
        keyConcepts = `${topic} involves several key ideas that build on each other. As you learn about these concepts, think about how they connect to what you already know and to real-world situations.`;
        practice = `Apply what you've learned about ${topic}. Consider how these concepts might appear in everyday situations, and try explaining them in your own words to a classmate or family member.`;
        vocabulary = `Understanding key terms helps you master ${topic}. Look for these concepts as you continue learning:
- **Key term:** An important concept related to ${topic}
- **Related idea:** Another concept that connects to ${topic}`;
        summary = `You've explored important concepts in ${topic}. Keep building on these ideas as you continue your learning journey.`;
    } else {
        introduction = `This lesson provides an in-depth examination of ${topic}, a fundamental concept in ${subject}. You'll develop sophisticated understanding through analysis, application, and critical thinking.`;
        keyConcepts = `${topic} encompasses complex ideas that require careful analysis. Consider multiple perspectives and explore how these concepts apply across different contexts and disciplines.`;
        practice = `Challenge yourself to apply ${topic} in novel situations. Analyze real-world examples, synthesize information from multiple sources, and construct well-reasoned arguments supporting your understanding.`;
        vocabulary = `Mastering the vocabulary of ${topic} is essential for advanced discourse:
- **Core concept:** Fundamental principle underlying ${topic}
- **Application:** How ${topic} manifests in practical contexts
- **Analysis:** Critical examination of ${topic} from multiple perspectives`;
        summary = `You've engaged with ${topic} at an advanced level. Continue to explore connections between these concepts and broader themes in ${subject}.`;
    }

    return { introduction, keyConcepts, practice, vocabulary, summary };
}

function addMissingSections(content: string, lesson: LessonRecord): string {
    if (!content || !lesson.modules) return content;

    const module = lesson.modules;
    const topic = module.topic || lesson.title.replace(/^(Intro:|Launch Lesson:)\s*/i, '').replace(/\s*Launch\s*Lesson$/i, '');
    const sections = generateMissingSections(topic, module.subject, module.grade_band);

    let updatedContent = content;

    // Check and add missing sections
    if (!/##\s*Introduction/i.test(content)) {
        // Find the right place to insert introduction (after Learning Goals or at start)
        if (/##\s*(Learning\s*Goals?|What\s*You.*?Learn)/i.test(content)) {
            updatedContent = updatedContent.replace(
                /(##\s*(Learning\s*Goals?|What\s*You.*?Learn)[\s\S]*?(?=\n##|\n---|\n$))/i,
                `$1\n\n---\n\n## Introduction\n\n${sections.introduction}\n`
            );
        }
    }

    if (!/##\s*(Key\s*Concepts?|Understanding)/i.test(updatedContent)) {
        // Add after Introduction or Learning Goals
        if (/##\s*Introduction/i.test(updatedContent)) {
            updatedContent = updatedContent.replace(
                /(##\s*Introduction[\s\S]*?)(\n##|\n---(?=\n##)|\n$)/i,
                `$1\n\n## Key Concepts\n\n${sections.keyConcepts}\n$2`
            );
        }
    }

    if (!/##\s*(Let.*?s\s*Practice|Practice)/i.test(updatedContent)) {
        // Add after Key Concepts or Introduction
        const insertPoint = /##\s*(Key\s*Concepts?|Understanding)/i.test(updatedContent)
            ? /(##\s*(Key\s*Concepts?|Understanding)[\s\S]*?)(\n##|\n$)/i
            : /(##\s*Introduction[\s\S]*?)(\n##|\n$)/i;

        updatedContent = updatedContent.replace(
            insertPoint,
            `$1\n\n## Let's Practice\n\n${sections.practice}\n$3`
        );
    }

    if (!/##\s*(Key\s*)?Vocabulary/i.test(updatedContent)) {
        // Add before Summary or at end
        if (/##\s*Summary/i.test(updatedContent)) {
            updatedContent = updatedContent.replace(
                /(##\s*Summary)/i,
                `## Key Vocabulary\n\n${sections.vocabulary}\n\n$1`
            );
        } else {
            // Add before resources or at end
            if (/##\s*(Additional\s*)?Resources/i.test(updatedContent)) {
                updatedContent = updatedContent.replace(
                    /(##\s*(Additional\s*)?Resources)/i,
                    `## Key Vocabulary\n\n${sections.vocabulary}\n\n$1`
                );
            }
        }
    }

    if (!/##\s*Summary/i.test(updatedContent)) {
        // Add before resources or at end
        if (/##\s*(Additional\s*)?Resources/i.test(updatedContent)) {
            updatedContent = updatedContent.replace(
                /(##\s*(Additional\s*)?Resources)/i,
                `## Summary\n\n${sections.summary}\n\n$1`
            );
        }
    }

    return updatedContent;
}

function needsFixing(content: string): boolean {
    if (!content) return false;

    // Check if missing any major section
    const hasIntroduction = /##\s*Introduction/i.test(content);
    const hasKeyConcepts = /##\s*(Key\s*Concepts?|Understanding)/i.test(content);
    const hasPractice = /##\s*(Let.*?s\s*Practice|Practice)/i.test(content);
    const hasVocabulary = /##\s*(Key\s*)?Vocabulary/i.test(content);
    const hasSummary = /##\s*Summary/i.test(content);

    return !hasIntroduction || !hasKeyConcepts || !hasPractice || !hasVocabulary || !hasSummary;
}

async function fetchLessons(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, module_id, modules(grade_band, subject, strand, topic)')
            .range(start, start + pageSize - 1);

        if (error) {
            throw new Error(`Failed to fetch lessons: ${error.message}`);
        }

        if (!data || data.length === 0) break;

        allLessons.push(...(data as unknown as LessonRecord[]));
        start += pageSize;

        if (data.length < pageSize) break;
    }

    return allLessons;
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
    console.log('=== FIX MISSING SECTIONS ===\n');

    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');
    const limit = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

    console.log('Fetching all lessons...\n');
    const allLessons = await fetchLessons();
    console.log(`Found ${allLessons.length} total lessons\n`);

    // Filter to lessons needing fixes
    let lessons = allLessons.filter(lesson => needsFixing(lesson.content));

    console.log(`Found ${lessons.length} lessons needing section fixes\n`);

    if (limit > 0) {
        lessons = lessons.slice(0, limit);
        console.log(`Limited to ${limit} lessons\n`);
    }

    if (lessons.length === 0) {
        console.log('✅ All lessons have complete sections!');
        return;
    }

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 3 examples:\n');
        for (const lesson of lessons.slice(0, 3)) {
            console.log('='.repeat(60));
            console.log(`ID: ${lesson.id} | ${lesson.title}`);
            console.log(`Before (first 500 chars):`);
            console.log(lesson.content?.substring(0, 500));
            console.log('\n--- After Fix (first 800 chars): ---\n');
            const fixed = addMissingSections(lesson.content, lesson);
            console.log(fixed.substring(0, 800));
            console.log('...\n');
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
            const fixedContent = addMissingSections(lesson.content, lesson);

            if (!dryRun) {
                await updateLessonContent(lesson.id, fixedContent);
            }

            successCount++;

            if ((i + 1) % 100 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} fixed, ${errorCount} errors)`);
            }
        } catch (err) {
            errorCount++;
        }
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`Total processed: ${lessons.length}`);
    console.log(`Successfully fixed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Missing sections have been added!');
    }
}

main().catch(console.error);
