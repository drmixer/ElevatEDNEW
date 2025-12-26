/**
 * Lesson Content Improvement Script
 * 
 * Uses AI to transform existing lessons into high-quality, pedagogically sound content
 * that matches the quality of hand-authored lessons.
 * 
 * Run: npx tsx scripts/improve_lesson_content.ts [options]
 * 
 * Options:
 *   --grade K|1|2|3|...|12  Process only a specific grade
 *   --subject "Math"|"ELA"  Process only a specific subject
 *   --limit 10              Process only N lessons
 *   --dry-run               Preview changes without saving
 *   --start-from 100        Start from lesson ID (for resuming)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

// FREE high-quality models available on OpenRouter (December 2024)
// You can switch between these based on availability:
const FREE_MODELS = {
    'gemini-flash': 'google/gemini-2.0-flash-exp:free',      // Google's newest, very fast
    'deepseek-r1': 'deepseek/deepseek-r1:free',              // 671B params, great reasoning
    'llama-scout': 'meta-llama/llama-4-scout:free',          // Meta's free model
    'quasar': 'openrouter/quasar-alpha',                      // Free, 1M context
    'qwen': 'qwen/qwen3-235b-a22b:free',                     // Alibaba, very capable
};

// Use Gemini 2.0 Flash - it's free and high quality!
const MODEL = FREE_MODELS['gemini-flash'];

// Quality lesson template for reference
const QUALITY_LESSON_TEMPLATE = `
A high-quality lesson has the following structure and characteristics:

## Learning Goal
A clear, student-friendly learning objective that tells students what they will learn.

## What You'll Learn
A welcoming introduction that:
- Connects to what students already know
- Uses an engaging hook (question, scenario, or visual)
- Is age-appropriate and exciting

## Key Vocabulary
3-5 essential terms with:
- Clear, grade-appropriate definitions
- Real-world examples
- No placeholder text like "A key term related to..."

## Main Lesson Content
Well-organized content that:
- Uses clear headings and subheadings
- Includes specific, concrete examples
- Has step-by-step explanations
- Uses analogies students can relate to
- Includes visual cues for key concepts (using markdown formatting)
- Flows logically from simple to complex

## Fun Fact or Real-World Connection
An interesting fact or real-world application that makes the content memorable.

## Practice Tip
A helpful hint for practicing or remembering the concept.

## Summary
A concise recap of the main points learned.
`;

interface LessonRecord {
    id: number;
    title: string;
    content: string;
    slug: string;
    module_id: number;
    estimated_duration_minutes: number | null;
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

interface ProcessingStats {
    total: number;
    processed: number;
    improved: number;
    skipped: number;
    errors: number;
}

function parseArgs(): {
    grade?: string;
    subject?: string;
    limit?: number;
    dryRun: boolean;
    startFrom?: number;
} {
    const args = process.argv.slice(2);
    const result: any = { dryRun: false };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--grade' && args[i + 1]) {
            result.grade = args[++i];
        } else if (args[i] === '--subject' && args[i + 1]) {
            result.subject = args[++i];
        } else if (args[i] === '--limit' && args[i + 1]) {
            result.limit = parseInt(args[++i], 10);
        } else if (args[i] === '--dry-run') {
            result.dryRun = true;
        } else if (args[i] === '--start-from' && args[i + 1]) {
            result.startFrom = parseInt(args[++i], 10);
        }
    }

    return result;
}

async function fetchLessons(options: {
    grade?: string;
    subject?: string;
    limit?: number;
    startFrom?: number;
}): Promise<LessonRecord[]> {
    let query = supabase
        .from('lessons')
        .select(`
            id,
            title,
            content,
            slug,
            module_id,
            estimated_duration_minutes,
            modules (
                grade_band,
                subject,
                strand,
                topic
            )
        `)
        .order('id', { ascending: true });

    if (options.startFrom) {
        query = query.gte('id', options.startFrom);
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch lessons: ${error.message}`);
    }

    let lessons = data as unknown as LessonRecord[];

    // Filter by grade if specified
    if (options.grade) {
        lessons = lessons.filter(l => {
            const grade = l.modules?.grade_band?.replace('Grade ', '').trim();
            return grade === options.grade || l.modules?.grade_band === options.grade;
        });
    }

    // Filter by subject if specified
    if (options.subject) {
        const subjectLower = options.subject.toLowerCase();
        lessons = lessons.filter(l =>
            l.modules?.subject?.toLowerCase().includes(subjectLower)
        );
    }

    return lessons;
}

function needsImprovement(lesson: LessonRecord): boolean {
    const content = lesson.content || '';
    const title = lesson.title || '';

    // Skip if very short (likely a placeholder)
    if (content.length < 200) return true;

    // Check for placeholder patterns
    const placeholderPatterns = [
        /A key term related to/i,
        /Definition pending/i,
        /TODO:/i,
        /PLACEHOLDER/i,
        /Explore the concepts and skills of/i,
        /Develop understanding and apply learning/i,
        /Build fluency and confidence with/i,
    ];

    for (const pattern of placeholderPatterns) {
        if (pattern.test(content)) return true;
    }

    // Check for GENERIC/TEMPLATE content patterns
    // These are lessons that technically have structure but lack meaningful content
    const genericPatterns = [
        // Intro just repeats the topic name without explanation
        /## Introduction\s*\n+\S+.*?\(advanced\)/i,
        /## Introduction\s*\n+\S+.*?\(intro\)/i,
        /## Introduction\s*\n+In this lesson, we'll explore .+ and discover how it connects/i,
        /## Introduction\s*\n+This lesson provides an in-depth examination of/i,
        // Generic learning goals that don't teach anything specific
        /Analyze and evaluate concepts related to .+\n.*Apply sophisticated reasoning/i,
        /Understand the key concepts of .+\n.*Apply mathematical reasoning to solve/i,
        /Understand key concepts in this module/i,
        // Content that just echoes the title
        /Apply skills to real reading and writing/i,
        /Build confidence with this skill set/i,
    ];

    for (const pattern of genericPatterns) {
        if (pattern.test(content)) {
            return true;
        }
    }

    // Check if the introduction is too short or generic
    const introMatch = content.match(/## Introduction\s*\n+([\s\S]*?)(?=\n##|\n---)/i);
    if (introMatch) {
        const intro = introMatch[1].trim();
        // If intro is very short or just repeats the title
        if (intro.length < 100) {
            return true;
        }
    }

    // Check for missing key sections
    const hasLearningGoal = /learning goal|what you'll learn|objectives/i.test(content);
    const hasKeyVocabulary = /key vocabulary|vocabulary|key terms/i.test(content);
    const hasSummary = /summary|recap|review|what we learned/i.test(content);

    // If missing more than one key section, needs improvement
    const missingSections = [!hasLearningGoal, !hasKeyVocabulary, !hasSummary].filter(Boolean).length;
    if (missingSections >= 2) return true;

    // Check content quality indicators
    const hasExamples = /for example|such as|like a|imagine|consider|let's say/i.test(content);
    const hasSpecifics = /\d+(?:\.\d+)?(?:\s*(?:cm|m|kg|lb|%|degrees|dollars|\$|feet|inches|minutes|hours|years))?/i.test(content);

    // If lacks examples AND specifics, probably too generic
    if (!hasExamples && !hasSpecifics) return true;

    return false;
}

async function improveLesson(lesson: LessonRecord): Promise<string> {
    const gradeBand = lesson.modules?.grade_band || 'Unknown Grade';
    const subject = lesson.modules?.subject || 'Unknown Subject';
    const strand = lesson.modules?.strand || '';
    const topic = lesson.modules?.topic || '';

    const gradeNum = gradeBand.replace('Grade ', '').trim();
    const gradeContext = getGradeContext(gradeNum);

    const prompt = `You are an expert curriculum developer creating high-quality educational content for ${gradeBand} students.

LESSON DETAILS:
- Title: ${lesson.title}
- Subject: ${subject}
- Strand: ${strand}
- Topic: ${topic}
- Grade Level: ${gradeBand}

STUDENT CONTEXT:
${gradeContext}

CURRENT LESSON CONTENT:
${lesson.content}

YOUR TASK:
Transform this lesson into a high-quality, engaging lesson that follows this structure:

${QUALITY_LESSON_TEMPLATE}

IMPORTANT REQUIREMENTS:
1. Make ALL content age-appropriate for ${gradeBand} students
2. Use vocabulary and sentence complexity appropriate for ${gradeContext}
3. Include SPECIFIC, CONCRETE examples (not generic ones)
4. Add an engaging hook at the beginning
5. Include a fun fact or real-world connection
6. End with a clear, memorable summary
7. Use proper markdown formatting (headers, bold, bullet points)
8. If the topic involves math, show actual numbers and calculations
9. If the topic involves science, describe observable phenomena
10. If the topic involves ELA, use actual text examples
11. Remove any placeholder text or generic phrases
12. Make it feel like a conversation with the student

Write the complete improved lesson content now. Output ONLY the lesson content in markdown format, no preamble or explanation.`;

    const response = await callOpenRouter(prompt);
    return response;
}

function getGradeContext(grade: string): string {
    const contexts: Record<string, string> = {
        'K': 'Kindergarten (5-6 years old): Use very simple words, lots of pictures/visual descriptions, playful tone, repetition. Attention span: 5-10 minutes. Examples should involve familiar objects, animals, family.',
        '1': 'First Grade (6-7 years old): Simple sentences, basic vocabulary, concrete concepts only. Just learning to read fluently. Examples should involve school, home, playground.',
        '2': 'Second Grade (7-8 years old): Short paragraphs, can handle more details. Beginning to understand cause and effect. Examples should be relatable to daily life.',
        '3': 'Third Grade (8-9 years old): Can read longer texts, understand comparisons. Ready for more abstract thinking. Examples can include community and nature.',
        '4': 'Fourth Grade (9-10 years old): Handle multi-step processes, comparisons across categories. Can understand historical context. Examples can be regional or national.',
        '5': 'Fifth Grade (10-11 years old): Ready for complex vocabulary, can synthesize information. Preparing for middle school. Examples can include world connections.',
        '6': 'Sixth Grade (11-12 years old): Middle school transition, can handle abstract concepts. Interested in fairness and social dynamics. Examples should include real-world applications.',
        '7': 'Seventh Grade (12-13 years old): Growing analytical skills, questioning authority. Can handle nuanced topics. Examples should be relevant to teen interests.',
        '8': 'Eighth Grade (13-14 years old): Pre-high school, can handle sophisticated reasoning. Ready for multiple perspectives. Examples should connect to future goals.',
        '9': 'Ninth Grade (14-15 years old): High school freshman, developing critical thinking. Can handle college-prep content. Examples should include career connections.',
        '10': 'Tenth Grade (15-16 years old): Developing specialization, independent learning. Ready for research and analysis. Examples should include real-world complexity.',
        '11': 'Eleventh Grade (16-17 years old): College preparation, sophisticated reasoning. Can handle primary sources. Examples should include professional applications.',
        '12': 'Twelfth Grade (17-18 years old): Near-adult reading level, ready for college. Can handle nuanced debates. Examples should include adult responsibilities.',
    };

    return contexts[grade] || 'General elementary/secondary student. Use grade-appropriate language and examples.';
}

async function callOpenRouter(prompt: string, retries = 3): Promise<string> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // List of free models to try in order (fallback chain)
    const modelsToTry = [
        FREE_MODELS['gemini-flash'],
        FREE_MODELS['deepseek-r1'],
        FREE_MODELS['qwen'],
        FREE_MODELS['quasar'],
    ];

    for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(OPENROUTER_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'https://elevated.education',
                        'X-Title': 'ElevatED Lesson Improvement',
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 4000,
                        temperature: 0.7,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    // If rate limited (429), try next model
                    if (response.status === 429) {
                        console.log(`  Model ${model} rate limited, trying next...`);
                        break; // Break inner retry loop, try next model
                    }
                    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
                }

                const data = await response.json() as { choices?: { message?: { content?: string } }[] };
                const content = data.choices?.[0]?.message?.content;

                if (!content) {
                    throw new Error('Empty response from OpenRouter');
                }

                return content;
            } catch (error) {
                const errStr = String(error);
                // If it's a rate limit error, try next model
                if (errStr.includes('429') || errStr.includes('rate-limited')) {
                    console.log(`  Model ${model} failed (rate limit), trying next...`);
                    break;
                }
                console.error(`  Attempt ${attempt} failed:`, error);
                if (attempt === retries) {
                    // Try next model instead of failing completely
                    break;
                }
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Exponential backoff
            }
        }
    }

    throw new Error('All models and retries failed');
}

async function updateLesson(lessonId: number, newContent: string): Promise<void> {
    const { error } = await supabase
        .from('lessons')
        .update({ content: newContent })
        .eq('id', lessonId);

    if (error) {
        throw new Error(`Failed to update lesson ${lessonId}: ${error.message}`);
    }
}

function saveProgress(lessonId: number, status: 'success' | 'error', message?: string): void {
    const logPath = path.join(process.cwd(), 'data', 'lesson_improvement_log.jsonl');
    const logEntry = {
        timestamp: new Date().toISOString(),
        lessonId,
        status,
        message,
    };

    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
}

async function main(): Promise<void> {
    const options = parseArgs();

    console.log('=== LESSON CONTENT IMPROVEMENT ===\n');
    console.log('Options:', options);

    if (!OPENROUTER_API_KEY) {
        console.error('ERROR: Missing OPENROUTER_API_KEY environment variable');
        process.exit(1);
    }

    console.log('\nFetching lessons...');
    const lessons = await fetchLessons(options);
    console.log(`Found ${lessons.length} lessons to process\n`);

    const stats: ProcessingStats = {
        total: lessons.length,
        processed: 0,
        improved: 0,
        skipped: 0,
        errors: 0,
    };

    for (const lesson of lessons) {
        stats.processed++;
        const progress = `[${stats.processed}/${stats.total}]`;

        // Check if lesson needs improvement
        if (!needsImprovement(lesson)) {
            console.log(`${progress} SKIP: Lesson ${lesson.id} "${lesson.title}" - Already good quality`);
            stats.skipped++;
            continue;
        }

        const grade = lesson.modules?.grade_band || 'Unknown';
        const subject = lesson.modules?.subject || 'Unknown';

        console.log(`${progress} Processing: Lesson ${lesson.id} "${lesson.title}" (${grade} - ${subject})`);

        try {
            const improvedContent = await improveLesson(lesson);

            if (options.dryRun) {
                console.log(`  DRY RUN: Would update lesson ${lesson.id}`);
                console.log(`  New content preview (first 200 chars): ${improvedContent.substring(0, 200)}...`);
            } else {
                await updateLesson(lesson.id, improvedContent);
                console.log(`  SUCCESS: Lesson ${lesson.id} improved and saved`);
                saveProgress(lesson.id, 'success');
            }

            stats.improved++;

            // Rate limiting - wait between API calls (longer for free models)
            await new Promise(r => setTimeout(r, 3000));

        } catch (error) {
            console.error(`  ERROR: Failed to improve lesson ${lesson.id}:`, error);
            saveProgress(lesson.id, 'error', String(error));
            stats.errors++;
        }
    }

    console.log('\n=== PROCESSING COMPLETE ===');
    console.log(`Total lessons: ${stats.total}`);
    console.log(`Improved: ${stats.improved}`);
    console.log(`Skipped (already good): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

    if (options.dryRun) {
        console.log('\n(This was a DRY RUN - no changes were saved)');
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
