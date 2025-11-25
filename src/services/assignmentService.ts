import { authenticatedFetch } from '../lib/apiClient';
import supabase from '../lib/supabaseClient';
import type { AdminAssignmentOverview, AdminStudent, AssignmentSummary } from '../types';

type AssignModulePayload = {
  moduleId: number;
  studentIds: string[];
  creatorId?: string;
  creatorRole?: 'parent' | 'admin';
  dueAt?: string | null;
  title?: string;
};

type AssignModuleResponse = {
  assignmentId: number;
  lessonsAttached: number;
  assignedStudents: number;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

export const assignModuleToStudents = async (
  payload: AssignModulePayload,
): Promise<AssignModuleResponse> => {
  const response = await authenticatedFetch('/api/assignments/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<AssignModuleResponse>(response);
};

export const fetchChildAssignments = async (studentId: string): Promise<AssignmentSummary[]> => {
  if (!studentId) return [];

  const { data, error } = await supabase
    .from('student_assignments')
    .select(
      `id, status, due_at, student_id,
       assignments ( id, title, metadata, due_at )
      `,
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Assignments] Failed to fetch student assignments', error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const assignment = row.assignments as {
      id: number;
      title: string;
      metadata: Record<string, unknown> | null;
      due_at: string | null;
    } | null;
    const moduleId = assignment?.metadata?.module_id as number | null | undefined;
    const moduleTitle = (assignment?.metadata?.module_title as string | undefined) ?? assignment?.title ?? null;

    return {
      id: row.id as number,
      title: assignment?.title ?? 'Module assignment',
      status: row.status as AssignmentSummary['status'],
      dueAt: (row.due_at as string | null) ?? assignment?.due_at ?? null,
      moduleId: moduleId ?? null,
      moduleTitle,
      studentId: row.student_id as string,
    } satisfies AssignmentSummary;
  });
};

export const fetchAdminAssignmentOverview = async (): Promise<AdminAssignmentOverview[]> => {
  const { data, error } = await supabase
    .from('assignments')
    .select(
      `id, title, metadata, due_at, created_at,
       student_assignments ( status )
      `,
    )
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    console.error('[Assignments] Failed to load admin assignment overview', error);
    throw error;
  }

  return (data ?? []).map((assignment) => {
    const moduleId = assignment.metadata?.module_id as number | null | undefined;
    const moduleTitle = (assignment.metadata?.module_title as string | undefined) ?? assignment.title ?? null;
    const counts = (assignment.student_assignments ?? []).reduce(
      (acc: { completed: number; inProgress: number; notStarted: number }, row: { status: string }) => {
        if (row.status === 'completed') acc.completed += 1;
        else if (row.status === 'in_progress') acc.inProgress += 1;
        else acc.notStarted += 1;
        return acc;
      },
      { completed: 0, inProgress: 0, notStarted: 0 },
    );

    return {
      assignmentId: assignment.id as number,
      moduleId: moduleId ?? null,
      moduleTitle,
      assignedCount: counts.completed + counts.inProgress + counts.notStarted,
      completedCount: counts.completed,
      inProgressCount: counts.inProgress,
      notStartedCount: counts.notStarted,
      dueAt: assignment.due_at as string | null,
      createdAt: assignment.created_at as string | null,
    } satisfies AdminAssignmentOverview;
  });
};

export const fetchAdminStudents = async (): Promise<AdminStudent[]> => {
  const { data, error } = await supabase
    .from('student_profiles')
    .select('id, grade, first_name, last_name')
    .order('grade', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[Assignments] Failed to load student roster', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    grade: (row.grade as number | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
  } satisfies AdminStudent));
};
