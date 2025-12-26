/**
 * Content Quality Service
 * 
 * Fetches content quality metrics for the admin dashboard
 */

import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

export interface LessonReference {
    id: number;
    title: string;
}

export interface SubjectGradeQuality {
    subject: string;
    grade: string;
    qualityScore: number;
    lessonCount: number;
    questionCount: number;
    practiceQuestionCoverage: number;
    structureCompliance: number;
    vocabularyQuality: number;
    gradeAppropriateness: number;
    issuesCount: number;
    lessonsNeedingReview: LessonReference[];
}

export interface QualityTrendPoint {
    date: string;
    averageScore: number;
    issueCount: number;
}

export interface IssueTypeCount {
    type: string;
    count: number;
}

export interface ContentQualityMetrics {
    overallScore: number;
    totalLessons: number;
    totalQuestions: number;
    practiceQuestionCoverage: number;
    lessonsNeedingReview: number;
    lastUpdated: string;
    qualityTrend: QualityTrendPoint[];
    issuesByType: IssueTypeCount[];
    bySubjectGrade: SubjectGradeQuality[];
}

/**
 * Fetch comprehensive content quality metrics
 */
export const fetchContentQualityMetrics = async (): Promise<ContentQualityMetrics> => {
    const response = await authenticatedFetch('/api/v1/admins/content-quality');
    return handleApiResponse<ContentQualityMetrics>(response);
};

/**
 * Trigger a content quality audit
 */
export const triggerContentAudit = async (): Promise<{ status: string; message: string }> => {
    const response = await authenticatedFetch('/api/v1/admins/content-quality/audit', {
        method: 'POST',
    });
    return handleApiResponse<{ status: string; message: string }>(response);
};
