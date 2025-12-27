/**
 * Add Visual Resources to Lessons
 * 
 * This script adds images and other visual resources to lesson content
 * based on the visual needs audit results.
 * 
 * Usage:
 *   npx tsx scripts/add_lesson_visuals.ts --dry-run
 *   npx tsx scripts/add_lesson_visuals.ts --commit
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Map of concept categories to available images
const CONCEPT_IMAGE_MAP: Record<string, {
    imageUrl: string;
    altText: string;
    forStrands: string[];
    forTopics: string[];
}> = {
    'transformations': {
        imageUrl: '/images/lessons/math/geometry_transformations.svg',
        altText: 'Diagram showing four types of geometric transformations: rotation, reflection, translation, and dilation',
        forStrands: ['Geometry & Measurement'],
        forTopics: ['Transformations', 'Moves in the Plane', 'Rotation', 'Reflection', 'Translation'],
    },
    'fractions': {
        imageUrl: '/images/lessons/math/fraction_concepts.svg',
        altText: 'Visual representations of fractions using circles, rectangles, and number lines',
        forStrands: ['Number & Operations', 'Fractions'],
        forTopics: ['Fractions', 'Parts of a Whole', 'Equivalent Fractions', 'Rational Numbers'],
    },
    'coordinate_plane': {
        imageUrl: '/images/lessons/math/coordinate_plane.svg',
        altText: 'Coordinate plane showing four quadrants with plotted example points',
        forStrands: ['Geometry & Measurement', 'Algebra'],
        forTopics: ['Coordinate Plane', 'Graphing', 'Ordered Pairs', 'Linear', 'Quadratic', 'Functions'],
    },
    'water_cycle': {
        imageUrl: '/images/lessons/science/water_cycle.svg',
        altText: 'Diagram of the water cycle showing evaporation, condensation, precipitation, and collection',
        forStrands: ['Earth Science', 'Water', 'Earth Systems'],
        forTopics: ['Water Cycle', 'Weather', 'Precipitation', 'Climate', 'Oceanography', 'Atmospheric'],
    },
    'area_perimeter': {
        imageUrl: '/images/lessons/math/area_perimeter.svg',
        altText: 'Diagram comparing area (inside of shape) and perimeter (around the shape)',
        forStrands: ['Geometry & Measurement'],
        forTopics: ['Area', 'Perimeter', 'Measurement'],
    },
    'story_structure': {
        imageUrl: '/images/lessons/ela/plot_diagram.svg',
        altText: 'Story structure arc showing exposition, rising action, climax, falling action, and resolution',
        forStrands: ['Reading', 'Literature', 'Writing'],
        forTopics: ['Story Structure', 'Plot', 'Narrative', 'Fiction'],
    },
    'plant_lifecycle': {
        imageUrl: '/images/lessons/science/plant_lifecycle.svg',
        altText: 'Diagram of plant life cycle from seed to germination to adult plant and back to seed',
        forStrands: ['Life Science', 'Biology'],
        forTopics: ['Life Cycle', 'Plants', 'Growth', 'Photosynthesis'],
    },
    'solar_system': {
        imageUrl: '/images/lessons/science/solar_system.svg',
        altText: 'Diagram of the solar system showing all eight planets in order from the Sun',
        forStrands: ['Earth Science', 'Space', 'Astronomy'],
        forTopics: ['Solar System', 'Planets', 'Astronomy', 'Astrophysics'],
    },
    'multiplication': {
        imageUrl: '/images/lessons/math/multiplication_table.svg',
        altText: 'Multiplication table showing products from 1x1 to 10x10',
        forStrands: ['Number & Operations'],
        forTopics: ['Multiplication', 'Times Tables', 'Factors', 'Products'],
    },
    'parts_of_speech': {
        imageUrl: '/images/lessons/ela/parts_of_speech.svg',
        altText: 'Eight parts of speech diagram: noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection',
        forStrands: ['Grammar', 'Language'],
        forTopics: ['Parts of Speech', 'Grammar', 'Nouns', 'Verbs', 'Adjectives'],
    },
    'food_chain': {
        imageUrl: '/images/lessons/science/food_chain.svg',
        altText: 'Food chain showing energy flow from producers through consumers to decomposers',
        forStrands: ['Life Science', 'Ecology'],
        forTopics: ['Food Chain', 'Energy Flow', 'Ecosystem', 'Producers', 'Consumers'],
    },
    'place_value': {
        imageUrl: '/images/lessons/math/place_value.svg',
        altText: 'Place value chart showing positions from millions to ones',
        forStrands: ['Number & Operations', 'Place Value'],
        forTopics: ['Place Value', 'Number Sense', 'Whole Numbers', 'Digits'],
    },
    'angles': {
        imageUrl: '/images/lessons/math/types_of_angles.svg',
        altText: 'Types of angles: acute, right, obtuse, straight, and reflex',
        forStrands: ['Geometry & Measurement'],
        forTopics: ['Angles', 'Acute', 'Right', 'Obtuse', 'Degree', 'Measuring Angles'],
    },
    'butterfly_lifecycle': {
        imageUrl: '/images/lessons/science/butterfly_lifecycle.svg',
        altText: 'Butterfly life cycle: egg, caterpillar, chrysalis, adult butterfly',
        forStrands: ['Life Science', 'Biology'],
        forTopics: ['Life Cycle', 'Butterfly', 'Metamorphosis', 'Insects'],
    },
    // Note: US regions map removed - maps need realistic images, not SVG
    'sentence_structure': {
        imageUrl: '/images/lessons/ela/sentence_structure.svg',
        altText: 'Sentence structure showing subject, predicate, and object',
        forStrands: ['Grammar', 'Writing', 'Language'],
        forTopics: ['Sentence Structure', 'Subject', 'Predicate', 'Grammar', 'Sentences'],
    },
    'geometric_shapes': {
        imageUrl: '/images/lessons/math/geometric_shapes.svg',
        altText: '2D and 3D geometric shapes with names and properties',
        forStrands: ['Geometry & Measurement'],
        forTopics: ['Shapes', '2D Shapes', '3D Shapes', 'Polygon', 'Solid'],
    },
    'body_systems': {
        imageUrl: '/images/lessons/science/body_systems.svg',
        altText: 'Human body systems showing major organs',
        forStrands: ['Life Science', 'Biology', 'Health'],
        forTopics: ['Body Systems', 'Organs', 'Human Body', 'Anatomy'],
    },
    'types_of_lines': {
        imageUrl: '/images/lessons/math/types_of_lines.svg',
        altText: 'Types of lines: parallel, perpendicular, and intersecting',
        forStrands: ['Geometry & Measurement'],
        forTopics: ['Lines', 'Parallel', 'Perpendicular', 'Intersecting'],
    },
    'branches_of_government': {
        imageUrl: '/images/lessons/social_studies/branches_of_government.svg',
        altText: 'Three branches of US government: Legislative, Executive, Judicial',
        forStrands: ['Civics', 'Government', 'Social Studies'],
        forTopics: ['Government', 'Branches', 'Congress', 'President', 'Supreme Court'],
    },
    'states_of_matter': {
        imageUrl: '/images/lessons/science/states_of_matter.svg',
        altText: 'States of matter: solid, liquid, and gas with particle arrangements',
        forStrands: ['Physical Science', 'Chemistry'],
        forTopics: ['States of Matter', 'Solid', 'Liquid', 'Gas', 'Particles'],
    },
    'number_line': {
        imageUrl: '/images/lessons/math/number_line.svg',
        altText: 'Number line showing integers from -10 to 10',
        forStrands: ['Number & Operations'],
        forTopics: ['Number Line', 'Integers', 'Negative Numbers', 'Positive'],
    },
    'simple_machines': {
        imageUrl: '/images/lessons/science/simple_machines.svg',
        altText: 'Six simple machines: lever, wheel and axle, pulley, inclined plane, wedge, screw',
        forStrands: ['Physical Science', 'Engineering'],
        forTopics: ['Simple Machines', 'Force', 'Work', 'Lever', 'Pulley'],
    },
    'order_of_operations': {
        imageUrl: '/images/lessons/math/order_of_operations.svg',
        altText: 'Order of operations (PEMDAS): Parentheses, Exponents, Multiplication, Division, Addition, Subtraction',
        forStrands: ['Number & Operations', 'Algebra'],
        forTopics: ['Order of Operations', 'PEMDAS', 'Expressions', 'Evaluate'],
    },
    'telling_time': {
        imageUrl: '/images/lessons/math/telling_time.svg',
        altText: 'Analog clock showing how to tell time',
        forStrands: ['Measurement', 'Time'],
        forTopics: ['Time', 'Clock', 'Hour', 'Minute', 'Telling Time'],
    },
    'types_of_graphs': {
        imageUrl: '/images/lessons/math/types_of_graphs.svg',
        altText: 'Types of graphs: bar graph, line graph, and pie chart',
        forStrands: ['Data & Statistics'],
        forTopics: ['Graphs', 'Bar Graph', 'Line Graph', 'Pie Chart', 'Data'],
    },
    'photosynthesis': {
        imageUrl: '/images/lessons/science/photosynthesis.svg',
        altText: 'Photosynthesis process: sunlight, CO2, and water become glucose and oxygen',
        forStrands: ['Life Science', 'Biology'],
        forTopics: ['Photosynthesis', 'Plants', 'Energy', 'Chlorophyll'],
    },
    'decimals_fractions_percentages': {
        imageUrl: '/images/lessons/math/decimals_fractions_percentages.svg',
        altText: 'Comparing decimals, fractions, and percentages',
        forStrands: ['Number & Operations'],
        forTopics: ['Decimals', 'Percentages', 'Comparing', 'Convert'],
    },
};

interface LessonData {
    id: number;
    title: string;
    content: string;
    modules: {
        strand: string | null;
        topic: string | null;
        subject: string;
    } | null;
}

function findMatchingImage(lesson: LessonData): {
    imageUrl: string;
    altText: string;
    conceptKey: string;
} | null {
    const strand = lesson.modules?.strand?.toLowerCase() || '';
    const topic = lesson.modules?.topic?.toLowerCase() || '';
    const content = lesson.content.toLowerCase();

    for (const [conceptKey, imageData] of Object.entries(CONCEPT_IMAGE_MAP)) {
        // Check if strand matches
        const strandMatch = imageData.forStrands.some(s =>
            strand.includes(s.toLowerCase())
        );

        // Check if topic matches
        const topicMatch = imageData.forTopics.some(t =>
            topic.includes(t.toLowerCase()) || content.includes(t.toLowerCase())
        );

        if (strandMatch || topicMatch) {
            return {
                imageUrl: imageData.imageUrl,
                altText: imageData.altText,
                conceptKey,
            };
        }
    }

    return null;
}

function insertImageIntoContent(content: string, imageUrl: string, altText: string): string {
    // Find the best insertion point
    const imageMarkdown = `\n\n![${altText}](${imageUrl})\n\n`;

    // Try to insert after ## Learning Objectives or ## Learning Goals
    const objectivesMatch = content.match(/^(## Learning (?:Objectives?|Goals?)[\s\S]*?)(\n## |\n\n## |$)/m);
    if (objectivesMatch) {
        const insertPoint = objectivesMatch.index! + objectivesMatch[1].length;
        return content.slice(0, insertPoint) + imageMarkdown + content.slice(insertPoint);
    }

    // Try to insert after the first ## section
    const firstSectionMatch = content.match(/^(## [^\n]+[\s\S]*?)(\n## |\n\n## )/m);
    if (firstSectionMatch) {
        const insertPoint = firstSectionMatch.index! + firstSectionMatch[1].length;
        return content.slice(0, insertPoint) + imageMarkdown + content.slice(insertPoint);
    }

    // Insert after title
    const titleMatch = content.match(/^(# [^\n]+\n)/);
    if (titleMatch) {
        const insertPoint = titleMatch[1].length;
        return content.slice(0, insertPoint) + imageMarkdown + content.slice(insertPoint);
    }

    // Fallback: insert at beginning
    return imageMarkdown + content;
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const commit = args.includes('--commit');

    if (!dryRun && !commit) {
        console.log('Usage:');
        console.log('  npx tsx scripts/add_lesson_visuals.ts --dry-run');
        console.log('  npx tsx scripts/add_lesson_visuals.ts --commit');
        return;
    }

    console.log(`=== ADD VISUAL RESOURCES TO LESSONS ===`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'COMMIT'}\n`);

    // Load the visual needs audit
    const auditPath = path.resolve(process.cwd(), 'data/audits/visual_needs_audit.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found. Run audit_visual_needs.ts first.');
        return;
    }

    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const topCandidates = audit.topCandidates.slice(0, 200);

    console.log(`Processing ${topCandidates.length} high-priority lessons...\n`);

    // Fetch lesson details
    const lessonIds = topCandidates.map((c: { id: number }) => c.id);
    const { data: lessonsData, error } = await supabase
        .from('lessons')
        .select('id, title, content, modules(strand, topic, subject)')
        .in('id', lessonIds);

    if (error || !lessonsData) {
        console.error('Failed to fetch lessons:', error?.message);
        return;
    }

    let updatedCount = 0;
    const updates: Array<{ id: number; title: string; image: string }> = [];

    for (const rawLesson of lessonsData) {
        // Normalize the lesson data structure (Supabase returns modules as array or object)
        const modules = Array.isArray(rawLesson.modules)
            ? rawLesson.modules[0]
            : rawLesson.modules;

        const lesson: LessonData = {
            id: rawLesson.id,
            title: rawLesson.title,
            content: rawLesson.content || '',
            modules: modules ?? null,
        };

        // Skip if already has an image
        if (/!\[.*\]\(.*\)/i.test(lesson.content)) {
            console.log(`⏭️  [${lesson.id}] Already has image: ${lesson.title}`);
            continue;
        }

        // Find matching image
        const match = findMatchingImage(lesson);
        if (!match) {
            console.log(`❌ [${lesson.id}] No matching image: ${lesson.title}`);
            continue;
        }

        // Check if image file exists
        const imagePath = path.resolve(process.cwd(), 'public' + match.imageUrl);
        if (!fs.existsSync(imagePath)) {
            console.log(`⚠️  [${lesson.id}] Image not found: ${match.imageUrl}`);
            continue;
        }

        // Insert image into content
        const newContent = insertImageIntoContent(lesson.content, match.imageUrl, match.altText);

        if (commit) {
            const { error: updateError } = await supabase
                .from('lessons')
                .update({ content: newContent })
                .eq('id', lesson.id);

            if (updateError) {
                console.error(`Failed to update lesson ${lesson.id}:`, updateError.message);
                continue;
            }
        }

        console.log(`✅ [${lesson.id}] Added ${match.conceptKey} image: ${lesson.title}`);
        updates.push({ id: lesson.id, title: lesson.title, image: match.conceptKey });
        updatedCount++;
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total processed: ${lessonsData.length}`);
    console.log(`Would update: ${updatedCount}`);

    if (dryRun) {
        console.log('\n(No changes made - run with --commit to apply)');
    } else {
        console.log(`\nUpdated ${updatedCount} lessons with visual content.`);
    }

    // Save report
    const reportPath = path.resolve(process.cwd(), 'data/audits/visual_updates_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: dryRun ? 'dry-run' : 'commit',
        totalProcessed: lessonsData.length,
        updated: updates,
    }, null, 2));

    console.log(`\nReport saved to ${reportPath}`);
}

main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
