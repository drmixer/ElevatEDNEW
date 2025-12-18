/**
 * Analyze lessons with placeholder vocabulary
 * These contain text like "A key term related to..."
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LessonData {
    id: number;
    title: string;
    content: string;
    module_id: number;
    modules: {
        subject: string;
        grade_band: string;
    };
}

async function main() {
    console.log('='.repeat(60));
    console.log('ANALYZING PLACEHOLDER VOCABULARY');
    console.log('='.repeat(60));
    console.log();

    // Get all lessons with pagination
    const allLessons: LessonData[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data: batch, error } = await supabase
            .from('lessons')
            .select('id, title, content, module_id, modules!inner(subject, grade_band)')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Error fetching lessons:', error);
            break;
        }

        if (!batch || batch.length === 0) break;
        allLessons.push(...(batch as LessonData[]));
        if (batch.length < batchSize) break;
        offset += batchSize;
    }

    console.log(`Total lessons: ${allLessons.length}`);

    // Find lessons with placeholder vocabulary
    const placeholderPattern = /A key term related to/i;
    const lessonsWithPlaceholder = allLessons.filter(l =>
        l.content && placeholderPattern.test(l.content)
    );

    console.log(`Lessons with placeholder vocabulary: ${lessonsWithPlaceholder.length}`);

    // Analyze by subject
    const bySubject: Record<string, number> = {};
    for (const lesson of lessonsWithPlaceholder) {
        const subject = lesson.modules?.subject || 'Unknown';
        bySubject[subject] = (bySubject[subject] || 0) + 1;
    }

    console.log('\nBy Subject:');
    Object.entries(bySubject)
        .sort((a, b) => b[1] - a[1])
        .forEach(([s, c]) => {
            console.log(`  ${s}: ${c}`);
        });

    // Analyze by grade
    const byGrade: Record<string, number> = {};
    for (const lesson of lessonsWithPlaceholder) {
        const grade = lesson.modules?.grade_band || 'Unknown';
        byGrade[grade] = (byGrade[grade] || 0) + 1;
    }

    console.log('\nBy Grade:');
    Object.entries(byGrade)
        .sort((a, b) => {
            const aNum = a[0] === 'K' ? 0 : parseInt(a[0]);
            const bNum = b[0] === 'K' ? 0 : parseInt(b[0]);
            return aNum - bNum;
        })
        .forEach(([g, c]) => {
            console.log(`  Grade ${g}: ${c}`);
        });

    // Extract and analyze actual placeholder patterns
    const placeholderMatches: string[] = [];
    for (const lesson of lessonsWithPlaceholder) {
        const matches = lesson.content.match(/A key term related to[^.:\n]+/gi);
        if (matches) {
            placeholderMatches.push(...matches);
        }
    }

    console.log(`\nTotal placeholder instances: ${placeholderMatches.length}`);

    // Show unique patterns
    const uniquePatterns = [...new Set(placeholderMatches)];
    console.log(`Unique patterns: ${uniquePatterns.length}`);

    console.log('\nSample placeholder patterns:');
    uniquePatterns.slice(0, 10).forEach(p => {
        console.log(`  -> ${p.substring(0, 80)}${p.length > 80 ? '...' : ''}`);
    });

    // Show sample lessons
    console.log('\n' + '-'.repeat(60));
    console.log('SAMPLE LESSONS WITH PLACEHOLDERS');
    console.log('-'.repeat(60));

    for (const lesson of lessonsWithPlaceholder.slice(0, 5)) {
        console.log(`\nLesson ${lesson.id}: ${lesson.title}`);
        console.log(`  Subject: ${lesson.modules?.subject}, Grade: ${lesson.modules?.grade_band}`);

        // Find the context around placeholders
        const contentLines = lesson.content.split('\n');
        for (const line of contentLines) {
            if (line.includes('A key term related to')) {
                console.log(`  Placeholder: "${line.trim().substring(0, 100)}..."`);
                break;
            }
        }
    }

    // Return data for use by fix script
    return {
        total: lessonsWithPlaceholder.length,
        bySubject,
        byGrade,
        lessons: lessonsWithPlaceholder.map(l => ({
            id: l.id,
            title: l.title,
            subject: l.modules?.subject,
            grade: l.modules?.grade_band
        }))
    };
}

main().catch(console.error);
