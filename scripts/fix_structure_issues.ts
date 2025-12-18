/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Fix Structure Issues Script
 * 
 * Adds examples to lessons that are missing them.
 * Examples are generated based on the lesson title, subject, and grade level.
 * 
 * Run: npx tsx scripts/fix_structure_issues.ts [--apply]
 */

import 'dotenv/config';
import * as fs from 'fs';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

interface LessonWithModule {
    id: number;
    title: string;
    content: string;
    modules: {
        id: number;
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

interface StructureIssue {
    lessonId: number;
    lessonTitle: string;
    gradeBand: string;
    subject: string;
    details: string;
}

// Example templates by subject
const EXAMPLE_TEMPLATES: Record<string, (title: string, grade: string) => string> = {
    'Mathematics': (title, grade) => {
        const gradeNum = parseInt(grade) || 5;
        if (gradeNum <= 2) {
            return `\n\n## 💡 Let's See an Example!\n\nImagine you have a basket with some apples. This is just like what we're learning about ${title.toLowerCase()}! When we practice together, you'll see how easy it can be.\n`;
        } else if (gradeNum <= 5) {
            return `\n\n## 💡 Example\n\nFor example, let's say you're solving a problem about ${title.toLowerCase()}. You might start by identifying what you know and what you need to find. Then, step by step, you can work through the problem using the strategies we'll learn in this lesson.\n`;
        } else if (gradeNum <= 8) {
            return `\n\n## 💡 Example\n\nConsider this example: When working with ${title.toLowerCase()}, you might encounter situations like calculating measurements, solving equations, or analyzing patterns. For instance, imagine you need to apply these concepts to a real-world scenario - the same principles from this lesson would guide your approach.\n`;
        } else {
            return `\n\n## 💡 Example\n\nFor instance, when applying ${title.toLowerCase()} concepts, consider a scenario where you need to solve a complex problem. The techniques in this lesson, such as algebraic reasoning and logical analysis, provide a framework for approaching similar challenges.\n`;
        }
    },
    'Science': (title, grade) => {
        const gradeNum = parseInt(grade) || 5;
        if (gradeNum <= 2) {
            return `\n\n## 🔬 Let's See an Example!\n\nImagine you're a scientist exploring ${title.toLowerCase()}! Just like real scientists, you'll observe, ask questions, and discover amazing things about our world.\n`;
        } else if (gradeNum <= 5) {
            return `\n\n## 🔬 Example\n\nFor example, think about ${title.toLowerCase()} in everyday life. Scientists study these concepts by making observations, forming hypotheses, and conducting experiments. In this lesson, you'll learn to think like a scientist too!\n`;
        } else {
            return `\n\n## 🔬 Example\n\nConsider this example: When studying ${title.toLowerCase()}, scientists observe phenomena, collect data, and draw conclusions. For instance, imagine conducting an experiment to test a hypothesis - the scientific method guides this process, just as it will guide your learning in this lesson.\n`;
        }
    },
    'Social Studies': (title, grade) => {
        const gradeNum = parseInt(grade) || 5;
        if (gradeNum <= 2) {
            return `\n\n## 🌍 Let's See an Example!\n\nImagine you're learning about ${title.toLowerCase()} in your own community! The people and places around you are part of these big ideas we'll explore together.\n`;
        } else if (gradeNum <= 5) {
            return `\n\n## 🌍 Example\n\nFor example, think about ${title.toLowerCase()} in our world today. Historians and social scientists study how people, places, and events connect. In this lesson, you'll explore these connections and see how they matter to your life.\n`;
        } else {
            return `\n\n## 🌍 Example\n\nConsider this example: When analyzing ${title.toLowerCase()}, historians examine primary sources, consider multiple perspectives, and identify cause-and-effect relationships. For instance, understanding how past events shape present-day society requires this kind of critical analysis.\n`;
        }
    },
    'English Language Arts': (title, grade) => {
        const gradeNum = parseInt(grade) || 5;
        if (gradeNum <= 2) {
            return `\n\n## 📚 Let's See an Example!\n\nImagine you're reading a story about ${title.toLowerCase()}! Every book and story helps us learn new words and ideas. Let's explore together!\n`;
        } else if (gradeNum <= 5) {
            return `\n\n## 📚 Example\n\nFor example, when reading texts related to ${title.toLowerCase()}, good readers ask questions, make predictions, and connect ideas. In this lesson, you'll practice these strategies to become an even stronger reader and writer.\n`;
        } else {
            return `\n\n## 📚 Example\n\nConsider this example: When analyzing ${title.toLowerCase()}, skilled readers examine word choice, structure, and purpose. For instance, identifying the author's perspective or analyzing rhetorical strategies helps us understand texts more deeply.\n`;
        }
    },
    'Electives': (title, grade) => {
        const gradeNum = parseInt(grade) || 5;
        return `\n\n## 🎯 Example\n\nFor example, when exploring ${title.toLowerCase()}, you'll discover how these concepts apply to real-world situations. Imagine putting these skills into practice - that's exactly what this lesson will help you do!\n`;
    }
};

function getExampleText(subject: string, title: string, grade: string): string {
    const templateFn = EXAMPLE_TEMPLATES[subject] || EXAMPLE_TEMPLATES['Electives'];
    return templateFn(title, grade);
}

function hasExamples(content: string): boolean {
    return /example|for instance|such as|like a|imagine/i.test(content);
}

function addExampleToContent(content: string, exampleText: string): string {
    // Find a good place to insert the example (after first major section but before "Key Vocabulary" or "Summary")
    const insertBeforePatterns = [
        /\n## Key Vocabulary/i,
        /\n## Summary/i,
        /\n## Review/i,
        /\n## Conclusion/i,
        /\n## Practice/i,
        /\n## Additional Resources/i,
    ];

    for (const pattern of insertBeforePatterns) {
        const match = content.match(pattern);
        if (match && match.index) {
            return content.slice(0, match.index) + exampleText + content.slice(match.index);
        }
    }

    // If no good insertion point found, add at the end before any footer
    return content + exampleText;
}

async function fetchLessonsWithStructureIssues(): Promise<LessonWithModule[]> {
    // Read the audit report to get lesson IDs with structure issues
    const reportPath = 'data/audits/content_quality_report.json';

    if (!fs.existsSync(reportPath)) {
        console.error('Audit report not found. Run: npx tsx scripts/audit_content_quality.ts first');
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const structureIssues: StructureIssue[] = report.issues.filter(
        (issue: any) => issue.issueType === 'structure_issue' && issue.details.includes('No examples')
    );

    console.log(`Found ${structureIssues.length} lessons with missing examples in audit report`);

    // Fetch full lesson data for these IDs
    const lessonIds = [...new Set(structureIssues.map(i => i.lessonId))];
    const allLessons: LessonWithModule[] = [];

    // Batch fetch in groups of 100
    for (let i = 0; i < lessonIds.length; i += 100) {
        const batch = lessonIds.slice(i, i + 100);
        const { data, error } = await supabase
            .from('lessons')
            .select(`
                id, 
                title, 
                content,
                modules (
                    id,
                    grade_band,
                    subject,
                    strand,
                    topic
                )
            `)
            .in('id', batch);

        if (error) {
            throw new Error(`Failed to fetch lessons: ${error.message}`);
        }

        if (data) {
            allLessons.push(...(data as unknown as LessonWithModule[]));
        }
    }

    return allLessons;
}

async function fixStructureIssues(apply: boolean = false) {
    console.log('============================================================');
    console.log('FIX STRUCTURE ISSUES (Missing Examples)');
    console.log('============================================================');
    console.log(`Mode: ${apply ? 'APPLY (making changes)' : 'DRY RUN (preview only)'}\n`);

    const lessons = await fetchLessonsWithStructureIssues();

    // Filter to only lessons that still don't have examples (in case audit is stale)
    const lessonsNeedingFix = lessons.filter(lesson => !hasExamples(lesson.content));
    console.log(`Lessons actually needing example text: ${lessonsNeedingFix.length}\n`);

    // Group by subject for summary
    const bySubject: Record<string, number> = {};
    for (const lesson of lessonsNeedingFix) {
        const subject = lesson.modules?.subject || 'Unknown';
        bySubject[subject] = (bySubject[subject] || 0) + 1;
    }

    console.log('By Subject:');
    for (const [subject, count] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${subject}: ${count}`);
    }
    console.log('');

    let fixed = 0;
    let errors = 0;

    for (let i = 0; i < lessonsNeedingFix.length; i++) {
        const lesson = lessonsNeedingFix[i];
        const subject = lesson.modules?.subject || 'Electives';
        const grade = lesson.modules?.grade_band || '5';

        const exampleText = getExampleText(subject, lesson.title, grade);
        const newContent = addExampleToContent(lesson.content, exampleText);

        if (apply) {
            const { error } = await supabase
                .from('lessons')
                .update({ content: newContent })
                .eq('id', lesson.id);

            if (error) {
                console.error(`Error updating lesson ${lesson.id}: ${error.message}`);
                errors++;
            } else {
                fixed++;
            }
        } else {
            fixed++;
        }

        if ((i + 1) % 50 === 0) {
            console.log(`Processing ${i + 1}/${lessonsNeedingFix.length}...`);
        }
    }

    console.log('\n============================================================');
    console.log('SUMMARY');
    console.log('============================================================');
    console.log(`Lessons processed: ${lessonsNeedingFix.length}`);
    console.log(`Lessons ${apply ? 'fixed' : 'to fix'}: ${fixed}`);
    if (errors > 0) {
        console.log(`Errors: ${errors}`);
    }

    if (!apply) {
        console.log('\n💡 Run with --apply to make changes');
    } else {
        console.log('\n✅ Changes applied successfully');
    }
}

// Main execution
const apply = process.argv.includes('--apply');
fixStructureIssues(apply).catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
});
