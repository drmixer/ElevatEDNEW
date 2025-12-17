/**
 * Phase 4: Quality Validation
 * 
 * Validates that all enhanced lessons meet quality standards.
 * Checks content length, structure, resources, and flags any issues.
 * 
 * Part of the Lesson Content Enhancement Plan - Phase 4
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

interface ValidationResult {
    id: number;
    title: string;
    subject: string;
    gradeBand: string;
    passed: boolean;
    issues: string[];
    metrics: {
        contentLength: number;
        hasLearningGoals: boolean;
        hasIntroduction: boolean;
        hasKeyConcepts: boolean;
        hasExample: boolean;
        hasPractice: boolean;
        hasVocabulary: boolean;
        hasSummary: boolean;
        hasResources: boolean;
        externalLinkCount: number;
        placeholderTextFound: string[];
    };
}

// Minimum content length by grade band
const MIN_CONTENT_LENGTH: Record<string, number> = {
    'K': 300,
    '1': 300,
    '2': 350,
    '3': 500,
    '4': 500,
    '5': 500,
    '6': 700,
    '7': 700,
    '8': 700,
    '9': 900,
    '10': 900,
    '11': 900,
    '12': 900,
};

// Placeholder patterns that indicate incomplete content
const PLACEHOLDER_PATTERNS = [
    /\[TODO\]/gi,
    /\[INSERT\]/gi,
    /\[TBD\]/gi,
    /\[PLACEHOLDER\]/gi,
    /\[ADD.*?\]/gi,
    /\[FILL.*?\]/gi,
    /XXX/g,
    /FIXME/gi,
    /lorem ipsum/gi,
];

function validateLesson(lesson: LessonRecord): ValidationResult {
    const content = lesson.content || '';
    const module = lesson.modules;
    const gradeBand = module?.grade_band || 'K';
    const issues: string[] = [];

    // Metrics collection
    const contentLength = content.length;
    const hasLearningGoals = /##\s*(Learning\s*Goals?|What\s*You.*?Learn|Objectives?)/i.test(content);
    const hasIntroduction = /##\s*Introduction/i.test(content);
    const hasKeyConcepts = /##\s*(Key\s*Concepts?|Understanding)/i.test(content);
    const hasExample = /\*\*Example|\bExample[:\s]/i.test(content);
    const hasPractice = /##\s*(Let.*?s\s*Practice|Practice)/i.test(content);
    const hasVocabulary = /##\s*(Key\s*)?Vocabulary/i.test(content);
    const hasSummary = /##\s*Summary/i.test(content);
    const hasResources = /##\s*(Additional\s*)?Resources|##\s*Going\s*Further/i.test(content);

    // Count external links
    const externalLinks = content.match(/https?:\/\/[^\s)]+/gi) || [];
    const externalLinkCount = externalLinks.length;

    // Check for placeholder text
    const placeholderTextFound: string[] = [];
    for (const pattern of PLACEHOLDER_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
            placeholderTextFound.push(...matches);
        }
    }

    // Validation checks
    const minLength = MIN_CONTENT_LENGTH[gradeBand] || 500;
    if (contentLength < minLength) {
        issues.push(`Content too short: ${contentLength} chars (minimum: ${minLength})`);
    }

    if (!hasLearningGoals) {
        issues.push('Missing Learning Goals section');
    }

    if (!hasIntroduction) {
        issues.push('Missing Introduction section');
    }

    if (!hasKeyConcepts) {
        issues.push('Missing Key Concepts section');
    }

    if (!hasPractice) {
        issues.push('Missing Practice section');
    }

    if (!hasVocabulary) {
        issues.push('Missing Vocabulary section');
    }

    if (!hasSummary) {
        issues.push('Missing Summary section');
    }

    if (!hasResources && externalLinkCount === 0) {
        issues.push('Missing external resources');
    }

    if (placeholderTextFound.length > 0) {
        issues.push(`Placeholder text found: ${placeholderTextFound.slice(0, 3).join(', ')}`);
    }

    // Check for generic/template content that wasn't replaced
    if (/Walk through one concrete example/i.test(content)) {
        issues.push('Contains teacher guide template text');
    }

    if (/students? (will|should|can) (note|observe|discuss)/i.test(content)) {
        issues.push('Contains teacher-facing language');
    }

    return {
        id: lesson.id,
        title: lesson.title,
        subject: module?.subject || 'Unknown',
        gradeBand,
        passed: issues.length === 0,
        issues,
        metrics: {
            contentLength,
            hasLearningGoals,
            hasIntroduction,
            hasKeyConcepts,
            hasExample,
            hasPractice,
            hasVocabulary,
            hasSummary,
            hasResources,
            externalLinkCount,
            placeholderTextFound,
        }
    };
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

async function main() {
    console.log('=== PHASE 4: QUALITY VALIDATION ===\n');

    const subjectFilter = process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];
    const showPassing = process.argv.includes('--show-passing');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _fixMode = process.argv.includes('--fix');

    console.log('Fetching all lessons...\n');
    let lessons = await fetchLessons();
    console.log(`Found ${lessons.length} total lessons\n`);

    // Apply subject filter
    if (subjectFilter) {
        lessons = lessons.filter(l =>
            l.modules?.subject.toLowerCase().includes(subjectFilter.toLowerCase())
        );
        console.log(`Filtered to ${subjectFilter}: ${lessons.length} lessons\n`);
    }

    // Validate all lessons
    const results: ValidationResult[] = [];
    for (const lesson of lessons) {
        results.push(validateLesson(lesson));
    }

    // Separate passing and failing
    const passing = results.filter(r => r.passed);
    const failing = results.filter(r => !r.passed);

    // Summary statistics
    console.log('📊 VALIDATION SUMMARY\n');
    console.log(`Total lessons: ${results.length}`);
    console.log(`Passing: ${passing.length} (${((passing.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`Issues found: ${failing.length} (${((failing.length / results.length) * 100).toFixed(1)}%)`);

    // Structure metrics
    console.log('\n📋 STRUCTURE COMPLIANCE\n');
    const structureChecks = {
        'Learning Goals': results.filter(r => r.metrics.hasLearningGoals).length,
        'Introduction': results.filter(r => r.metrics.hasIntroduction).length,
        'Key Concepts': results.filter(r => r.metrics.hasKeyConcepts).length,
        'Practice': results.filter(r => r.metrics.hasPractice).length,
        'Vocabulary': results.filter(r => r.metrics.hasVocabulary).length,
        'Summary': results.filter(r => r.metrics.hasSummary).length,
        'Resources': results.filter(r => r.metrics.hasResources || r.metrics.externalLinkCount > 0).length,
    };

    for (const [check, count] of Object.entries(structureChecks)) {
        const pct = ((count / results.length) * 100).toFixed(1);
        const status = parseFloat(pct) >= 90 ? '✅' : parseFloat(pct) >= 70 ? '⚠️' : '❌';
        console.log(`  ${status} ${check}: ${count}/${results.length} (${pct}%)`);
    }

    // Content length statistics
    console.log('\n📏 CONTENT LENGTH STATISTICS\n');
    const contentLengths = results.map(r => r.metrics.contentLength);
    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
    const minLength = Math.min(...contentLengths);
    const maxLength = Math.max(...contentLengths);
    console.log(`  Average: ${Math.round(avgLength)} chars`);
    console.log(`  Min: ${minLength} chars`);
    console.log(`  Max: ${maxLength} chars`);

    // Issues by type
    console.log('\n🚨 ISSUES BY TYPE\n');
    const issueTypes: Record<string, number> = {};
    for (const result of failing) {
        for (const issue of result.issues) {
            const issueType = issue.split(':')[0].trim();
            issueTypes[issueType] = (issueTypes[issueType] || 0) + 1;
        }
    }

    const sortedIssues = Object.entries(issueTypes).sort((a, b) => b[1] - a[1]);
    for (const [issue, count] of sortedIssues) {
        console.log(`  ${issue}: ${count}`);
    }

    // Issues by subject
    console.log('\n📚 ISSUES BY SUBJECT\n');
    const issuesBySubject: Record<string, number> = {};
    for (const result of failing) {
        issuesBySubject[result.subject] = (issuesBySubject[result.subject] || 0) + 1;
    }

    for (const [subject, count] of Object.entries(issuesBySubject).sort((a, b) => b[1] - a[1])) {
        const total = results.filter(r => r.subject === subject).length;
        console.log(`  ${subject}: ${count}/${total} lessons with issues`);
    }

    // Sample failing lessons
    console.log('\n❌ SAMPLE FAILING LESSONS (first 10)\n');
    for (const result of failing.slice(0, 10)) {
        console.log(`ID ${result.id} | Grade ${result.gradeBand} | ${result.subject}`);
        console.log(`  Title: ${result.title.substring(0, 50)}...`);
        console.log(`  Issues: ${result.issues.join('; ')}`);
        console.log(`  Length: ${result.metrics.contentLength} chars`);
        console.log('');
    }

    // Show passing if requested
    if (showPassing) {
        console.log('\n✅ SAMPLE PASSING LESSONS (first 10)\n');
        for (const result of passing.slice(0, 10)) {
            console.log(`ID ${result.id} | Grade ${result.gradeBand} | ${result.subject}`);
            console.log(`  Title: ${result.title.substring(0, 50)}...`);
            console.log(`  Length: ${result.metrics.contentLength} chars | Links: ${result.metrics.externalLinkCount}`);
            console.log('');
        }
    }

    // Generate quality report summary
    console.log('\n' + '='.repeat(60));
    console.log('QUALITY REPORT SUMMARY');
    console.log('='.repeat(60) + '\n');

    const overallScore = ((passing.length / results.length) * 100).toFixed(1);
    console.log(`Overall Pass Rate: ${overallScore}%`);
    console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
    console.log(`Lessons Evaluated: ${results.length}`);
    console.log('');

    // Recommendations
    console.log('📝 RECOMMENDATIONS\n');

    if (issueTypes['Missing Learning Goals section']) {
        console.log('1. Run add_learning_goals.ts to fix missing Learning Goals');
    }

    if (issueTypes['Missing Introduction section'] || issueTypes['Missing Key Concepts section']) {
        console.log('2. Review lessons with missing structure - may need content regeneration');
    }

    if (issueTypes['Content too short']) {
        console.log('3. Several lessons have content below recommended length - consider enhancing');
    }

    if (issueTypes['Contains teacher guide template text'] || issueTypes['Contains teacher-facing language']) {
        console.log('4. Some lessons still have teacher-facing text - need content transformation');
    }

    console.log('\n✅ Validation complete!');

    // Return exit code based on pass rate
    if (parseFloat(overallScore) >= 80) {
        console.log('\n🎉 Quality threshold met (80%+ pass rate)');
        process.exit(0);
    } else {
        console.log('\n⚠️ Quality threshold not met (below 80% pass rate)');
        process.exit(1);
    }
}

main().catch(console.error);
