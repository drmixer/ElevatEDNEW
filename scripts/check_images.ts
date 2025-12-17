import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkImages() {
    console.log('🖼️  Checking for images in lessons...\n');

    // Get lessons with content
    const { data: lessons } = await supabase
        .from('lessons')
        .select('title, content, media, metadata')
        .limit(200);

    if (!lessons) {
        console.log('No lessons found');
        return;
    }

    let withImageInMeta = 0;
    let withImageInMedia = 0;
    let withImageInContent = 0;

    for (const lesson of lessons) {
        const meta = lesson.metadata as Record<string, unknown> | null;
        const media = lesson.media as Array<{ type?: string }> | null;
        const content = lesson.content as string || '';

        // Check metadata for image fields
        if (meta?.heroImage || meta?.hero_image || meta?.image_url || meta?.thumbnail) {
            withImageInMeta++;
        }

        // Check media array for images
        if (media?.some(m => m.type === 'image')) {
            withImageInMedia++;
        }

        // Check content markdown for images
        if (content.includes('![') || content.includes('imgur.com') || content.includes('.png') || content.includes('.jpg')) {
            withImageInContent++;
        }
    }

    console.log('Lessons checked:', lessons.length);
    console.log('With image in metadata:', withImageInMeta);
    console.log('With image in media array:', withImageInMedia);
    console.log('With image in content markdown:', withImageInContent);

    // Show a sample lesson with image content
    const sampleWithImage = lessons.find(l => {
        const c = l.content as string || '';
        return c.includes('![') || c.includes('imgur');
    });

    if (sampleWithImage) {
        console.log('\nSample lesson with image reference:');
        console.log('  Title:', sampleWithImage.title);
        const c = sampleWithImage.content as string;
        const imgMatch = c.match(/!\[.*?\]\(.*?\)/);
        if (imgMatch) {
            console.log('  Image markdown:', imgMatch[0].substring(0, 100));
        }
    }

    // Check the add_lesson_images script results
    const { data: withHeroImage } = await supabase
        .from('lessons')
        .select('metadata')
        .not('metadata', 'is', null)
        .limit(500);

    if (withHeroImage) {
        let count = 0;
        for (const l of withHeroImage) {
            const m = l.metadata as Record<string, unknown>;
            if (m?.heroImage) count++;
        }
        console.log('\nLessons with metadata.heroImage:', count);
    }
}

checkImages().catch(console.error);
