/**
 * Fix Placeholder Vocabulary Script
 * 
 * Replaces placeholder vocabulary like "A key term related to..." with
 * proper definitions based on the lesson subject and topic.
 * 
 * Run: npx tsx scripts/fix_placeholder_vocabulary.ts [--apply]
 */

import 'dotenv/config';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

interface LessonData {
    id: number;
    title: string;
    content: string;
    modules: {
        subject: string;
        grade_band: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

// Extract key topic from lesson title
function extractTopic(title: string): string {
    // Remove common prefixes
    const topic = title
        .replace(/^(Launch Lesson:|Intro:|Introduction to|Refresher:?)/i, '')
        .replace(/\(Grade \d+\)/i, '')
        .replace(/\(PD\)/i, '')
        .trim();

    return topic || title;
}

// Generate vocabulary definition based on subject and topic
function generateVocabularyDefinition(
    subject: string,
    topic: string,
    gradeBand: string
): string {
    const gradeNum = gradeBand === 'K' ? 0 : parseInt(gradeBand) || 5;

    // Subject-specific vocabulary generators
    const generators: Record<string, () => string> = {
        'Mathematics': () => {
            const mathTerms: Record<string, string> = {
                'fraction': 'A number that represents part of a whole, written with a numerator and denominator',
                'addition': 'Combining two or more numbers to find their total or sum',
                'subtraction': 'Finding the difference between two numbers by taking one away from the other',
                'multiplication': 'A faster way to add the same number multiple times',
                'division': 'Splitting a number into equal groups or parts',
                'equation': 'A mathematical statement showing that two expressions are equal',
                'variable': 'A letter or symbol that represents an unknown number',
                'geometry': 'The study of shapes, sizes, and positions of figures',
                'perimeter': 'The total distance around the outside of a shape',
                'area': 'The amount of space inside a flat shape, measured in square units',
                'volume': 'The amount of space inside a 3D object, measured in cubic units',
                'angle': 'The space between two lines that meet at a point',
                'graph': 'A visual way to show data or mathematical relationships',
                'coordinate': 'A pair of numbers that shows a position on a grid',
                'probability': 'A measure of how likely something is to happen',
                'statistics': 'The study of collecting, organizing, and understanding data',
                'function': 'A rule that assigns exactly one output to each input',
                'derivative': 'The rate at which a function changes at any given point',
                'integral': 'A way to find the area under a curve or accumulation of quantities'
            };

            const topicLower = topic.toLowerCase();
            for (const [key, def] of Object.entries(mathTerms)) {
                if (topicLower.includes(key)) {
                    return def;
                }
            }

            return gradeNum <= 3
                ? 'An important math concept that helps us solve problems and understand numbers'
                : 'A mathematical principle used to solve problems and analyze relationships';
        },

        'Science': () => {
            const scienceTerms: Record<string, string> = {
                'habitat': 'The natural home or environment where a plant or animal lives',
                'ecosystem': 'A community of living things interacting with their environment',
                'energy': 'The ability to do work or cause change',
                'matter': 'Anything that has mass and takes up space',
                'force': 'A push or pull that can change an object\'s motion',
                'evolution': 'The process by which species change over many generations',
                'cell': 'The basic building block of all living things',
                'photosynthesis': 'The process plants use to make food from sunlight',
                'atom': 'The smallest unit of matter that keeps its chemical properties',
                'molecule': 'Two or more atoms joined together by chemical bonds',
                'genetics': 'The study of how traits are passed from parents to offspring',
                'climate': 'The average weather conditions in an area over a long time',
                'experiment': 'A test done to answer a question or prove a hypothesis',
                'hypothesis': 'An educated guess about what will happen in an experiment'
            };

            const topicLower = topic.toLowerCase();
            for (const [key, def] of Object.entries(scienceTerms)) {
                if (topicLower.includes(key)) {
                    return def;
                }
            }

            return gradeNum <= 3
                ? 'A science idea that helps us understand how the world works'
                : 'A scientific concept that explains natural phenomena through observation and evidence';
        },

        'English Language Arts': () => {
            const elaTerms: Record<string, string> = {
                'poem': 'A piece of writing that uses rhythm and often rhyme to express feelings or ideas',
                'story': 'A narrative that describes events and characters, real or imagined',
                'fiction': 'Made-up stories that come from the author\'s imagination',
                'nonfiction': 'Writing based on real facts, events, or information',
                'character': 'A person, animal, or figure in a story',
                'setting': 'The time and place where a story takes place',
                'plot': 'The sequence of events that make up a story',
                'theme': 'The main message or lesson in a story',
                'vocabulary': 'Words and their meanings used in speaking and writing',
                'grammar': 'The rules for how words are put together in sentences',
                'paragraph': 'A group of sentences about one main idea',
                'essay': 'A piece of writing that presents ideas about a topic',
                'rhetoric': 'The art of using language effectively to persuade or inform',
                'argument': 'A reason or set of reasons given to support an idea'
            };

            const topicLower = topic.toLowerCase();
            for (const [key, def] of Object.entries(elaTerms)) {
                if (topicLower.includes(key)) {
                    return def;
                }
            }

            return gradeNum <= 3
                ? 'A reading and writing skill that helps us understand and share ideas'
                : 'A language arts concept essential for effective communication and comprehension';
        },

        'Social Studies': () => {
            const ssTerms: Record<string, string> = {
                'map': 'A drawing that shows places and how to get from one place to another',
                'community': 'A group of people who live in the same area and share things together',
                'government': 'The group of people who make rules and decisions for a country or community',
                'history': 'The study of what happened in the past',
                'culture': 'The beliefs, customs, and way of life of a group of people',
                'economy': 'How people make, buy, and sell goods and services',
                'geography': 'The study of places, land, and people around the world',
                'citizen': 'A person who belongs to and has rights in a country or community',
                'democracy': 'A type of government where people vote to make decisions',
                'constitution': 'The set of basic rules that guide how a government works',
                'trade': 'Exchanging goods or services between people or countries',
                'civilization': 'A complex society with cities, government, and culture'
            };

            const topicLower = topic.toLowerCase();
            for (const [key, def] of Object.entries(ssTerms)) {
                if (topicLower.includes(key)) {
                    return def;
                }
            }

            return gradeNum <= 3
                ? 'An idea that helps us understand people, places, and how we live together'
                : 'A concept that helps us understand societies, governance, and human interaction';
        },

        'Electives': () => {
            const electiveTerms: Record<string, string> = {
                'art': 'Creating visual works to express ideas and feelings',
                'music': 'Organized sounds that create rhythm, melody, and harmony',
                'rhythm': 'A pattern of sounds and silences in music',
                'melody': 'A sequence of notes that form a recognizable tune',
                'coding': 'Writing instructions that tell a computer what to do',
                'algorithm': 'A step-by-step set of instructions to solve a problem',
                'fitness': 'Being healthy and strong through exercise and good habits',
                'nutrition': 'The food and nutrients your body needs to stay healthy',
                'budget': 'A plan for how to spend and save money',
                'design': 'Creating something with a specific purpose and appearance'
            };

            const topicLower = topic.toLowerCase();
            for (const [key, def] of Object.entries(electiveTerms)) {
                if (topicLower.includes(key)) {
                    return def;
                }
            }

            return gradeNum <= 3
                ? 'A skill that helps you create, explore, and learn something new'
                : 'A concept that develops creative, practical, or specialized abilities';
        }
    };

    const generator = generators[subject] || generators['Science'];
    return generator();
}

// Fix placeholder vocabulary in content
function fixPlaceholderVocabulary(
    content: string,
    subject: string,
    topic: string,
    gradeBand: string
): { fixed: string; count: number } {
    const placeholder = /A key term related to[^.:\n]*/gi;
    let count = 0;

    const fixed = content.replace(placeholder, () => {
        count++;
        const definition = generateVocabularyDefinition(subject, topic, gradeBand);
        return definition;
    });

    return { fixed, count };
}

async function fetchLessonsWithPlaceholders(): Promise<LessonData[]> {
    const allLessons: LessonData[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data: batch, error } = await supabase
            .from('lessons')
            .select('id, title, content, modules(subject, grade_band, strand, topic)')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Error fetching lessons:', error);
            break;
        }

        if (!batch || batch.length === 0) break;
        allLessons.push(...(batch as unknown as LessonData[]));
        if (batch.length < batchSize) break;
        offset += batchSize;
    }

