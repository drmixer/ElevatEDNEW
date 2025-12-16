/**
 * Phase 1: Add Learning Goals to Lessons
 * 
 * This script identifies lessons without Learning Goals sections and adds 
 * grade-appropriate, subject-specific learning goals based on the lesson's
 * topic, strand, and subject metadata.
 * 
 * Part of the Lesson Content Enhancement Plan - Phase 1: Structural Consistency
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

interface LearningGoalTemplate {
    subjects: Record<string, string[]>;
    gradeBandModifiers: Record<string, string>;
}

// Learning goal templates by subject - these get customized with topic/strand
const LEARNING_GOAL_TEMPLATES: LearningGoalTemplate = {
    subjects: {
        'Mathematics': [
            'Understand the key concepts of {topic}',
            'Apply mathematical reasoning to solve {topic} problems',
            'Explain and demonstrate your thinking when working with {topic}'
        ],
        'Science': [
            'Investigate and describe the scientific concepts behind {topic}',
            'Apply scientific inquiry to understand {topic}',
            'Connect {topic} to real-world phenomena and examples'
        ],
        'English Language Arts': [
            'Analyze and interpret key elements of {topic}',
            'Apply reading and writing strategies related to {topic}',
            'Express ideas clearly when discussing {topic}'
        ],
        'Social Studies': [
            'Understand the historical and cultural significance of {topic}',
            'Analyze different perspectives related to {topic}',
            'Make connections between {topic} and current events or personal experiences'
        ],
        'Electives': [
            'Explore the foundational concepts of {topic}',
            'Apply practical skills related to {topic}',
            'Develop creativity and critical thinking through {topic}'
        ]
    },
    gradeBandModifiers: {
        'K': 'with teacher support',
        '1': 'with guidance',
        '2': 'with guidance',
        '3': 'independently and with peers',
        '4': 'independently and with peers',
        '5': 'independently and with peers',
        '6': 'through analysis and application',
        '7': 'through analysis and application',
        '8': 'through analysis and application',
        '9': 'through critical analysis and synthesis',
        '10': 'through critical analysis and synthesis',
        '11': 'through advanced analysis and application',
        '12': 'through independent inquiry and advanced reasoning'
    }
};

// More specific learning goal generators by subject and common strands
const STRAND_SPECIFIC_GOALS: Record<string, Record<string, string[]>> = {
    'Mathematics': {
        'Number Sense': [
            'Develop fluency with numbers and number relationships',
            'Apply place value understanding to solve problems',
            'Use mental math strategies effectively'
        ],
        'Operations': [
            'Master computational procedures with understanding',
            'Choose appropriate operations for problem-solving',
            'Estimate and verify calculations'
        ],
        'Algebra': [
            'Recognize and extend patterns using algebraic thinking',
            'Represent relationships using variables and equations',
            'Solve equations using logical reasoning'
        ],
        'Geometry': [
            'Identify and classify geometric shapes by their properties',
            'Apply spatial reasoning to solve problems',
            'Use geometric relationships in real-world contexts'
        ],
        'Measurement': [
            'Select and use appropriate units and tools for measurement',
            'Apply measurement concepts to solve real-world problems',
            'Understand relationships between measurement units'
        ],
        'Data & Statistics': [
            'Collect, organize, and represent data meaningfully',
            'Interpret data displays and draw conclusions',
            'Use statistical reasoning to answer questions'
        ],
        'Calculus': [
            'Understand the fundamental concepts of limits and continuity',
            'Apply derivative and integral techniques',
            'Connect calculus concepts to real-world applications'
        ],
        'Pre-Calculus': [
            'Analyze functions and their properties',
            'Apply trigonometric concepts and identities',
            'Prepare for advanced mathematical reasoning'
        ]
    },
    'Science': {
        'Physical Science': [
            'Investigate properties of matter and energy',
            'Apply understanding of forces and motion',
            'Explore physical phenomena through experimentation'
        ],
        'Life Science': [
            'Understand the characteristics of living organisms',
            'Analyze relationships in ecosystems and environments',
            'Apply biological concepts to real-world scenarios'
        ],
        'Earth Science': [
            'Explore Earth\'s systems and their interactions',
            'Investigate weather, climate, and geological processes',
            'Connect Earth science to environmental issues'
        ],
        'Chemistry': [
            'Understand the structure and properties of matter',
            'Apply knowledge of chemical reactions and bonds',
            'Use the periodic table to predict element behavior'
        ],
        'Physics': [
            'Analyze motion, forces, and energy transformations',
            'Apply mathematical models to physical phenomena',
            'Design investigations to test physical principles'
        ],
        'Biology': [
            'Understand cells, genetics, and life processes',
            'Analyze ecosystems and evolutionary relationships',
            'Connect biological concepts to health and environment'
        ]
    },
    'English Language Arts': {
        'Reading': [
            'Apply comprehension strategies to understand texts',
            'Analyze author\'s purpose, structure, and craft',
            'Make text-to-self, text-to-text, and text-to-world connections'
        ],
        'Writing': [
            'Plan, draft, revise, and edit written work',
            'Write for different purposes and audiences',
            'Use evidence and reasoning to support ideas'
        ],
        'Speaking & Listening': [
            'Communicate ideas clearly in discussions',
            'Listen actively and respond thoughtfully',
            'Present information effectively to different audiences'
        ],
        'Grammar & Conventions': [
            'Apply grammar rules to improve writing clarity',
            'Use appropriate punctuation and capitalization',
            'Edit writing for standard conventions'
        ],
        'Literature': [
            'Analyze literary elements including character, plot, and theme',
            'Compare and contrast texts across genres',
            'Interpret figurative language and literary devices'
        ]
    },
    'Social Studies': {
        'History': [
            'Analyze historical events and their causes and effects',
            'Evaluate primary and secondary sources',
            'Connect past events to present-day situations'
        ],
        'Geography': [
            'Use maps and spatial thinking to understand places',
            'Analyze human-environment interactions',
            'Explore cultural and regional differences'
        ],
        'Civics & Government': [
            'Understand the structure and function of government',
            'Analyze rights, responsibilities, and civic participation',
            'Evaluate how policies affect communities'
        ],
        'Economics': [
            'Understand basic economic concepts and systems',
            'Analyze the role of markets and consumers',
            'Apply economic thinking to real-world decisions'
        ]
    },
    'Electives': {
        'Art': [
            'Express ideas through visual art techniques',
            'Analyze and respond to artwork from different cultures',
            'Develop creative skills and artistic voice'
        ],
        'Music': [
            'Understand musical elements like rhythm, melody, and harmony',
            'Perform and create music with expression',
            'Appreciate music from diverse cultures and time periods'
        ],
        'Health': [
            'Understand concepts that promote personal health and wellness',
            'Apply decision-making skills for healthy choices',
            'Recognize how environment and behavior affect health'
        ],
        'Technology': [
            'Apply technology skills to solve problems',
            'Understand digital citizenship and safety',
            'Use technology as a tool for learning and creation'
        ],
        'Physical Education': [
            'Develop motor skills and movement patterns',
            'Understand the benefits of physical activity',
            'Apply rules and strategies in games and activities'
        ],
        'Financial Literacy': [
            'Understand basic financial concepts like saving and budgeting',
            'Make informed decisions about money management',
            'Set and work toward financial goals'
        ]
    }
};

function generateLearningGoals(
    subject: string,
    strand: string | null,
    topic: string | null,
    gradeBand: string
): string[] {
    const goals: string[] = [];
    const topicName = topic || strand || 'this topic';
    const modifier = LEARNING_GOAL_TEMPLATES.gradeBandModifiers[gradeBand] || '';

    // First, try strand-specific goals
    const subjectStrands = STRAND_SPECIFIC_GOALS[subject];
    if (subjectStrands && strand) {
        const strandGoals = subjectStrands[strand];
        if (strandGoals) {
            // Use strand-specific goals customized with topic
            for (const goal of strandGoals) {
                goals.push(goal.replace('{topic}', topicName));
            }
        }
    }

    // If no strand-specific goals found, use subject templates
    if (goals.length === 0) {
        const subjectTemplates = LEARNING_GOAL_TEMPLATES.subjects[subject]
            || LEARNING_GOAL_TEMPLATES.subjects['Electives'];

        for (const template of subjectTemplates) {
            let goal = template.replace('{topic}', topicName);
            // Add grade-appropriate modifier for younger grades
            if (['K', '1', '2', '3'].includes(gradeBand) && modifier) {
                goal = goal + ' ' + modifier;
            }
            goals.push(goal);
        }
    }

    // Limit to 3 goals max
    return goals.slice(0, 3);
}

function addLearningGoalsToContent(content: string, goals: string[]): string {
    if (!content) return content;

    // Check if already has learning goals
    if (/##\s*(Learning\s*Goals?|Objectives?)/i.test(content)) {
        return content; // Already has goals
    }

    // Build the Learning Goals section
    const goalsSection = `\n## Learning Goals\n\n${goals.map(g => `- ${g}`).join('\n')}\n`;

    // Find the insertion point - after the metadata block (after the last **...:** line)
    // Typically content starts with title and metadata like:
    // # Title
    // **Grade:** X
    // **Subject:** Y
    // ...
    // ## Overview

    const lines = content.split('\n');
    let insertIndex = 0;
    let foundMetadata = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for metadata lines like **Grade:**, **Subject:**, etc.
        if (/^\*\*[^*]+:\*\*/.test(line.trim())) {
            foundMetadata = true;
            insertIndex = i + 1;
        } else if (foundMetadata && line.trim() === '') {
            // End of metadata block
            insertIndex = i + 1;
            break;
        } else if (foundMetadata && /^##/.test(line.trim())) {
            // Hit another section header, insert before it
            insertIndex = i;
            break;
        }
    }

    // If no metadata found, insert after title (first # line)
    if (!foundMetadata) {
        for (let i = 0; i < lines.length; i++) {
            if (/^#\s+/.test(lines[i])) {
                insertIndex = i + 1;
                // Skip any blank lines after title
                while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
                    insertIndex++;
                }
                break;
            }
        }
    }

    // Insert the goals section
    lines.splice(insertIndex, 0, goalsSection);

    return lines.join('\n');
}

