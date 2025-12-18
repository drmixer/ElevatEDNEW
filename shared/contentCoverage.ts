/**
 * Content Coverage Configuration
 * 
 * Defines minimum viable coverage thresholds for each grade/subject combination.
 * Modules below these thresholds will be hidden or down-ranked in recommendations.
 */

export type GradeBand = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
export type Subject = 'Mathematics' | 'English Language Arts' | 'Science' | 'Social Studies';

export type CoverageThresholds = {
    /** Minimum number of lessons required per strand/topic */
    minLessonsPerStrand: number;
    /** Minimum number of practice questions per lesson */
    minQuestionsPerLesson: number;
    /** Minimum total lessons for the grade/subject to be considered "ready" */
    minTotalLessons: number;
    /** Minimum modules required for a grade/subject to be shown */
    minModules: number;
};

export type CoverageStatus =
    | 'ready'      // Meets all thresholds
    | 'beta'       // Meets minimum but below ideal
    | 'thin'       // Below minimum, should be hidden from new users
    | 'empty';     // No content, must be hidden

export type GradeSubjectCoverage = {
    grade: GradeBand;
    subject: Subject;
    status: CoverageStatus;
    moduleCount: number;
    lessonCount: number;
    questionCount: number;
    strandsWithContent: number;
    totalStrands: number;
    meetsMinimum: boolean;
    details: string[];
};

// Default thresholds - can be overridden per grade/subject
const DEFAULT_THRESHOLDS: CoverageThresholds = {
    minLessonsPerStrand: 3,
    minQuestionsPerLesson: 4,
    minTotalLessons: 20,
    minModules: 5,
};

// Beta thresholds - lower bar for showing content in beta mode
const BETA_THRESHOLDS: CoverageThresholds = {
    minLessonsPerStrand: 1,
    minQuestionsPerLesson: 2,
    minTotalLessons: 8,
    minModules: 2,
};

// Grade/Subject specific overrides (keyed by "grade:subject")
export const COVERAGE_OVERRIDES: Map<string, Partial<CoverageThresholds>> = new Map([
    // K-2 typically have simpler content, lower thresholds
    ['K:Mathematics', { minTotalLessons: 15, minLessonsPerStrand: 2 }],
    ['1:Mathematics', { minTotalLessons: 15, minLessonsPerStrand: 2 }],
    ['2:Mathematics', { minTotalLessons: 15, minLessonsPerStrand: 2 }],
    ['K:English Language Arts', { minTotalLessons: 12, minLessonsPerStrand: 2 }],
    ['1:English Language Arts', { minTotalLessons: 12, minLessonsPerStrand: 2 }],
    ['2:English Language Arts', { minTotalLessons: 12, minLessonsPerStrand: 2 }],

    // High school subjects may have fewer but deeper modules
    ['9:Science', { minModules: 3, minTotalLessons: 15 }],
    ['10:Science', { minModules: 3, minTotalLessons: 15 }],
    ['11:Science', { minModules: 3, minTotalLessons: 15 }],
    ['12:Science', { minModules: 3, minTotalLessons: 15 }],
]);

/**
 * Indicates which grade/subject combinations are officially "in scope" for launch.
 * Content outside this scope won't be surfaced to new users even if it exists.
 */
export const IN_SCOPE_GRADE_SUBJECTS: Set<string> = new Set([
    // Core launch grades (3-8) for Math and ELA
    '3:Mathematics', '4:Mathematics', '5:Mathematics', '6:Mathematics', '7:Mathematics', '8:Mathematics',
    '3:English Language Arts', '4:English Language Arts', '5:English Language Arts',
    '6:English Language Arts', '7:English Language Arts', '8:English Language Arts',

    // Expand as content becomes ready
    'K:Mathematics', '1:Mathematics', '2:Mathematics',
    'K:English Language Arts', '1:English Language Arts', '2:English Language Arts',

    // Science - middle school focus initially
    '6:Science', '7:Science', '8:Science',
]);

/**
 * Get the effective thresholds for a grade/subject combination.
 */
export function getThresholds(grade: GradeBand, subject: Subject): CoverageThresholds {
    const key = `${grade}:${subject}`;
    const overrides = COVERAGE_OVERRIDES.get(key);
    return {
        ...DEFAULT_THRESHOLDS,
        ...overrides,
    };
}

/**
 * Get the beta (soft launch) thresholds for a grade/subject combination.
 */
export function getBetaThresholds(grade: GradeBand, subject: Subject): CoverageThresholds {
    // Scale beta thresholds proportionally based on the grade's defaults
    const defaults = getThresholds(grade, subject);
    return {
        minLessonsPerStrand: Math.min(
            BETA_THRESHOLDS.minLessonsPerStrand,
            Math.ceil(defaults.minLessonsPerStrand * 0.5)
        ),
        minQuestionsPerLesson: Math.min(
            BETA_THRESHOLDS.minQuestionsPerLesson,
            Math.ceil(defaults.minQuestionsPerLesson * 0.5)
        ),
        minTotalLessons: Math.min(
            BETA_THRESHOLDS.minTotalLessons,
            Math.ceil(defaults.minTotalLessons * 0.4)
        ),
        minModules: Math.min(
            BETA_THRESHOLDS.minModules,
            Math.ceil(defaults.minModules * 0.5)
        ),
    };
}

/**
 * Check if a grade/subject combination is in scope for the current launch.
 */
export function isInScope(grade: GradeBand | string, subject: Subject | string): boolean {
    const normalizedGrade = String(grade).toUpperCase() === 'K' ? 'K' : String(grade);
    const key = `${normalizedGrade}:${subject}`;
    return IN_SCOPE_GRADE_SUBJECTS.has(key);
}

/**
 * Evaluate the coverage status based on counts.
 */
export function evaluateCoverageStatus(
    grade: GradeBand,
    subject: Subject,
    moduleCount: number,
    lessonCount: number,
    avgQuestionsPerLesson: number,
    strandsWithContent: number,
    totalStrands: number,
): CoverageStatus {
    if (moduleCount === 0 || lessonCount === 0) {
        return 'empty';
    }

    const thresholds = getThresholds(grade, subject);
    const betaThresholds = getBetaThresholds(grade, subject);

    // Check full readiness
    const meetsModules = moduleCount >= thresholds.minModules;
    const meetsLessons = lessonCount >= thresholds.minTotalLessons;
    const meetsQuestions = avgQuestionsPerLesson >= thresholds.minQuestionsPerLesson;
    const meetsStrands = strandsWithContent >= Math.ceil(totalStrands * 0.7); // At least 70% strand coverage

    if (meetsModules && meetsLessons && meetsQuestions && meetsStrands) {
        return 'ready';
    }

    // Check beta readiness
    const meetsBetaModules = moduleCount >= betaThresholds.minModules;
    const meetsBetaLessons = lessonCount >= betaThresholds.minTotalLessons;
    const meetsBetaQuestions = avgQuestionsPerLesson >= betaThresholds.minQuestionsPerLesson;

    if (meetsBetaModules && meetsBetaLessons && meetsBetaQuestions) {
        return 'beta';
    }

    return 'thin';
}

// Modules with these flags in the database should be hidden
export const EXPERIMENTAL_FLAGS = ['experimental', 'draft', 'internal', 'test'];

// Quality score thresholds for ranking
export const QUALITY_SCORE_THRESHOLDS = {
    HIDE: 0.3,      // Below this, hide from recommendations
    DOWNRANK: 0.6,  // Below this, show but rank lower
    NORMAL: 0.8,    // Show normally
    BOOST: 0.95,    // Above this, boost in recommendations
};
