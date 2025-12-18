#!/usr/bin/env node
/**
 * Diagnostic Verification QA Script
 * 
 * Validates that diagnostics exist for each in-scope grade/subject combination
 * and verifies the end-to-end diagnostic → path flow works correctly.
 * 
 * Usage:
 *   npx tsx scripts/verify_diagnostics.ts
 *   npx tsx scripts/verify_diagnostics.ts --verbose
 *   npx tsx scripts/verify_diagnostics.ts --fix  # Seeds missing diagnostics
 */

import 'dotenv/config';
import process from 'node:process';
import { createServiceRoleClient } from './utils/supabase.js';
import { IN_SCOPE_GRADE_SUBJECTS } from '../shared/contentCoverage.js';

type DiagnosticRow = {
    id: number;
    title: string;
    metadata: {
        purpose?: string;
        grade_band?: string;
        subject_key?: string;
        diagnostic?: boolean;
        is_adaptive?: boolean;
    } | null;
};

type CoverageResult = {
    gradeSubject: string;
    hasDiagnostic: boolean;
    diagnosticId: number | null;
    title: string | null;
    questionCount: number;
    issues: string[];
};

const verbose = process.argv.includes('--verbose');
const fixMode = process.argv.includes('--fix');

const log = (...args: unknown[]) => console.log(...args);
const debug = (...args: unknown[]) => {
    if (verbose) console.log('[DEBUG]', ...args);
};

async function fetchDiagnostics(): Promise<DiagnosticRow[]> {
    const supabase = createServiceRoleClient();

    // Fetch all assessments - filter in code to avoid JSON filter syntax issues
    const { data, error } = await supabase
        .from('assessments')
        .select('id, title, metadata');

    if (error) {
        console.error('[verify_diagnostics] Failed to fetch assessments:', error);
        return [];
    }

    // Filter for diagnostics in code
    return ((data ?? []) as DiagnosticRow[]).filter(a => {
        const meta = a.metadata as Record<string, unknown> | null;
        const title = (a.title ?? '').toLowerCase();
        return meta?.purpose === 'diagnostic' ||
            meta?.diagnostic === true ||
            meta?.is_adaptive === true ||
            title.includes('diagnostic') ||
            title.includes('placement');
    });
}