async function fetchLessonsWithoutGoals(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, module_id, modules(grade_band, subject, strand, topic)')
            .not('content', 'ilike', '%## Learning Goal%')
            .range(start, start + pageSize - 1);

        if (error) {
            throw new Error(`Failed to fetch lessons: ${error.message}`);
        }

        if (!data || data.length === 0) break;

        allLessons.push(...(data as LessonRecord[]));
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
    console.log('=== PHASE 1: ADD LEARNING GOALS ===\n');
    console.log('Fetching lessons without Learning Goals section...\n');

    const lessons = await fetchLessonsWithoutGoals();
    console.log(`Found ${lessons.length} lessons without Learning Goals\n`);

    if (lessons.length === 0) {
        console.log('✅ All lessons already have Learning Goals!');
        return;
    }

    // Preview mode first
    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 5 examples:\n');
        for (const lesson of lessons.slice(0, 5)) {
            const module = lesson.modules;
            if (!module) continue;

            const goals = generateLearningGoals(
                module.subject,
                module.strand,
                module.topic,
                module.grade_band
            );

            console.log(`---`);
            console.log(`ID: ${lesson.id} | ${lesson.title}`);
            console.log(`Subject: ${module.subject} | Strand: ${module.strand} | Grade: ${module.grade_band}`);
            console.log(`Generated Goals:`);
            goals.forEach(g => console.log(`  - ${g}`));
            console.log('');
        }
        console.log('\nRun without --preview to apply changes.');
        return;
    }

    // Process and update all lessons
    let successCount = 0;
    let errorCount = 0;
    const errors: { id: number; error: string }[] = [];

    console.log(dryRun ? '🔍 DRY RUN MODE - no changes will be saved\n' : '🚀 Updating lessons...\n');

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const module = lesson.modules;

        if (!module) {
            console.warn(`Skipping lesson ${lesson.id}: no module data`);
            continue;
        }

        try {
            // Generate learning goals
            const goals = generateLearningGoals(
                module.subject,
                module.strand,
                module.topic,
                module.grade_band
            );

            // Add goals to content
            const updatedContent = addLearningGoalsToContent(lesson.content, goals);

            // Update in database (unless dry run)
            if (!dryRun) {
                await updateLessonContent(lesson.id, updatedContent);
            }

            successCount++;

            // Progress indicator
            if ((i + 1) % 50 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} updated, ${errorCount} errors)`);
            }
        } catch (err) {
            errorCount++;
            errors.push({ id: lesson.id, error: String(err) });
        }
    }

    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total processed: ${lessons.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
        console.log('\n⚠️ Errors:');
        for (const err of errors.slice(0, 10)) {
            console.log(`  Lesson ${err.id}: ${err.error}`);
        }
        if (errors.length > 10) {
            console.log(`  ... and ${errors.length - 10} more errors`);
        }
    }

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Learning Goals have been added to all applicable lessons!');
    }
}

main().catch(console.error);
