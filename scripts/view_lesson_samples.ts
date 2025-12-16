import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function viewSamples() {
    console.log('=== SAMPLE LESSON CONTENT ===\n');

    // Get a few sample lessons from different categories
    const samples = [
        { name: 'Well-formatted Launch Lesson', query: { title: 'like', value: '%Launch Lesson%' } },
        { name: 'Intro Lesson (missing goals)', query: { title: 'like', value: 'Intro:%' } },
        { name: 'Has video reference', query: { content: 'like', value: '%video%' } }
    ];

    // Sample 1: Launch Lesson (well-formatted)
    const { data: launch } = await supabase
        .from('lessons')
        .select('id, title, content, modules(grade_band, subject)')
        .ilike('title', '%Launch Lesson%')
        .limit(1);

    if (launch?.[0]) {
        console.log('--- WELL-FORMATTED LAUNCH LESSON ---');
        console.log(`Title: ${launch[0].title}`);
        console.log(`Grade: ${(launch[0].modules as any)?.grade_band} | Subject: ${(launch[0].modules as any)?.subject}`);
        console.log('\nContent:\n');
        console.log(launch[0].content?.substring(0, 1500));
        console.log('\n' + '='.repeat(60) + '\n');
    }

    // Sample 2: Intro lesson (may be missing goals)
    const { data: intro } = await supabase
        .from('lessons')
        .select('id, title, content, modules(grade_band, subject)')
        .ilike('title', 'Intro:%')
        .limit(1);

    if (intro?.[0]) {
        console.log('--- INTRO LESSON (May lack structured goals) ---');
        console.log(`Title: ${intro[0].title}`);
        console.log(`Grade: ${(intro[0].modules as any)?.grade_band} | Subject: ${(intro[0].modules as any)?.subject}`);
        console.log('\nContent:\n');
        console.log(intro[0].content?.substring(0, 1500));
        console.log('\n' + '='.repeat(60) + '\n');
    }

    // Sample 3: Check if any lessons have actual learning content vs just teacher notes
    const { data: withoutGoals } = await supabase
        .from('lessons')
        .select('id, title, content, modules(grade_band, subject)')
        .not('content', 'ilike', '%Learning Goal%')
        .limit(1);

    if (withoutGoals?.[0]) {
        console.log('--- LESSON WITHOUT EXPLICIT LEARNING GOALS ---');
        console.log(`Title: ${withoutGoals[0].title}`);
        console.log(`Grade: ${(withoutGoals[0].modules as any)?.grade_band}`);
        console.log('\nContent:\n');
        console.log(withoutGoals[0].content?.substring(0, 1500));
    }
}

viewSamples();