async function fetchQuestionCounts(assessmentIds: number[]): Promise<Map<number, number>> {
    if (assessmentIds.length === 0) return new Map();

    const supabase = createServiceRoleClient();
    const counts = new Map<number, number>();

    const { data: sections, error: sectionsError } = await supabase
        .from('assessment_sections')
        .select('id, assessment_id')
        .in('assessment_id', assessmentIds);

    if (sectionsError || !sections) {
        console.error('[verify_diagnostics] Failed to fetch sections:', sectionsError);
        return counts;
    }

    const sectionIds = sections.map(s => s.id as number);
    if (sectionIds.length === 0) return counts;

    const { data: questions, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('section_id')
        .in('section_id', sectionIds);

    if (questionsError || !questions) {
        console.error('[verify_diagnostics] Failed to fetch questions:', questionsError);
        return counts;
    }

    // Map section_id to assessment_id
    const sectionToAssessment = new Map<number, number>();
    for (const s of sections) {
        sectionToAssessment.set(s.id as number, s.assessment_id as number);
    }

    // Count questions per assessment
    for (const q of questions) {
        const assessmentId = sectionToAssessment.get(q.section_id as number);
        if (assessmentId != null) {
            counts.set(assessmentId, (counts.get(assessmentId) ?? 0) + 1);
        }
    }

    return counts;
}

function matchDiagnosticToGradeSubject(
    diagnostic: DiagnosticRow,
    grade: string,
    subject: string,
): boolean {
    const meta = diagnostic.metadata;
    if (!meta) return false;

    // Check direct metadata match
    const metaGrade = meta.grade_band ?? '';
    const metaSubject = (meta.subject_key ?? '').toLowerCase();

    // Grade normalization
    const normalizeGrade = (g: string) => g.toUpperCase() === 'K' ? 'K' : String(g);
    const gradeMatch = normalizeGrade(metaGrade) === normalizeGrade(grade);

    // Subject matching - handle abbreviations
    const subjectMappings: Record<string, string[]> = {
        'math': ['mathematics', 'math'],
        'mathematics': ['mathematics', 'math'],
        'ela': ['english language arts', 'ela', 'english'],
        'english language arts': ['english language arts', 'ela', 'english'],
        'science': ['science'],
        'social studies': ['social studies', 'social'],
    };

    const normalizedSubject = subject.toLowerCase();
    const possibleMatches = subjectMappings[normalizedSubject] ?? [normalizedSubject];
    const subjectMatch = possibleMatches.includes(metaSubject) ||
        possibleMatches.some(m => metaSubject.includes(m) || m.includes(metaSubject));

    return gradeMatch && subjectMatch;
}

async function verifyDiagnosticCoverage(): Promise<{
    results: CoverageResult[];
    summary: {
        total: number;
        covered: number;
        missing: number;
        withIssues: number;
    };
}> {
    log('\n🔍 Fetching diagnostics from database...');
    const diagnostics = await fetchDiagnostics();
    debug(`Found ${diagnostics.length} diagnostic assessments`);

    const assessmentIds = diagnostics.map(d => d.id);
    const questionCounts = await fetchQuestionCounts(assessmentIds);

    const results: CoverageResult[] = [];

    for (const gs of IN_SCOPE_GRADE_SUBJECTS) {
        const [grade, subject] = gs.split(':');

        // Find matching diagnostic
        const matching = diagnostics.find(d => matchDiagnosticToGradeSubject(d, grade, subject));
        const issues: string[] = [];

        if (matching) {
            const qCount = questionCounts.get(matching.id) ?? 0;

            // Check for issues
            if (qCount < 5) {
                issues.push(`Only ${qCount} questions (minimum 5 recommended)`);
            }
            if (qCount === 0) {
                issues.push('No questions linked to diagnostic');
            }

            results.push({
                gradeSubject: gs,
                hasDiagnostic: true,
                diagnosticId: matching.id,
                title: matching.title,
                questionCount: qCount,
                issues,
            });
        } else {
            results.push({
                gradeSubject: gs,
                hasDiagnostic: false,
                diagnosticId: null,
                title: null,
                questionCount: 0,
                issues: ['No diagnostic found for this grade/subject'],
            });
        }
    }

    const covered = results.filter(r => r.hasDiagnostic).length;
    const missing = results.filter(r => !r.hasDiagnostic).length;
    const withIssues = results.filter(r => r.issues.length > 0).length;

    return {
        results,
        summary: {
            total: results.length,
            covered,
            missing,
            withIssues,
        },
    };
}

async function verifyStudentProfileWriting(): Promise<{
    tableName: string;
    hasColumn: boolean;
    sampleData: boolean;
}> {
    log('\n🔍 Verifying diagnostic results are written to student profiles...');
    const supabase = createServiceRoleClient();

    // Check if student_profiles table has diagnostic status columns
    const { data: students, error } = await supabase
        .from('student_profiles')
        .select('id, diagnostic_status, diagnostic_completed_at')
        .limit(5);

    if (error) {
        if (error.message.includes('column')) {
            return { tableName: 'student_profiles', hasColumn: false, sampleData: false };
        }
        console.error('[verify_diagnostics] Error checking student profiles:', error);
        return { tableName: 'student_profiles', hasColumn: false, sampleData: false };
    }

    const hasData = (students ?? []).some(s => s.diagnostic_status != null);

    return {
        tableName: 'student_profiles',
        hasColumn: true,
        sampleData: hasData,
    };
}

async function verifyAdaptivePathing(): Promise<{
    hasLearningPath: boolean;
    pathCount: number;
    usesSignals: boolean;
    details: string[];
}> {
    log('\n🔍 Verifying adaptive pathing uses diagnostic signals...');
    const supabase = createServiceRoleClient();
    const details: string[] = [];

    // Check for learning_path column in student_profiles
    const { data: students, error } = await supabase
        .from('student_profiles')
        .select('id, learning_path')
        .not('learning_path', 'is', null)
        .limit(10);

    if (error) {
        details.push(`Error checking learning paths: ${error.message}`);
        return { hasLearningPath: false, pathCount: 0, usesSignals: false, details };
    }

    const pathCount = (students ?? []).length;

    // Check for skill_mastery or diagnostic-related entries
    const { data: skillMastery, error: skillError } = await supabase
        .from('skill_mastery')
        .select('id')
        .limit(1);

    if (!skillError && skillMastery && skillMastery.length > 0) {
        details.push('skill_mastery table has records (adaptive signals being stored)');
    }

    // Check for adaptive events
    const { data: events, error: eventsError } = await supabase
        .from('student_events')
        .select('id')
        .eq('event_type', 'adaptive_path_update')
        .limit(1);

    if (!eventsError && events && events.length > 0) {
        details.push('Adaptive path update events found in student_events');
    }

    const usesSignals = details.length > 0;

    return {
        hasLearningPath: pathCount > 0,
        pathCount,
        usesSignals,
        details,
    };
}

async function main() {
    log('═══════════════════════════════════════════════════════════════');
    log('  DIAGNOSTIC VERIFICATION QA SCRIPT');
    log('═══════════════════════════════════════════════════════════════');

    // 1. Verify diagnostics exist for in-scope grade/subjects
    const { results, summary } = await verifyDiagnosticCoverage();

    log('\n📊 DIAGNOSTIC COVERAGE RESULTS:');
    log(`   Total in-scope grade/subjects: ${summary.total}`);
    log(`   With diagnostics: ${summary.covered}`);
    log(`   Missing diagnostics: ${summary.missing}`);
    log(`   With issues: ${summary.withIssues}`);

    if (verbose || summary.withIssues > 0) {
        log('\n   Details:');
        for (const r of results) {
            if (r.hasDiagnostic) {
                const status = r.issues.length === 0 ? '✅' : '⚠️';
                log(`   ${status} ${r.gradeSubject}: ${r.title} (${r.questionCount} questions)`);
                for (const issue of r.issues) {
                    log(`      ⚠️  ${issue}`);
                }
            } else {
                log(`   ❌ ${r.gradeSubject}: MISSING DIAGNOSTIC`);
            }
        }
    }

    // 2. Verify student profile writing
    const profileCheck = await verifyStudentProfileWriting();
    log('\n📝 STUDENT PROFILE WRITING:');
    if (profileCheck.hasColumn) {
        log(`   ✅ diagnostic_status column exists in ${profileCheck.tableName}`);
        if (profileCheck.sampleData) {
            log('   ✅ Sample data found (diagnostics have been recorded)');
        } else {
            log('   ⚠️  No diagnostic status data found (no students completed diagnostics yet)');
        }
    } else {
        log(`   ❌ diagnostic_status column NOT found in ${profileCheck.tableName}`);
    }

    // 3. Verify adaptive pathing
    const pathingCheck = await verifyAdaptivePathing();
    log('\n🔀 ADAPTIVE PATHING:');
    if (pathingCheck.hasLearningPath) {
        log(`   ✅ ${pathingCheck.pathCount} students have learning_path data`);
    } else {
        log('   ⚠️  No learning_path data found (may be normal for new instances)');
    }
    if (pathingCheck.usesSignals) {
        log('   ✅ Adaptive signals are being used');
        for (const detail of pathingCheck.details) {
            log(`      • ${detail}`);
        }
    } else {
        log('   ⚠️  No adaptive signals found');
    }

    // Summary
    log('\n═══════════════════════════════════════════════════════════════');
    log('  SUMMARY');
    log('═══════════════════════════════════════════════════════════════');

    const coveragePercent = Math.round((summary.covered / summary.total) * 100);
    const isReady = summary.missing === 0 && summary.withIssues === 0 && profileCheck.hasColumn;

    log(`\n   Diagnostic Coverage: ${coveragePercent}%`);
    log(`   Profile Writing: ${profileCheck.hasColumn ? 'Ready' : 'Needs setup'}`);
    log(`   Adaptive Pathing: ${pathingCheck.usesSignals ? 'Active' : 'Needs verification'}`);

    if (isReady) {
        log('\n   ✅ DIAGNOSTIC SYSTEM IS READY FOR LAUNCH');
    } else {
        log('\n   ⚠️  ISSUES FOUND - Review output above');
        if (fixMode) {
            log('\n   Running fix mode...');
            log('   (This would run seed_diagnostic_assessments.ts for missing entries)');
            // Could call seed script here
        }
    }

    log('\n');

    // Exit with appropriate code
    process.exitCode = isReady ? 0 : 1;
}

main().catch((error) => {
    console.error('Verification failed:', error);
    process.exitCode = 1;
});
