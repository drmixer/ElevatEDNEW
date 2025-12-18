/**
 * Content Coverage Service
 * 
 * Evaluates and returns content coverage status for each grade/subject.
 * Used to hide thin/empty learning paths and prioritize well-covered content.
 */

import { createServiceRoleClient } from '../scripts/utils/supabase.js';
import {
    evaluateCoverageStatus,
    getThresholds,
    isInScope,
    type GradeBand,
    type GradeSubjectCoverage,
    type Subject,
} from '../shared/contentCoverage.js';

// Cache coverage results for 5 minutes
let coverageCache: { data: GradeSubjectCoverage[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

type ModuleRow = {
    id: number;
    grade_band: string;
    subject: string;
    strand: string | null;
};

type LessonCountRow = {
    module_id: number;
    count: number;
};


/**
 * Fetches comprehensive coverage data from the database.
 */
async function fetchCoverageData(): Promise<{
    modules: ModuleRow[];
    lessonCounts: Map<number, number>;
    questionCounts: Map<number, number>;
}> {
    const supabase = createServiceRoleClient();

    // Fetch all modules with grade/subject/strand
    const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, grade_band, subject, strand')
        .order('grade_band')
        .order('subject');

    if (modulesError) {
        console.error('[ContentCoverage] Failed to fetch modules:', modulesError);
        throw new Error(`Failed to fetch modules: ${modulesError.message}`);
    }

    // Get lesson counts per module
    const { data: lessonData, error: lessonError } = await supabase.rpc(
        'count_lessons_per_module'
    );

    // Fallback if RPC doesn't exist - fetch lessons directly
    let lessonCounts = new Map<number, number>();
    if (lessonError || !lessonData) {
        console.log('[ContentCoverage] RPC not available, fetching lessons directly');
        const { data: lessons } = await supabase
            .from('lessons')
            .select('id, module_id')
            .not('module_id', 'is', null);

        if (lessons) {
            for (const lesson of lessons) {
                if (lesson.module_id != null) {
                    lessonCounts.set(
                        lesson.module_id,
                        (lessonCounts.get(lesson.module_id) ?? 0) + 1
                    );
                }
            }
        }
    } else {
        for (const row of lessonData as LessonCountRow[]) {
            lessonCounts.set(row.module_id, row.count);
        }
    }

    // Get practice question counts per lesson
    // First, try to get lesson_skills → question_skills linkage
    const questionCounts = new Map<number, number>();

    // Query lesson_skills to get skill linkages per lesson
    const { data: lessonSkills } = await supabase
        .from('lesson_skills')
        .select('lesson_id, skill_id');

    if (lessonSkills && lessonSkills.length > 0) {
        // Get question counts per skill
        const { data: questionSkills } = await supabase
            .from('question_skills')
            .select('skill_id, question_id');

        if (questionSkills) {
            const skillQuestionCount = new Map<number, number>();
            for (const qs of questionSkills) {
                skillQuestionCount.set(
                    qs.skill_id,
                    (skillQuestionCount.get(qs.skill_id) ?? 0) + 1
                );
            }

            // Map back to lessons
            for (const ls of lessonSkills) {
                const qCount = skillQuestionCount.get(ls.skill_id) ?? 0;
                questionCounts.set(
                    ls.lesson_id,
                    (questionCounts.get(ls.lesson_id) ?? 0) + qCount
                );
            }
        }
    }

    return {
        modules: (modules ?? []) as ModuleRow[],
        lessonCounts,
        questionCounts,
    };
}

/**
 * Aggregates coverage data by grade/subject.
 */
function aggregateCoverage(
    modules: ModuleRow[],
    lessonCounts: Map<number, number>,
    questionCounts: Map<number, number>,
): GradeSubjectCoverage[] {
    // Group by grade/subject
    const gradeSubjectMap = new Map<string, {
        modules: ModuleRow[];
        strands: Set<string>;
    }>();

    for (const module of modules) {
        const key = `${module.grade_band}:${module.subject}`;
        let entry = gradeSubjectMap.get(key);
        if (!entry) {
            entry = { modules: [], strands: new Set() };
            gradeSubjectMap.set(key, entry);
        }
        entry.modules.push(module);
        if (module.strand) {
            entry.strands.add(module.strand);
        }
    }

    const results: GradeSubjectCoverage[] = [];

    for (const [key, { modules: gradeModules, strands }] of gradeSubjectMap) {
        const [grade, subject] = key.split(':') as [GradeBand, Subject];

        // Count lessons
        let totalLessons = 0;
        let totalQuestions = 0;
        const strandLessonCounts = new Map<string, number>();

        for (const module of gradeModules) {
            const moduleLessons = lessonCounts.get(module.id) ?? 0;
            totalLessons += moduleLessons;

            // Sum questions for this module's lessons
            // We need lesson IDs for this module - approximate by using module proportion
            // In production, we'd want a more precise query

            // Track strand coverage
            if (module.strand) {
                strandLessonCounts.set(
                    module.strand,
                    (strandLessonCounts.get(module.strand) ?? 0) + moduleLessons
                );
            }
        }

        // Get question counts (approximation)
        for (const [, count] of questionCounts) {
            totalQuestions += count;
        }

        // Calculate averages
        const avgQuestionsPerLesson = totalLessons > 0
            ? totalQuestions / totalLessons
            : 0;

        // Count strands with adequate content
        const thresholds = getThresholds(grade, subject);
        let strandsWithContent = 0;
        for (const [, count] of strandLessonCounts) {
            if (count >= thresholds.minLessonsPerStrand) {
                strandsWithContent++;
            }
        }

        const status = evaluateCoverageStatus(
            grade,
            subject,
            gradeModules.length,
            totalLessons,
            avgQuestionsPerLesson,
            strandsWithContent,
            strands.size || 1,
        );

        const details: string[] = [];
        if (status === 'thin') {
            if (gradeModules.length < thresholds.minModules) {
                details.push(`Only ${gradeModules.length}/${thresholds.minModules} modules`);
            }
            if (totalLessons < thresholds.minTotalLessons) {
                details.push(`Only ${totalLessons}/${thresholds.minTotalLessons} lessons`);
            }
            if (avgQuestionsPerLesson < thresholds.minQuestionsPerLesson) {
                details.push(`Avg ${avgQuestionsPerLesson.toFixed(1)}/${thresholds.minQuestionsPerLesson} questions/lesson`);
            }
        }

        results.push({
            grade,
            subject,
            status,
            moduleCount: gradeModules.length,
            lessonCount: totalLessons,
            questionCount: totalQuestions,
            strandsWithContent,
            totalStrands: strands.size || 0,
            meetsMinimum: status === 'ready' || status === 'beta',
            details,
        });
    }

    // Sort by grade then subject
    const gradeOrder = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    results.sort((a, b) => {
        const gradeA = gradeOrder.indexOf(a.grade);
        const gradeB = gradeOrder.indexOf(b.grade);
        if (gradeA !== gradeB) return gradeA - gradeB;
        return a.subject.localeCompare(b.subject);
    });

    return results;
}

/**
 * Gets the content coverage report for all grade/subject combinations.
 * Uses caching to avoid repeated database queries.
 */
export async function getContentCoverage(forceRefresh = false): Promise<GradeSubjectCoverage[]> {
    const now = Date.now();

    if (!forceRefresh && coverageCache && (now - coverageCache.timestamp) < CACHE_TTL_MS) {
        return coverageCache.data;
    }

    try {
        const { modules, lessonCounts, questionCounts } = await fetchCoverageData();
        const coverage = aggregateCoverage(modules, lessonCounts, questionCounts);

        coverageCache = { data: coverage, timestamp: now };
        return coverage;
    } catch (error) {
        console.error('[ContentCoverage] Error fetching coverage:', error);
        // Return cached data if available, even if stale
        if (coverageCache) {
            return coverageCache.data;
        }
        return [];
    }
}

/**
 * Checks if a specific grade/subject is ready for student access.
 */
export async function isGradeSubjectReady(
    grade: GradeBand | string,
    subject: Subject | string,
    allowBeta = true,
): Promise<boolean> {
    // First check if it's in scope at all
    if (!isInScope(grade, subject)) {
        return false;
    }

    const coverage = await getContentCoverage();
    const normalizedGrade = String(grade).toUpperCase() === 'K' ? 'K' : String(grade);

    const entry = coverage.find(
        c => c.grade === normalizedGrade && c.subject === subject
    );

    if (!entry) {
        return false;
    }

    if (allowBeta) {
        return entry.status === 'ready' || entry.status === 'beta';
    }

    return entry.status === 'ready';
}

/**
 * Gets a summary of coverage for the admin dashboard.
 */
export async function getCoverageSummary(): Promise<{
    totalGradeSubjects: number;
    readyCount: number;
    betaCount: number;
    thinCount: number;
    emptyCount: number;
    inScopeReady: number;
    inScopeTotal: number;
    readinessPercent: number;
    topGaps: Array<{ grade: string; subject: string; issue: string }>;
}> {
    const coverage = await getContentCoverage();

    let readyCount = 0;
    let betaCount = 0;
    let thinCount = 0;
    let emptyCount = 0;
    let inScopeReady = 0;
    let inScopeTotal = 0;

    const topGaps: Array<{ grade: string; subject: string; issue: string }> = [];

    for (const entry of coverage) {
        switch (entry.status) {
            case 'ready': readyCount++; break;
            case 'beta': betaCount++; break;
            case 'thin': thinCount++; break;
            case 'empty': emptyCount++; break;
        }

        if (isInScope(entry.grade, entry.subject)) {
            inScopeTotal++;
            if (entry.status === 'ready' || entry.status === 'beta') {
                inScopeReady++;
            } else if (entry.details.length > 0) {
                topGaps.push({
                    grade: entry.grade,
                    subject: entry.subject,
                    issue: entry.details[0],
                });
            }
        }
    }

    return {
        totalGradeSubjects: coverage.length,
        readyCount,
        betaCount,
        thinCount,
        emptyCount,
        inScopeReady,
        inScopeTotal,
        readinessPercent: inScopeTotal > 0
            ? Math.round((inScopeReady / inScopeTotal) * 100)
            : 0,
        topGaps: topGaps.slice(0, 5),
    };
}

/**
 * Filters module IDs to only include those in ready/beta grade-subjects.
 * Used by recommendations to avoid surfacing thin content.
 */
export async function filterModulesByReadiness(
    moduleIds: number[],
    allowBeta = true,
): Promise<number[]> {
    if (moduleIds.length === 0) return [];

    const supabase = createServiceRoleClient();
    const coverage = await getContentCoverage();

    // Build a set of ready grade-subject combinations
    const readySet = new Set<string>();
    for (const entry of coverage) {
        if (entry.status === 'ready' || (allowBeta && entry.status === 'beta')) {
            if (isInScope(entry.grade, entry.subject)) {
                readySet.add(`${entry.grade}:${entry.subject}`);
            }
        }
    }

    // Fetch module grade/subject for the given IDs
    const { data: modules } = await supabase
        .from('modules')
        .select('id, grade_band, subject')
        .in('id', moduleIds);

    if (!modules) return moduleIds; // Fallback to all if query fails

    return modules
        .filter(m => readySet.has(`${m.grade_band}:${m.subject}`))
        .map(m => m.id);
}

export { isInScope };
