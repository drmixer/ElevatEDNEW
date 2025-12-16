/**
 * Phase 3: Integrate External Resources
 * 
 * Adds external videos, interactive simulations, and resources to lessons
 * based on topic, subject, and strand mappings.
 * 
 * Part of the Lesson Content Enhancement Plan - Phase 3
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
    media: unknown;
    module_id: number;
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

interface Resource {
    type: 'video' | 'interactive' | 'article' | 'image';
    url: string;
    title: string;
    description?: string;
    source: string;
    duration?: string;
}

// Comprehensive resource database by subject, strand, and topic keywords
const RESOURCE_DATABASE: Record<string, Record<string, Resource[]>> = {
    'Mathematics': {
        'fractions': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/arithmetic/fraction-arithmetic',
                title: 'Understanding Fractions',
                description: 'Learn what fractions are and how they work',
                source: 'Khan Academy',
                duration: '8:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/fractions-intro',
                title: 'Fractions Introduction Simulation',
                description: 'Interactive simulation to explore fractions visually',
                source: 'PhET Colorado'
            }
        ],
        'decimals': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/arithmetic/arith-decimals',
                title: 'Introduction to Decimals',
                description: 'Learn about decimal place value and operations',
                source: 'Khan Academy',
                duration: '6:00'
            }
        ],
        'algebra': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/algebra',
                title: 'Algebra Foundations',
                description: 'Introduction to algebraic thinking and equations',
                source: 'Khan Academy',
                duration: '10:00'
            },
            {
                type: 'interactive',
                url: 'https://www.desmos.com/calculator',
                title: 'Desmos Graphing Calculator',
                description: 'Interactive graphing tool for visualizing equations',
                source: 'Desmos'
            }
        ],
        'geometry': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/geometry',
                title: 'Geometry Basics',
                description: 'Learn about shapes, angles, and spatial reasoning',
                source: 'Khan Academy',
                duration: '12:00'
            },
            {
                type: 'interactive',
                url: 'https://www.geogebra.org/geometry',
                title: 'GeoGebra Geometry',
                description: 'Interactive geometry construction and exploration',
                source: 'GeoGebra'
            }
        ],
        'measurement': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/cc-fourth-grade-math/imp-measurement-and-data-2',
                title: 'Measurement and Units',
                description: 'Learn about measuring length, area, and volume',
                source: 'Khan Academy',
                duration: '8:00'
            }
        ],
        'statistics': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/statistics-probability',
                title: 'Statistics and Probability',
                description: 'Learn to analyze data and understand probability',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'calculus': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/calculus-1',
                title: 'Calculus Fundamentals',
                description: 'Introduction to limits, derivatives, and integrals',
                source: 'Khan Academy',
                duration: '15:00'
            },
            {
                type: 'interactive',
                url: 'https://www.desmos.com/calculator',
                title: 'Desmos Graphing Calculator',
                description: 'Visualize functions and calculus concepts',
                source: 'Desmos'
            }
        ],
        'numbers': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/cc-kindergarten-math/cc-kindergarten-counting',
                title: 'Counting and Numbers',
                description: 'Learn about numbers and counting',
                source: 'Khan Academy',
                duration: '5:00'
            }
        ],
        'operations': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/arithmetic',
                title: 'Arithmetic Operations',
                description: 'Master addition, subtraction, multiplication, and division',
                source: 'Khan Academy',
                duration: '8:00'
            }
        ],
        'ratios': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/cc-sixth-grade-math/cc-6th-ratios-prop-topic',
                title: 'Ratios and Proportions',
                description: 'Understand ratios and proportional relationships',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'functions': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:functions',
                title: 'Understanding Functions',
                description: 'Learn what functions are and how they work',
                source: 'Khan Academy',
                duration: '12:00'
            },
            {
                type: 'interactive',
                url: 'https://www.desmos.com/calculator',
                title: 'Desmos Function Grapher',
                description: 'Graph and explore different types of functions',
                source: 'Desmos'
            }
        ]
    },
    'Science': {
        'physics': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/physics',
                title: 'Physics Fundamentals',
                description: 'Learn about forces, motion, and energy',
                source: 'Khan Academy',
                duration: '15:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/filter?subjects=physics',
                title: 'Physics Simulations',
                description: 'Interactive physics experiments and demonstrations',
                source: 'PhET Colorado'
            }
        ],
        'chemistry': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/chemistry',
                title: 'Chemistry Basics',
                description: 'Learn about atoms, molecules, and chemical reactions',
                source: 'Khan Academy',
                duration: '12:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/filter?subjects=chemistry',
                title: 'Chemistry Simulations',
                description: 'Interactive chemistry experiments',
                source: 'PhET Colorado'
            }
        ],
        'biology': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/biology',
                title: 'Biology Fundamentals',
                description: 'Learn about cells, genetics, and life processes',
                source: 'Khan Academy',
                duration: '15:00'
            }
        ],
        'life': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/biology',
                title: 'Life Science',
                description: 'Explore living organisms and their environments',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'earth': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/earth-science',
                title: 'Earth Science',
                description: 'Learn about geology, weather, and our planet',
                source: 'Khan Academy',
                duration: '12:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/filter?subjects=earth-science',
                title: 'Earth Science Simulations',
                description: 'Explore plate tectonics, earthquakes, and more',
                source: 'PhET Colorado'
            }
        ],
        'physical': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/physics',
                title: 'Physical Science',
                description: 'Learn about matter, energy, and physical phenomena',
                source: 'Khan Academy',
                duration: '10:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/category/physics',
                title: 'Physical Science Simulations',
                description: 'Interactive demonstrations of physical concepts',
                source: 'PhET Colorado'
            }
        ],
        'waves': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/physics/mechanical-waves-and-sound',
                title: 'Waves and Sound',
                description: 'Understand how waves transfer energy',
                source: 'Khan Academy',
                duration: '10:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/wave-on-a-string',
                title: 'Wave on a String Simulation',
                description: 'Explore wave properties interactively',
                source: 'PhET Colorado'
            }
        ],
        'energy': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/physics/work-and-energy',
                title: 'Energy and Work',
                description: 'Learn about different forms of energy',
                source: 'Khan Academy',
                duration: '8:00'
            },
            {
                type: 'interactive',
                url: 'https://phet.colorado.edu/en/simulations/energy-forms-and-changes',
                title: 'Energy Forms Simulation',
                description: 'Explore how energy changes forms',
                source: 'PhET Colorado'
            }
        ],
        'ecosystems': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/biology/ecology',
                title: 'Ecosystems and Ecology',
                description: 'Learn about ecosystems and how organisms interact',
                source: 'Khan Academy',
                duration: '12:00'
            }
        ],
        'cells': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/biology/structure-of-a-cell',
                title: 'Cell Structure',
                description: 'Explore the building blocks of life',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ]
    },
    'English Language Arts': {
        'reading': [
            {
                type: 'article',
                url: 'https://www.commonlit.org/',
                title: 'CommonLit Reading Library',
                description: 'Free reading passages and comprehension questions',
                source: 'CommonLit'
            },
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/grammar',
                title: 'Reading and Grammar',
                description: 'Improve reading comprehension skills',
                source: 'Khan Academy',
                duration: '8:00'
            }
        ],
        'writing': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/grammar',
                title: 'Grammar and Writing',
                description: 'Build strong writing skills',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'literature': [
            {
                type: 'article',
                url: 'https://www.gutenberg.org/',
                title: 'Project Gutenberg',
                description: 'Free access to classic literature',
                source: 'Project Gutenberg'
            }
        ],
        'poetry': [
            {
                type: 'article',
                url: 'https://www.poetryfoundation.org/',
                title: 'Poetry Foundation',
                description: 'Explore poems from around the world',
                source: 'Poetry Foundation'
            }
        ],
        'grammar': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/grammar',
                title: 'Grammar Lessons',
                description: 'Master grammar and language conventions',
                source: 'Khan Academy',
                duration: '8:00'
            }
        ]
    },
    'Social Studies': {
        'history': [
            {
                type: 'article',
                url: 'https://www.loc.gov/classroom-materials/',
                title: 'Library of Congress Resources',
                description: 'Primary sources and historical documents',
                source: 'Library of Congress'
            },
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/us-history',
                title: 'History Lessons',
                description: 'Explore key events and figures in history',
                source: 'Khan Academy',
                duration: '15:00'
            }
        ],
        'geography': [
            {
                type: 'interactive',
                url: 'https://earth.google.com/',
                title: 'Google Earth',
                description: 'Explore the world with interactive maps',
                source: 'Google'
            }
        ],
        'civics': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/us-government-and-civics',
                title: 'Civics and Government',
                description: 'Learn about government and citizenship',
                source: 'Khan Academy',
                duration: '12:00'
            }
        ],
        'economics': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/economics-finance-domain',
                title: 'Economics Fundamentals',
                description: 'Learn about economic concepts and systems',
                source: 'Khan Academy',
                duration: '12:00'
            }
        ],
        'government': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/us-government-and-civics',
                title: 'US Government',
                description: 'Learn about the structure of government',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ]
    },
    'Electives': {
        'art': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/art-history',
                title: 'Art History and Appreciation',
                description: 'Explore art from different cultures and time periods',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'music': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/humanities/music',
                title: 'Music Theory',
                description: 'Learn the fundamentals of music',
                source: 'Khan Academy',
                duration: '8:00'
            }
        ],
        'health': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/science/health-and-medicine',
                title: 'Health and Wellness',
                description: 'Learn about staying healthy',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ],
        'financial': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/college-careers-more/personal-finance',
                title: 'Personal Finance Basics',
                description: 'Learn about budgeting, saving, and money management',
                source: 'Khan Academy',
                duration: '12:00'
            }
        ],
        'technology': [
            {
                type: 'video',
                url: 'https://www.khanacademy.org/computing',
                title: 'Computer Science Basics',
                description: 'Introduction to computing and technology',
                source: 'Khan Academy',
                duration: '10:00'
            }
        ]
    }
};

// Default resources by subject when no specific topic match
const DEFAULT_RESOURCES: Record<string, Resource[]> = {
    'Mathematics': [
        {
            type: 'interactive',
            url: 'https://www.khanacademy.org/math',
            title: 'Khan Academy Math',
            description: 'Practice math at your own pace',
            source: 'Khan Academy'
        }
    ],
    'Science': [
        {
            type: 'interactive',
            url: 'https://phet.colorado.edu/',
            title: 'PhET Interactive Simulations',
            description: 'Explore science through interactive simulations',
            source: 'PhET Colorado'
        }
    ],
    'English Language Arts': [
        {
            type: 'article',
            url: 'https://www.commonlit.org/',
            title: 'CommonLit',
            description: 'Free reading passages and literacy resources',
            source: 'CommonLit'
        }
    ],
    'Social Studies': [
        {
            type: 'article',
            url: 'https://www.loc.gov/classroom-materials/',
            title: 'Library of Congress',
            description: 'Primary sources for learning about history',
            source: 'Library of Congress'
        }
    ],
    'Electives': [
        {
            type: 'video',
            url: 'https://www.khanacademy.org/',
            title: 'Khan Academy',
            description: 'Free educational resources',
            source: 'Khan Academy'
        }
    ]
};

function findMatchingResources(
    subject: string,
    strand: string | null,
    topic: string | null
): Resource[] {
    const resources: Resource[] = [];
    const searchTerms: string[] = [];

    // Build search terms from topic, strand, and title
    if (topic) {
        searchTerms.push(...topic.toLowerCase().split(/\s+/));
    }
    if (strand) {
        searchTerms.push(...strand.toLowerCase().split(/\s+/));
    }

    // Search subject-specific resources
    const subjectResources = RESOURCE_DATABASE[subject];
    if (subjectResources) {
        for (const [keyword, keywordResources] of Object.entries(subjectResources)) {
            // Check if any search term matches this keyword
            if (searchTerms.some(term =>
                term.includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(term)
            )) {
                resources.push(...keywordResources);
            }
        }
    }

    // If no specific matches, add default resources
    if (resources.length === 0) {
        const defaults = DEFAULT_RESOURCES[subject];
        if (defaults) {
            resources.push(...defaults);
        }
    }

    // Limit to 3 resources per lesson
    return resources.slice(0, 3);
}

function formatResourcesForContent(resources: Resource[]): string {
    if (resources.length === 0) return '';

    const lines: string[] = ['## Additional Resources\n'];

    for (const resource of resources) {
        const icon = resource.type === 'video' ? '📺' :
            resource.type === 'interactive' ? '🎮' :
                resource.type === 'article' ? '📖' : '🖼️';

        const duration = resource.duration ? ` (${resource.duration})` : '';
        lines.push(`- ${icon} [${resource.title}](${resource.url})${duration}`);
        if (resource.description) {
            lines.push(`  *${resource.description}*`);
        }
        lines.push(`  Source: ${resource.source}\n`);
    }

    return lines.join('\n');
}

async function fetchLessons(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, media, module_id, modules(grade_band, subject, strand, topic)')
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

async function updateLessonWithResources(
    id: number,
    content: string,
    media: Resource[]
): Promise<void> {
    const { error } = await supabase
        .from('lessons')
        .update({
            content,
            media: media.length > 0 ? media : null
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update lesson ${id}: ${error.message}`);
    }
}

function contentHasResources(content: string): boolean {
    // Check if content already has a resources section
    return /##\s*(Additional\s*)?Resources/i.test(content) ||
        /##\s*Going\s*Further/i.test(content) && /\[.*\]\(https?:\/\//.test(content);
}

async function main() {
    console.log('=== PHASE 3: INTEGRATE EXTERNAL RESOURCES ===\n');

    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');
    const subjectFilter = process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];
    const limit = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

    console.log('Fetching all lessons...\n');
    const allLessons = await fetchLessons();
    console.log(`Found ${allLessons.length} total lessons\n`);

    // Filter lessons that need resources
    let lessons = allLessons.filter(lesson => {
        if (!lesson.modules) return false;
        // Skip if already has resources section with links
        if (lesson.content && contentHasResources(lesson.content) &&
            /\[.*\]\(https?:\/\//.test(lesson.content)) {
            return false;
        }
        return true;
    });

    // Apply subject filter
    if (subjectFilter) {
        lessons = lessons.filter(l =>
            l.modules?.subject.toLowerCase().includes(subjectFilter.toLowerCase())
        );
        console.log(`Filtered to ${subjectFilter}: ${lessons.length} lessons\n`);
    }

    // Apply limit
    if (limit > 0) {
        lessons = lessons.slice(0, limit);
        console.log(`Limited to ${limit} lessons\n`);
    }

    console.log(`Found ${lessons.length} lessons needing resource integration\n`);

    if (lessons.length === 0) {
        console.log('✅ All lessons already have resources!');
        return;
    }

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 5 examples:\n');
        for (const lesson of lessons.slice(0, 5)) {
            const module = lesson.modules!;
            const resources = findMatchingResources(module.subject, module.strand, module.topic);

            console.log('='.repeat(60));
            console.log(`ID: ${lesson.id} | ${lesson.title}`);
            console.log(`Subject: ${module.subject} | Strand: ${module.strand} | Topic: ${module.topic}`);
            console.log('-'.repeat(60));
            console.log(`Resources found: ${resources.length}`);
            for (const r of resources) {
                console.log(`  - [${r.type}] ${r.title} (${r.source})`);
            }
            console.log('');
        }
        console.log('\nRun without --preview to apply changes.');
        return;
    }

    // Process and update lessons
    let successCount = 0;
    let errorCount = 0;
    let resourcesAdded = 0;
    const errors: { id: number; error: string }[] = [];

    console.log(dryRun ? '🔍 DRY RUN MODE - no changes will be saved\n' : '🚀 Adding resources to lessons...\n');

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const module = lesson.modules!;

        try {
            // Find matching resources
            const resources = findMatchingResources(module.subject, module.strand, module.topic);

            if (resources.length === 0) {
                // No resources found for this lesson
                successCount++;
                continue;
            }

            // Add resources section to content
            let updatedContent = lesson.content || '';

            // Check if content ends with "Going Further" section
            if (/##\s*Going\s*Further/.test(updatedContent)) {
                // Replace the generic "Going Further" with resources
                updatedContent = updatedContent.replace(
                    /##\s*Going\s*Further[\s\S]*$/,
                    formatResourcesForContent(resources)
                );
            } else {
                // Append resources section
                updatedContent += '\n\n' + formatResourcesForContent(resources);
            }

            if (!dryRun) {
                await updateLessonWithResources(lesson.id, updatedContent, resources);
            }

            successCount++;
            resourcesAdded += resources.length;

            if ((i + 1) % 100 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} updated, ${resourcesAdded} resources added, ${errorCount} errors)`);
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
    console.log(`Total resources added: ${resourcesAdded}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
        console.log('\n⚠️ Errors:');
        for (const err of errors.slice(0, 10)) {
            console.log(`  Lesson ${err.id}: ${err.error}`);
        }
    }

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ External resources have been integrated!');
    }
}

main().catch(console.error);
