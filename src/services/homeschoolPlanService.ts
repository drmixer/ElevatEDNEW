import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';
import type { DailyHomeschoolPlan, DailyPlanBlock } from '../../shared/homeschoolDailyPlan';
import type { ElaBlockContent } from '../../shared/elaBlockContent';
import type { MathAdaptiveVariant } from '../../shared/mathAdaptiveVariants';
import type { MathAdaptiveStrand } from '../../shared/mathAdaptivePolicy';
import type {
  ElaSubjectStateSummary,
  ElaWeeklyRecordSummary,
} from '../../shared/elaSubjectStateSummary';
import type {
  MathParentPreferenceSummary,
  MathSubjectStateSummary,
  MathWeeklyRecordSummary,
} from '../../shared/mathSubjectStateSummary';

export type MathDailyPlanResponse = {
  plan: DailyHomeschoolPlan;
};

export type MathAdaptiveVariantResponse = {
  variant: MathAdaptiveVariant;
};

export type MathSubjectStateResponse = {
  state: MathSubjectStateSummary | null;
};

export type MathParentPreferenceResponse = {
  preference: MathParentPreferenceSummary | null;
};

export type MathWeeklyRecordResponse = {
  record: MathWeeklyRecordSummary;
};

export type ElaSubjectStateResponse = {
  state: ElaSubjectStateSummary | null;
};

export type ElaBlockContentResponse = {
  block: DailyPlanBlock;
  content: ElaBlockContent;
};

export type ElaWeeklyRecordResponse = {
  record: ElaWeeklyRecordSummary;
};

export const fetchMathDailyPlan = async (date?: string): Promise<DailyHomeschoolPlan> => {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/api/v1/student/homeschool/math-plan${suffix}`);
  const payload = await handleApiResponse<MathDailyPlanResponse>(response);
  return payload.plan;
};

export const fetchMathAdaptiveVariant = async (variantId: string): Promise<MathAdaptiveVariant> => {
  const params = new URLSearchParams({ id: variantId });
  const response = await authenticatedFetch(`/api/v1/student/homeschool/math-variant?${params.toString()}`);
  const payload = await handleApiResponse<MathAdaptiveVariantResponse>(response);
  return payload.variant;
};

export const fetchElaDailyPlan = async (date?: string): Promise<DailyHomeschoolPlan> => {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/api/v1/student/homeschool/ela-plan${suffix}`);
  const payload = await handleApiResponse<MathDailyPlanResponse>(response);
  return payload.plan;
};

export const fetchMathSubjectState = async (studentId?: string | null): Promise<MathSubjectStateSummary | null> => {
  const params = new URLSearchParams();
  if (studentId) params.set('studentId', studentId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/api/v1/student/homeschool/math-state${suffix}`);
  const payload = await handleApiResponse<MathSubjectStateResponse>(response);
  return payload.state;
};

export const fetchElaSubjectState = async (studentId?: string | null): Promise<ElaSubjectStateSummary | null> => {
  const params = new URLSearchParams();
  if (studentId) params.set('studentId', studentId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`/api/v1/student/homeschool/ela-state${suffix}`);
  const payload = await handleApiResponse<ElaSubjectStateResponse>(response);
  return payload.state;
};

export const fetchElaBlockContent = async (blockId: string, date?: string): Promise<ElaBlockContentResponse> => {
  const params = new URLSearchParams({ blockId });
  if (date) params.set('date', date);
  const response = await authenticatedFetch(`/api/v1/student/homeschool/ela-block-content?${params.toString()}`);
  return handleApiResponse<ElaBlockContentResponse>(response);
};

export const fetchMathParentPreference = async (studentId: string): Promise<MathParentPreferenceSummary | null> => {
  const params = new URLSearchParams({ studentId });
  const response = await authenticatedFetch(`/api/v1/parent/homeschool/math-preference?${params.toString()}`);
  const payload = await handleApiResponse<MathParentPreferenceResponse>(response);
  return payload.preference;
};

export const fetchMathWeeklyRecord = async (
  studentId: string,
  weekStart?: string,
): Promise<MathWeeklyRecordSummary> => {
  const params = new URLSearchParams({ studentId });
  if (weekStart) params.set('weekStart', weekStart);
  const response = await authenticatedFetch(`/api/v1/parent/homeschool/math-weekly-record?${params.toString()}`);
  const payload = await handleApiResponse<MathWeeklyRecordResponse>(response);
  return payload.record;
};

export const fetchElaWeeklyRecord = async (
  studentId: string,
  weekStart?: string,
): Promise<ElaWeeklyRecordSummary> => {
  const params = new URLSearchParams({ studentId });
  if (weekStart) params.set('weekStart', weekStart);
  const response = await authenticatedFetch(`/api/v1/parent/homeschool/ela-weekly-record?${params.toString()}`);
  const payload = await handleApiResponse<ElaWeeklyRecordResponse>(response);
  return payload.record;
};

export const updateMathParentPreference = async (
  studentId: string,
  preferredStrand: MathAdaptiveStrand | null,
): Promise<MathParentPreferenceSummary> => {
  const response = await authenticatedFetch('/api/v1/parent/homeschool/math-preference', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, preferredStrand }),
  });
  const payload = await handleApiResponse<MathParentPreferenceResponse>(response);
  if (!payload.preference) {
    throw new Error('Math preference update did not return a preference.');
  }
  return payload.preference;
};
