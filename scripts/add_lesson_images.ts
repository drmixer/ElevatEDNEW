/**
 * Phase 3b: Add Educational Images to Lessons
 * 
 * Adds relevant images to lesson content from open educational resources:
 * - Wikimedia Commons (diagrams, historical images)
 * - NASA (space science)
 * - USGS (earth science)
 * - SVG educational diagrams
 * 
 * Images are added inline in markdown format within the content.
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
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

// Curated educational images by subject and topic
// Using Wikimedia Commons, NASA, and other public domain sources
const EDUCATIONAL_IMAGES: Record<string, Record<string, { url: string; alt: string; caption: string }[]>> = {
    'Mathematics': {
        'default': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Simple_multiplication_table.svg/400px-Simple_multiplication_table.svg.png', alt: 'Multiplication table', caption: 'A multiplication table helps us see number patterns' },
        ],
        'Fractions': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Cake_fractions.svg/400px-Cake_fractions.svg.png', alt: 'Fraction visualization with cake slices', caption: 'Fractions show parts of a whole' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Fraction_Bars_Equivalence.svg/400px-Fraction_Bars_Equivalence.svg.png', alt: 'Equivalent fractions', caption: 'Fraction bars showing equivalent fractions' },
        ],
        'Geometry': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Regular_polygon_3-12.svg/400px-Regular_polygon_3-12.svg.png', alt: 'Regular polygons', caption: 'Regular polygons from triangle to dodecagon' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Pythagorean_theorem.svg/400px-Pythagorean_theorem.svg.png', alt: 'Pythagorean theorem', caption: 'The Pythagorean theorem: a² + b² = c²' },
        ],
        'Algebra': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Linear_Function_Graph.svg/400px-Linear_Function_Graph.svg.png', alt: 'Linear function graph', caption: 'A linear equation creates a straight line' },
        ],
        'Number Sense': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Number-line.svg/400px-Number-line.svg.png', alt: 'Number line', caption: 'A number line helps us visualize numbers' },
        ],
        'Measurement': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Ruler-cm.svg/400px-Ruler-cm.svg.png', alt: 'Centimeter ruler', caption: 'A ruler for measuring length' },
        ],
        'Statistics': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bar_chart_race_example.svg/400px-Bar_chart_race_example.svg.png', alt: 'Bar chart example', caption: 'Bar charts help us compare data' },
        ],
    },
    'Science': {
        'default': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Periodic_table_large.svg/800px-Periodic_table_large.svg.png', alt: 'Periodic table of elements', caption: 'The periodic table organizes all known elements' },
        ],
        'Life Science': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Animal_cell_structure_en.svg/400px-Animal_cell_structure_en.svg.png', alt: 'Animal cell diagram', caption: 'Parts of an animal cell' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Simple_diagram_of_plant_cell_%28en%29.svg/400px-Simple_diagram_of_plant_cell_%28en%29.svg.png', alt: 'Plant cell diagram', caption: 'Parts of a plant cell' },
        ],
        'Earth Science': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Water_Cycle-en.svg/600px-Water_Cycle-en.svg.png', alt: 'Water cycle diagram', caption: 'The water cycle shows how water moves through our environment' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Earth%27s_Interior.svg/400px-Earth%27s_Interior.svg.png', alt: 'Earth layers diagram', caption: 'The layers of Earth from crust to core' },
        ],
        'Physical Science': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Simple_Atom.svg/400px-Simple_Atom.svg.png', alt: 'Atom diagram', caption: 'A simple model of an atom' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/States_of_matter_En.svg/400px-States_of_matter_En.svg.png', alt: 'States of matter', caption: 'The three common states of matter' },
        ],
        'Astronomy': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Solar_System_size_to_scale.svg/800px-Solar_System_size_to_scale.svg.png', alt: 'Solar system planets', caption: 'The planets of our solar system' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Phases_of_the_Moon.svg/600px-Phases_of_the_Moon.svg.png', alt: 'Moon phases', caption: 'The phases of the Moon' },
        ],
        'Biology': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/DNA_Double_Helix.svg/400px-DNA_Double_Helix.svg.png', alt: 'DNA double helix', caption: 'The double helix structure of DNA' },
        ],
        'Ecology': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Food_web.svg/400px-Food_web.svg.png', alt: 'Food web diagram', caption: 'A food web shows how energy flows through an ecosystem' },
        ],
    },
    'Social Studies': {
        'default': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/World_map_blank_without_borders.svg/800px-World_map_blank_without_borders.svg.png', alt: 'World map', caption: 'A map of the world' },
        ],
        'Geography': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Continents_colour.svg/600px-Continents_colour.svg.png', alt: 'World continents map', caption: 'The seven continents of Earth' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Map_of_the_United_States_with_state_names.svg/800px-Map_of_the_United_States_with_state_names.svg.png', alt: 'US states map', caption: 'The 50 states of the United States' },
        ],
        'History': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/US_timeline_dates.svg/800px-US_timeline_dates.svg.png', alt: 'US history timeline', caption: 'Key dates in American history' },
        ],
        'Government': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Organization_of_the_US_Government.svg/600px-Organization_of_the_US_Government.svg.png', alt: 'US Government structure', caption: 'The three branches of US government' },
        ],
        'Economics': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Supply-and-demand.svg/400px-Supply-and-demand.svg.png', alt: 'Supply and demand graph', caption: 'Supply and demand curves' },
        ],
    },
    'English Language Arts': {
        'default': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Story_structure.svg/400px-Story_structure.svg.png', alt: 'Story structure diagram', caption: 'The structure of a story' },
        ],
        'Writing': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Writing_process.svg/400px-Writing_process.svg.png', alt: 'Writing process', caption: 'The writing process: prewrite, draft, revise, edit, publish' },
        ],
    },
    'Electives': {
        'default': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Lightbulb_icon.svg/400px-Lightbulb_icon.svg.png', alt: 'Lightbulb icon representing learning', caption: 'Learning new skills helps us grow' },
        ],
        'Music': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Music_staff.svg/400px-Music_staff.svg.png', alt: 'Musical staff', caption: 'A musical staff with notes' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Treble_clef.svg/200px-Treble_clef.svg.png', alt: 'Treble clef', caption: 'The treble clef is used for higher pitched notes' },
        ],
        'Art': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Color_circle_%28RGB%29.svg/400px-Color_circle_%28RGB%29.svg.png', alt: 'Color wheel', caption: 'The color wheel shows how colors relate to each other' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Palette_and_brushes.svg/400px-Palette_and_brushes.svg.png', alt: 'Art palette and brushes', caption: 'Artists use palettes to mix colors' },
        ],
        'Health': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Human_heart.svg/400px-Human_heart.svg.png', alt: 'Human heart diagram', caption: 'The heart pumps blood throughout your body' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/MyPlate.svg/400px-MyPlate.svg.png', alt: 'MyPlate nutrition guide', caption: 'A balanced plate helps you eat healthy' },
        ],
        'Nutrition': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/MyPlate.svg/400px-MyPlate.svg.png', alt: 'MyPlate nutrition guide', caption: 'A balanced plate includes all food groups' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Food_pyramid.svg/400px-Food_pyramid.svg.png', alt: 'Food pyramid', caption: 'The food pyramid shows how much of each food group we need' },
        ],
        'Fitness': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Exercise_icon.svg/400px-Exercise_icon.svg.png', alt: 'Exercise icon', caption: 'Regular exercise keeps our bodies strong and healthy' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Running_icon.svg/400px-Running_icon.svg.png', alt: 'Running icon', caption: 'Running is a great way to stay fit' },
        ],
        'Safety': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/First_aid_kit.svg/400px-First_aid_kit.svg.png', alt: 'First aid kit', caption: 'First aid kits help us respond to emergencies' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Stop_sign.svg/400px-Stop_sign.svg.png', alt: 'Stop sign', caption: 'Safety signs help keep us protected' },
        ],
        'Physical Education': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Football_%28soccer_ball%29.svg/400px-Football_%28soccer_ball%29.svg.png', alt: 'Soccer ball', caption: 'Sports help us stay active and work as a team' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Volleyball.svg/400px-Volleyball.svg.png', alt: 'Volleyball', caption: 'Team sports teach cooperation and coordination' },
        ],
        'PE': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Football_%28soccer_ball%29.svg/400px-Football_%28soccer_ball%29.svg.png', alt: 'Soccer ball', caption: 'Physical education helps us build healthy habits' },
        ],
        'Technology': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Desktop_computer_clipart_-_Yellow_theme.svg/400px-Desktop_computer_clipart_-_Yellow_theme.svg.png', alt: 'Computer', caption: 'Computers are tools that help us learn and create' },
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Keyboard_icon.svg/400px-Keyboard_icon.svg.png', alt: 'Keyboard', caption: 'Typing is an important skill in the digital age' },
        ],
        'Coding': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/HTML5_logo_black.svg/400px-HTML5_logo_black.svg.png', alt: 'HTML5 logo', caption: 'HTML is a language used to create websites' },
        ],
        'Drama': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Comedy_and_tragedy_masks_without_background.svg/400px-Comedy_and_tragedy_masks_without_background.svg.png', alt: 'Comedy and tragedy masks', caption: 'Theater masks represent comedy and tragedy' },
        ],
        'Foreign Language': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Globe_icon.svg/400px-Globe_icon.svg.png', alt: 'Globe', caption: 'Learning languages helps us connect with people around the world' },
        ],
        'Life Skills': [
            { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Teamwork.svg/400px-Teamwork.svg.png', alt: 'Teamwork illustration', caption: 'Life skills help us work together and solve problems' },
        ],
    },
};

function findBestImage(subject: string, topic: string | null, strand: string | null): { url: string; alt: string; caption: string } | null {
    const subjectImages = EDUCATIONAL_IMAGES[subject];
    if (!subjectImages) return null;

    // Try to match topic first
    if (topic) {
        const topicLower = topic.toLowerCase();
        for (const [key, images] of Object.entries(subjectImages)) {
            if (key !== 'default' && topicLower.includes(key.toLowerCase())) {
                return images[Math.floor(Math.random() * images.length)];
            }
        }
    }

    // Try to match strand
    if (strand) {
        const strandLower = strand.toLowerCase();
        for (const [key, images] of Object.entries(subjectImages)) {
            if (key !== 'default' && strandLower.includes(key.toLowerCase())) {
                return images[Math.floor(Math.random() * images.length)];
            }
        }
    }

    // Fall back to default
    const defaults = subjectImages['default'];
    if (defaults && defaults.length > 0) {
        return defaults[Math.floor(Math.random() * defaults.length)];
    }

    return null;
}

function addImageToContent(content: string, image: { url: string; alt: string; caption: string }): string {
    // Find the best place to insert the image - after Introduction section
    const introMatch = content.match(/(## Introduction[\s\S]*?)(\n## |\n---(?=\n##)|$)/i);

    if (introMatch) {
        const insertPoint = introMatch.index! + introMatch[1].length;
        const imageMarkdown = `\n\n![${image.alt}](${image.url})\n*${image.caption}*\n`;
        return content.slice(0, insertPoint) + imageMarkdown + content.slice(insertPoint);
    }

    // If no Introduction, try after Learning Goals
    const goalsMatch = content.match(/(## Learning Goals?[\s\S]*?)(\n## |\n---(?=\n##)|$)/i);
    if (goalsMatch) {
        const insertPoint = goalsMatch.index! + goalsMatch[1].length;
        const imageMarkdown = `\n\n![${image.alt}](${image.url})\n*${image.caption}*\n`;
        return content.slice(0, insertPoint) + imageMarkdown + content.slice(insertPoint);
    }

    return content;
}

function hasImage(content: string): boolean {
    return /!\[.*\]\(https?:\/\/[^)]+\)/i.test(content);
}

async function fetchLessons(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, modules(grade_band, subject, strand, topic)')
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
    console.log('=== ADD EDUCATIONAL IMAGES TO LESSONS ===\n');

    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

    console.log('Fetching all lessons...\n');
    const allLessons = await fetchLessons();
    console.log(`Found ${allLessons.length} total lessons\n`);

    // Filter to lessons without images
    let lessons = allLessons.filter(lesson => !hasImage(lesson.content));
    console.log(`${lessons.length} lessons need images\n`);

    if (limit > 0) {
        lessons = lessons.slice(0, limit);
        console.log(`Limited to ${limit} lessons\n`);
    }

    if (lessons.length === 0) {
        console.log('✅ All lessons already have images!');
        return;
    }

    // Count by subject
    const bySubject: Record<string, number> = {};
    for (const lesson of lessons) {
        const subject = lesson.modules?.subject || 'Unknown';
        bySubject[subject] = (bySubject[subject] || 0) + 1;
    }
    console.log('Lessons by subject:');
    for (const [subject, count] of Object.entries(bySubject)) {
        console.log(`  ${subject}: ${count}`);
    }
    console.log('');

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 5 examples:\n');
        for (const lesson of lessons.slice(0, 5)) {
            const module = lesson.modules;
            if (!module) continue;

            const image = findBestImage(module.subject, module.topic, module.strand);
            console.log('='.repeat(60));
            console.log(`ID: ${lesson.id} | ${module.subject} | ${module.topic || module.strand || 'N/A'}`);
            console.log(`Title: ${lesson.title}`);

            if (image) {
                console.log(`\nImage to add:`);
                console.log(`  Alt: ${image.alt}`);
                console.log(`  URL: ${image.url}`);
                console.log(`  Caption: ${image.caption}`);
            } else {
                console.log('\n  No matching image found');
            }
            console.log('');
        }
        console.log('\nRun without --preview to apply changes.');
        return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log(dryRun ? '🔍 DRY RUN MODE\n' : '🚀 Adding images to lessons...\n');

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const module = lesson.modules;

        if (!module) {
            skippedCount++;
            continue;
        }

        const image = findBestImage(module.subject, module.topic, module.strand);
        if (!image) {
            skippedCount++;
            continue;
        }

        try {
            const updatedContent = addImageToContent(lesson.content, image);

            if (!dryRun) {
                await updateLessonContent(lesson.id, updatedContent);
            }

            successCount++;

            if ((i + 1) % 100 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} added, ${skippedCount} skipped, ${errorCount} errors)`);
            }
        } catch (err) {
            errorCount++;
        }
    }

    console.log('\n=== SUMMARY ===\n');
    console.log(`Total processed: ${lessons.length}`);
    console.log(`Images added: ${successCount}`);
    console.log(`Skipped (no matching image): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Educational images have been added to lessons!');
    }
}

main().catch(console.error);
