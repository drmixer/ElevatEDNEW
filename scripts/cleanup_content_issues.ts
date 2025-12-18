/**
 * Content Cleanup Script
 *
 * Fixes critical content issues identified by the audit:
 * - Removes grade-inappropriate images (e.g., Pythagorean theorem in Grade 1)
 * - Removes advanced vocabulary from lower grades
 *
 * Run: npx tsx scripts/cleanup_content_issues.ts [--dry-run] [--apply]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Images that should NOT appear in certain grade levels
const GRADE_INAPPROPRIATE_IMAGES: Record<string, number> = {
    // Image URL pattern -> minimum grade allowed
    'Pythagorean_theorem': 8,
    'pythagorean': 8,
    'DNA_Double_Helix': 6,
    'Linear_Function_Graph': 6,
    'Periodic_table': 5,
    'Animal_cell_structure': 4,
    'Plant_cell': 4,
};

// Advanced terms that should NOT appear in lower grades
const GRADE_INAPPROPRIATE_TERMS: Record<string, { term: RegExp; minGrade: number }[]> = {
    'K': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /theorem/gi, minGrade: 5 },
        { term: /algebra/gi, minGrade: 6 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
        { term: /coefficient/gi, minGrade: 6 },
        { term: /variable/gi, minGrade: 5 },
        { term: /equation/gi, minGrade: 5 },
        { term: /exponent/gi, minGrade: 5 },
    ],
    '1': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /theorem/gi, minGrade: 5 },
        { term: /algebra/gi, minGrade: 6 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
        { term: /coefficient/gi, minGrade: 6 },
        { term: /variable/gi, minGrade: 5 },
        { term: /equation/gi, minGrade: 5 },
    ],
    '2': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /theorem/gi, minGrade: 5 },
        { term: /algebra/gi, minGrade: 6 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
        { term: /coefficient/gi, minGrade: 6 },
    ],
    '3': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /theorem/gi, minGrade: 5 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
    ],
    '4': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /theorem/gi, minGrade: 5 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
    ],
    '5': [
        { term: /pythagorean/gi, minGrade: 8 },
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
        { term: /trigonometry/gi, minGrade: 9 },
    ],
    '6': [
        { term: /quadratic/gi, minGrade: 8 },
        { term: /polynomial/gi, minGrade: 8 },
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
    ],
    '7': [
        { term: /derivative/gi, minGrade: 11 },
        { term: /integral/gi, minGrade: 11 },
        { term: /logarithm/gi, minGrade: 9 },
    ],
};

interface LessonRecord {
    id: number;
    title: string;
    content: string;
    modules: {
        id: number;
        grade_band: string;
        subject: string;
    } | null;
}

interface CleanupResult {
    lessonId: number;
    title: string;
    gradeBand: string;
    changes: string[];
    originalContent: string;
    cleanedContent: string;
}

function extractGradeNumber(gradeBand: string): number {
    const match = gradeBand.match(/\d+/);
    if (match) {
        return parseInt(match[0], 10);
    }
    if (gradeBand.toLowerCase() === 'k' || gradeBand.toLowerCase() === 'grade k') {
        return 0;
    }
    return 0;
}

function extractGradeKey(gradeBand: string): string {
    const match = gradeBand.match(/\d+/);
    if (match) {
        return match[0];
    }
    if (gradeBand.toLowerCase().includes('k')) {
        return 'K';
    }
    return 'K';
}

function removeInappropriateImages(content: string, gradeNum: number): { content: string; changes: string[] } {
    const changes: string[] = [];
    let cleanedContent = content;

    // Find all markdown images
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)\n?\*?[^*\n]*\*?\n?/g;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const imageUrl = match[2];

        // Check if this image is appropriate for the grade
        for (const [pattern, minGrade] of Object.entries(GRADE_INAPPROPRIATE_IMAGES)) {
            if (imageUrl.toLowerCase().includes(pattern.toLowerCase()) && gradeNum < minGrade) {
                changes.push(`Removed image "${pattern}" (requires Grade ${minGrade}+)`);
                cleanedContent = cleanedContent.replace(fullMatch, '');
                break;
            }
        }
    }

    return { content: cleanedContent, changes };
}

function removeInappropriateTerms(content: string, gradeKey: string, gradeNum: number): { content: string; changes: string[] } {
    const changes: string[] = [];
    let cleanedContent = content;

    const termsToCheck = GRADE_INAPPROPRIATE_TERMS[gradeKey] || [];

    for (const { term, minGrade } of termsToCheck) {
        if (gradeNum < minGrade && term.test(content)) {
            // For image captions containing these terms, remove the whole image block
            const captionRegex = new RegExp(`\\n?\\*[^*]*${term.source}[^*]*\\*\\n?`, 'gi');
            if (captionRegex.test(cleanedContent)) {
                cleanedContent = cleanedContent.replace(captionRegex, '\n');
                changes.push(`Removed caption containing "${term.source}" (requires Grade ${minGrade}+)`);
            }
        }
    }

    return { content: cleanedContent, changes };
}

async function fetchLessons(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select(`
                id,
                title,
                content,
                modules (
                    id,
                    grade_band,
                    subject
                )
            `)
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
    console.log('=== CONTENT CLEANUP SCRIPT ===\n');

    const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
    const verbose = process.argv.includes('--verbose');

    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
        console.log('🚀 APPLY MODE - Changes will be saved to database\n');
    }

    console.log('Fetching lessons...');
    const lessons = await fetchLessons();
    console.log(`Found ${lessons.length} lessons\n`);

    const results: CleanupResult[] = [];
    let processedCount = 0;
    let changedCount = 0;

    for (const lesson of lessons) {
        const gradeBand = lesson.modules?.grade_band || 'Unknown';
        const gradeNum = extractGradeNumber(gradeBand);
        const gradeKey = extractGradeKey(gradeBand);

        let cleanedContent = lesson.content;
        const allChanges: string[] = [];

        // Remove inappropriate images
        const imageResult = removeInappropriateImages(cleanedContent, gradeNum);
        cleanedContent = imageResult.content;
        allChanges.push(...imageResult.changes);

        // Remove inappropriate term captions
        const termResult = removeInappropriateTerms(cleanedContent, gradeKey, gradeNum);
        cleanedContent = termResult.content;
        allChanges.push(...termResult.changes);

        // Clean up extra whitespace from removals
        cleanedContent = cleanedContent
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (allChanges.length > 0) {
            results.push({
                lessonId: lesson.id,
                title: lesson.title,
                gradeBand,
                changes: allChanges,
                originalContent: lesson.content,
                cleanedContent,
            });

            if (!dryRun) {
                await updateLessonContent(lesson.id, cleanedContent);
            }

            changedCount++;

            if (verbose) {
                console.log(`[${lesson.id}] ${lesson.title} (${gradeBand})`);
                for (const change of allChanges) {
                    console.log(`  - ${change}`);
                }
            }
        }

        processedCount++;
        if (processedCount % 200 === 0) {
            console.log(`Processed ${processedCount}/${lessons.length}...`);
        }
    }

    console.log('\n=== CLEANUP SUMMARY ===\n');
    console.log(`Total lessons processed: ${processedCount}`);
    console.log(`Lessons with changes: ${changedCount}`);

    if (results.length > 0) {
        console.log('\nLessons cleaned:');
        for (const result of results) {
            console.log(`  [${result.lessonId}] ${result.title} (${result.gradeBand})`);
            for (const change of result.changes) {
                console.log(`    - ${change}`);
            }
        }
    }

    // Save report
    const reportPath = 'data/audits/cleanup_report.json';
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
        timestamp: new Date().toISOString(),
        mode: dryRun ? 'dry-run' : 'applied',
        totalProcessed: processedCount,
        totalChanged: changedCount,
        changes: results.map(r => ({
            lessonId: r.lessonId,
            title: r.title,
            gradeBand: r.gradeBand,
            changes: r.changes,
        })),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${reportPath}`);

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run with --apply to save changes.');
    } else {
        console.log('\n✅ Changes have been applied to the database!');
    }
}

main().catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
});
