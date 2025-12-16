import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Module {
    id: number;
    title: string;
    subject: string;
    grade_band: string;
    strand: string | null;
    topic: string | null;
    slug: string;
}

function generateLessonContent(mod: Module): string {
    const grade = mod.grade_band;
    const gradeNum = grade === 'K' ? 0 : parseInt(grade) || 5;

    const isEarlyElementary = gradeNum <= 2;
    const isUpperElementary = gradeNum >= 3 && gradeNum <= 5;
    const isMiddleSchool = gradeNum >= 6 && gradeNum <= 8;

    let content = `# ${mod.title}: Launch Lesson\n\n`;
    content += `**Grade band:** ${grade}\n`;
    content += `**Subject:** ${mod.subject}\n`;
    if (mod.strand) content += `**Strand:** ${mod.strand}\n`;
    content += '\n';

    content += '## Learning Goals\n\n';
    if (isEarlyElementary) {
        content += `- Learn what "${mod.title.toLowerCase()}" means\n`;
        content += `- See real examples from your life\n`;
        content += `- Share your ideas with the class\n\n`;
    } else if (isUpperElementary) {
        content += `- Explain the main ideas of ${mod.title.toLowerCase()}\n`;
        content += `- Give examples from history or your community\n`;
        content += `- Compare different viewpoints\n\n`;
    } else if (isMiddleSchool) {
        content += `- Analyze key concepts related to ${mod.title.toLowerCase()}\n`;
        content += `- Evaluate primary and secondary sources\n`;
        content += `- Construct arguments supported by evidence\n\n`;
    } else {
        content += `- Synthesize multiple perspectives on ${mod.title.toLowerCase()}\n`;
        content += `- Evaluate historiographical debates\n`;
        content += `- Develop thesis-driven arguments with evidence\n\n`;
    }

    content += '## Launch (5-7 minutes)\n\n';
    content += `- Examine a source related to ${mod.title.toLowerCase()}\n`;
    content += `- Note key observations and questions\n`;
    content += `- Share with a partner\n\n`;

    content += '## Guided Exploration (10-15 minutes)\n\n';
    content += `- Teacher models analysis\n`;
    content += `- Interactive note-taking\n`;
    content += `- Check for understanding\n\n`;

    content += '## Collaborative Practice (15-20 minutes)\n\n';
    content += `- Work in groups on analysis\n`;
    content += `- Draft claims with evidence\n`;
    content += `- Prepare to share\n\n`;

    content += '## Exit Ticket (5 minutes)\n\n';
    content += `- Write key takeaways\n`;
    content += `- List remaining questions\n\n`;

    content += '## Extensions\n\n';
    content += `- **Challenge:** Deeper research\n`;
    content += `- **Support:** Additional scaffolding\n`;

    return content;
}

async function generateMissingLessons() {
    console.log('Finding modules without lessons...\n');

    const { data: modules } = await supabase.from('modules').select('id, title, subject, grade_band, strand, topic, slug');
    const { data: lessons } = await supabase.from('lessons').select('module_id');

    const moduleIdsWithLessons = new Set(lessons?.map(l => l.module_id) || []);
    const missing: Module[] = modules?.filter(m => !moduleIdsWithLessons.has(m.id)) || [];

    console.log(`Found ${missing.length} modules without lessons.\n`);

    // Get all existing topics
    const { data: existingTopics } = await supabase.from('topics').select('id, name, subject_id');
    const topicLookup: Record<string, number> = {};
    for (const t of existingTopics || []) {
        topicLookup[`${t.subject_id}:${t.name}`] = t.id;
    }
    console.log(`Loaded ${Object.keys(topicLookup).length} existing topics\n`);

    // Get subject IDs
    const { data: subjects } = await supabase.from('subjects').select('id, name');
    const subjectMap: Record<string, number> = {};
    for (const s of subjects || []) {
        subjectMap[s.name] = s.id;
    }

    let created = 0;
    let errors = 0;

    for (const mod of missing) {
        const subjectId = subjectMap[mod.subject] || 13;

        // Try to find existing topic first
        let topicId = topicLookup[`${subjectId}:${mod.title}`];

        if (!topicId) {
            // Create new topic
            const topicSlug = `${mod.grade_band}-${mod.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.substring(0, 80);
            const { data: newTopic, error: topicError } = await supabase
                .from('topics')
                .insert({
                    name: mod.title,
                    subject_id: subjectId,
                    description: `${mod.subject} topic for grade ${mod.grade_band}`,
                    slug: topicSlug,
                })
                .select('id')
                .single();

            if (topicError) {
                // Search for any topic with this name
                const { data: anyTopic } = await supabase
                    .from('topics')
                    .select('id')
                    .eq('name', mod.title)
                    .limit(1);

                if (anyTopic && anyTopic.length > 0) {
                    topicId = anyTopic[0].id;
                }
            } else {
                topicId = newTopic?.id;
                topicLookup[`${subjectId}:${mod.title}`] = topicId;
            }
        }

        if (!topicId) {
            console.log(`❌ Skipping ${mod.title}: No topic_id available`);
            errors++;
            continue;
        }

        const content = generateLessonContent(mod);
        const lessonSlug = `g${mod.grade_band}-mod${mod.id}-${mod.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-launch`.substring(0, 100);

        const { error } = await supabase.from('lessons').insert({
            module_id: mod.id,
            topic_id: topicId,
            title: `${mod.title}: Grade ${mod.grade_band} Launch Lesson`,
            content: content,
            slug: lessonSlug,
            is_published: true,
            visibility: 'public',
            open_track: true,
            estimated_duration_minutes: parseInt(mod.grade_band) <= 2 ? 30 : 45,
            attribution_block: 'ElevatED Curriculum Team · CC BY',
            metadata: {
                seeded_at: new Date().toISOString(),
                seeded_by: 'generate_missing_lessons',
            }
        });

        if (error) {
            console.log(`❌ Lesson error: Grade ${mod.grade_band} - ${mod.title}: ${error.message}`);
            errors++;
        } else {
            console.log(`✅ Created: Grade ${mod.grade_band} - ${mod.title}`);
            created++;
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Created: ${created} lessons`);
    console.log(`Errors: ${errors}`);
}

generateMissingLessons();
