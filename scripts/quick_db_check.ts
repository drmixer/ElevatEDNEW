import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    // Check modules
    const { count: moduleCount, error: modError } = await supabase
        .from('modules')
        .select('id', { count: 'exact', head: true });

    console.log('📦 Modules:');
    console.log('  Total count:', moduleCount ?? 'error');
    if (modError) console.log('  Error:', modError.message);

    // Get a sample module
    const { data: sampleMod } = await supabase
        .from('modules')
        .select('title, grade_band, subject')
        .limit(1)
        .single();
    if (sampleMod) {
        console.log('  Sample: "' + sampleMod.title + '" (' + sampleMod.subject + ', ' + sampleMod.grade_band + ')');
    }

    // Check lessons  
    const { count: lessonCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true });

    console.log('\n📖 Lessons:');
    console.log('  Total count:', lessonCount ?? 'error');

    // Check content structure
    const { data: sampleLessons } = await supabase
        .from('lessons')
        .select('title, content')
        .not('content', 'is', null)
        .limit(3);

    if (sampleLessons && sampleLessons.length > 0) {
        console.log('  Lessons with content: checking...');
        let withHeroImage = 0;
        for (const l of sampleLessons) {
            const c = l.content as Record<string, unknown>;
            if (c.heroImage) withHeroImage++;
        }
        console.log('  Sample content keys:', Object.keys(sampleLessons[0].content as object).slice(0, 5).join(', '));
        console.log('  With heroImage in sample:', withHeroImage + '/' + sampleLessons.length);
    }

    // Count lessons with heroImage
    const { data: allWithImages } = await supabase
        .from('lessons')
        .select('id, content')
        .not('content', 'is', null)
        .limit(500);

    if (allWithImages) {
        const total = allWithImages.length;
        let withImage = 0;
        for (const l of allWithImages) {
            const c = l.content as Record<string, unknown>;
            if (c && c.heroImage) withImage++;
        }
        console.log('  Image coverage (checked ' + total + '):', withImage + ' have heroImage (' + Math.round(withImage / total * 100) + '%)');
    }
}

check().catch(console.error);