    // Filter to only lessons with placeholder vocabulary
    return allLessons.filter(l =>
        l.content && /A key term related to/i.test(l.content)
    );
}

async function main() {
    const applyChanges = process.argv.includes('--apply');

    console.log('='.repeat(60));
    console.log('FIX PLACEHOLDER VOCABULARY');
    console.log('='.repeat(60));
    console.log(`Mode: ${applyChanges ? 'APPLY (making changes)' : 'DRY RUN (preview only)'}`);
    console.log();

    console.log('Fetching lessons with placeholder vocabulary...');
    const lessons = await fetchLessonsWithPlaceholders();
    console.log(`Found ${lessons.length} lessons with placeholder vocabulary\n`);

    if (lessons.length === 0) {
        console.log('✅ No placeholder vocabulary found!');
        return;
    }

    // Count by subject
    const bySubject: Record<string, number> = {};
    for (const lesson of lessons) {
        const subject = lesson.modules?.subject || 'Unknown';
        bySubject[subject] = (bySubject[subject] || 0) + 1;
    }

    console.log('By Subject:');
    Object.entries(bySubject)
        .sort((a, b) => b[1] - a[1])
        .forEach(([s, c]) => console.log(`  ${s}: ${c}`));
    console.log();

    let totalFixed = 0;
    let totalReplacements = 0;
    const errors: string[] = [];

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const subject = lesson.modules?.subject || 'Unknown';
        const gradeBand = lesson.modules?.grade_band || '5';
        const topic = extractTopic(lesson.title);

        const { fixed, count } = fixPlaceholderVocabulary(
            lesson.content,
            subject,
            topic,
            gradeBand
        );

        if (count > 0) {
            totalReplacements += count;

            if (applyChanges) {
                const { error } = await supabase
                    .from('lessons')
                    .update({ content: fixed })
                    .eq('id', lesson.id);

                if (error) {
                    errors.push(`Lesson ${lesson.id}: ${error.message}`);
                } else {
                    totalFixed++;
                }
            } else {
                totalFixed++;
            }
        }

        if ((i + 1) % 50 === 0) {
            console.log(`Processing ${i + 1}/${lessons.length}...`);
        }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Lessons processed: ${lessons.length}`);
    console.log(`Lessons ${applyChanges ? 'fixed' : 'to fix'}: ${totalFixed}`);
    console.log(`Total replacements ${applyChanges ? 'made' : 'to make'}: ${totalReplacements}`);

    if (errors.length > 0) {
        console.log(`\nErrors: ${errors.length}`);
        errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }

    if (!applyChanges) {
        console.log('\n💡 Run with --apply to make changes');
    } else {
        console.log('\n✅ Changes applied successfully');
    }
}

main().catch(console.error);
