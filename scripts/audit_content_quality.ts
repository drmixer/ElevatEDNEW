/**
 * Content Quality Audit Script
 * 
 * Analyzes all lessons in the database and flags quality issues:
 * - Placeholder vocabulary definitions
 * - Grade-inappropriate content (advanced concepts in lower grades)
 * - Missing objectives/structure
 * - Short/template-like content
 * - Missing practice questions
 * 
 * Run: npx tsx scripts/audit_content_quality.ts [--output path/to/output]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from './utils/supabase.js';

const supabase = createServiceRoleClient();

// Grade-inappropriate terms for different grade bands
const ADVANCED_TERMS_BY_GRADE: Record<string, RegExp[]> = {
    'K': [
        /pythagorean/i, /theorem/i, /algebra/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i,
        /coefficient/i, /variable/i, /equation/i, /exponent/i
    ],
    '1': [
        /pythagorean/i, /theorem/i, /algebra/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i,
        /coefficient/i, /variable/i, /equation/i
    ],
    '2': [
        /pythagorean/i, /theorem/i, /algebra/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i,
        /coefficient/i
    ],
    '3': [
        /pythagorean/i, /theorem/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i
    ],
    '4': [
        /pythagorean/i, /theorem/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i
    ],
    '5': [
        /pythagorean/i, /quadratic/i, /polynomial/i,
        /derivative/i, /integral/i, /logarithm/i, /trigonometry/i
    ],
    '6': [
        /quadratic/i, /polynomial/i, /derivative/i, /integral/i, /logarithm/i
    ],
    '7': [
        /derivative/i, /integral/i, /logarithm/i
    ]
};

// Placeholder patterns to detect
const PLACEHOLDER_PATTERNS = [
    /A key term related to/i,
    /Definition pending/i,
    /TODO:/i,
    /PLACEHOLDER/i,
    /Lorem ipsum/i,
    /\[INSERT.*\]/i,
    /\{.*\}/,  // Template variables
];

// Template content patterns
const TEMPLATE_PATTERNS = [
    /Explore the concepts and skills of/i,
    /Develop understanding and apply learning/i,
    /Build fluency and confidence with/i,
    /Practice question \d+ for/i,
];

interface LessonRecord {
    id: number;
    title: string;
    content: string;
    estimated_duration_minutes: number | null;
    modules: {
        id: number;
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

interface QualityIssue {
    lessonId: number;
    lessonTitle: string;
    gradeBand: string;
    subject: string;
    issueType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    details: string;
}

interface AuditReport {
    timestamp: string;
    totalLessons: number;
    issueCount: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
    issuesBySubject: Record<string, number>;
    issuesByGrade: Record<string, number>;
    issues: QualityIssue[];
    lessonsNeedingReview: number[];
}

function extractGradeNumber(gradeBand: string): string {
    const match = gradeBand.match(/\d+/);
    return match ? match[0] : gradeBand;
}

function checkPlaceholderVocabulary(content: string): string[] {
    const issues: string[] = [];

    for (const pattern of PLACEHOLDER_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            issues.push(`Placeholder text found: "${matches[0]}"`);
        }
    }

    return issues;
}

function checkGradeAppropriateness(content: string, gradeBand: string): string[] {
    const issues: string[] = [];
    const gradeNum = extractGradeNumber(gradeBand);
    const patterns = ADVANCED_TERMS_BY_GRADE[gradeNum] || [];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            issues.push(`Advanced term "${match[0]}" may be inappropriate for Grade ${gradeNum}`);
        }
    }

    return issues;
}

function checkTemplateContent(content: string): string[] {
    const issues: string[] = [];

    for (const pattern of TEMPLATE_PATTERNS) {
        if (pattern.test(content)) {
            issues.push(`Template/generated content detected`);
            break;
        }
    }

    return issues;
}

function checkContentStructure(content: string): string[] {
    const issues: string[] = [];

    // Check for learning objectives
    if (!content.includes('Learning Goal') && !content.includes('Objective') && !content.includes("What You'll Learn")) {
        issues.push('Missing learning objectives section');
    }

    // Check minimum content length
    if (content.length < 500) {
        issues.push(`Content too short (${content.length} chars, minimum 500)`);
    }

    // Check for examples
    const hasExamples = /example|for instance|such as|like a|imagine/i.test(content);
    if (!hasExamples) {
        issues.push('No examples found in content');
    }

    return issues;
}

function checkImageAppropriateness(content: string, gradeBand: string): string[] {
    const issues: string[] = [];
    const gradeNum = extractGradeNumber(gradeBand);
    const numericGrade = parseInt(gradeNum, 10);

    // Check for Pythagorean theorem image in grades below 8
    if (content.includes('Pythagorean_theorem') && numericGrade < 8) {
        issues.push(`Pythagorean theorem image in Grade ${gradeNum} lesson`);
    }

    // Check for advanced diagrams in lower grades
    if (content.includes('DNA_Double_Helix') && numericGrade < 6) {
        issues.push(`DNA helix image may be too advanced for Grade ${gradeNum}`);
    }

    return issues;
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
                estimated_duration_minutes,
                modules (
                    id,
                    grade_band,
                    subject,
                    strand,
                    topic
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

async function checkPracticeQuestionCoverage(lessonId: number, moduleId: number | null): Promise<string[]> {
    const issues: string[] = [];

    if (!moduleId) {
        issues.push('Lesson not linked to a module');
        return issues;
    }

    // Check for lesson skills
    const { data: skills, error: skillsError } = await supabase
        .from('lesson_skills')
        .select('skill_id')
        .eq('lesson_id', lessonId);

    if (skillsError) {
        console.warn(`Error checking skills for lesson ${lessonId}: ${skillsError.message}`);
        return issues;
    }

    if (!skills || skills.length === 0) {
        issues.push('No skills linked to this lesson');
    } else {
        // Check if those skills have questions
        const skillIds = skills.map(s => s.skill_id).filter(Boolean);

        if (skillIds.length > 0) {
            const { data: questions, error: questionsError } = await supabase
                .from('question_skills')
                .select('question_id')
                .in('skill_id', skillIds)
                .limit(1);

            if (questionsError) {
                console.warn(`Error checking questions for lesson ${lessonId}: ${questionsError.message}`);
            } else if (!questions || questions.length === 0) {
                issues.push('Linked skills have no associated practice questions');
            }
        }
    }

    return issues;
}

async function runAudit(outputPath?: string): Promise<AuditReport> {
    console.log('=== CONTENT QUALITY AUDIT ===\n');

    console.log('Fetching lessons...');
    const lessons = await fetchLessons();
    console.log(`Found ${lessons.length} lessons to audit\n`);

    const issues: QualityIssue[] = [];
    const lessonsNeedingReview = new Set<number>();

    let processed = 0;
    for (const lesson of lessons) {
        const gradeBand = lesson.modules?.grade_band || 'Unknown';
        const subject = lesson.modules?.subject || 'Unknown';
        const moduleId = lesson.modules?.id || null;

        // Check for placeholder vocabulary
        const placeholderIssues = checkPlaceholderVocabulary(lesson.content);
        for (const detail of placeholderIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'placeholder_vocabulary',
                severity: 'high',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        // Check grade appropriateness
        const gradeIssues = checkGradeAppropriateness(lesson.content, gradeBand);
        for (const detail of gradeIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'grade_inappropriate',
                severity: 'critical',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        // Check for template content
        const templateIssues = checkTemplateContent(lesson.content);
        for (const detail of templateIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'template_content',
                severity: 'medium',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        // Check content structure
        const structureIssues = checkContentStructure(lesson.content);
        for (const detail of structureIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'structure_issue',
                severity: 'medium',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        // Check image appropriateness
        const imageIssues = checkImageAppropriateness(lesson.content, gradeBand);
        for (const detail of imageIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'inappropriate_image',
                severity: 'critical',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        // Check practice question coverage (slower - do sampling or all)
        const practiceIssues = await checkPracticeQuestionCoverage(lesson.id, moduleId);
        for (const detail of practiceIssues) {
            issues.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                gradeBand,
                subject,
                issueType: 'missing_practice',
                severity: 'high',
                details: detail
            });
            lessonsNeedingReview.add(lesson.id);
        }

        processed++;
        if (processed % 100 === 0) {
            console.log(`Processed ${processed}/${lessons.length} lessons...`);
        }
    }

    // Aggregate statistics
    const issuesByType: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};
    const issuesBySubject: Record<string, number> = {};
    const issuesByGrade: Record<string, number> = {};

    for (const issue of issues) {
        issuesByType[issue.issueType] = (issuesByType[issue.issueType] || 0) + 1;
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
        issuesBySubject[issue.subject] = (issuesBySubject[issue.subject] || 0) + 1;
        issuesByGrade[issue.gradeBand] = (issuesByGrade[issue.gradeBand] || 0) + 1;
    }

    const report: AuditReport = {
        timestamp: new Date().toISOString(),
        totalLessons: lessons.length,
        issueCount: issues.length,
        issuesByType,
        issuesBySeverity,
        issuesBySubject,
        issuesByGrade,
        issues,
        lessonsNeedingReview: Array.from(lessonsNeedingReview)
    };

    // Print summary
    console.log('\n=== AUDIT SUMMARY ===\n');
    console.log(`Total lessons: ${report.totalLessons}`);
    console.log(`Total issues found: ${report.issueCount}`);
    console.log(`Lessons needing review: ${report.lessonsNeedingReview.length}`);

    console.log('\nIssues by Type:');
    for (const [type, count] of Object.entries(issuesByType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }

    console.log('\nIssues by Severity:');
    for (const severity of ['critical', 'high', 'medium', 'low']) {
        if (issuesBySeverity[severity]) {
            console.log(`  ${severity}: ${issuesBySeverity[severity]}`);
        }
    }

    console.log('\nTop 10 Issues by Subject:');
    const sortedSubjects = Object.entries(issuesBySubject).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [subject, count] of sortedSubjects) {
        console.log(`  ${subject}: ${count}`);
    }

    console.log('\nIssues by Grade:');
    const sortedGrades = Object.entries(issuesByGrade).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [grade, count] of sortedGrades) {
        console.log(`  Grade ${grade}: ${count}`);
    }

    // Save report if output path specified
    if (outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`\n✅ Full report saved to: ${outputPath}`);
    }

    return report;
}

// Main execution
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const outputPath = outputArg
    ? outputArg.split('=')[1]
    : 'data/audits/content_quality_report.json';

runAudit(outputPath).catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
});
