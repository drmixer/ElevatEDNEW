import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assignModuleToStudents,
  fetchAdminAssignmentOverview,
  fetchChildAssignments,
} from '../assignmentService';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';
const authenticatedFetch = vi.fn();

vi.mock('../../lib/apiClient', () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));

beforeEach(() => {
  supabaseMock.setResponses({});
  authenticatedFetch.mockReset();
});

describe('assignModuleToStudents', () => {
  it('raises an error when the API responds with a non-OK status', async () => {
    authenticatedFetch.mockResolvedValue(
      new Response('assignment failed', { status: 500, statusText: 'Server error' }),
    );

    await expect(
      assignModuleToStudents({ moduleId: 1, studentIds: ['s-1'], title: 'Module' }),
    ).rejects.toThrow(/assignment failed/i);
    expect(authenticatedFetch).toHaveBeenCalled();
  });
});

describe('fetchChildAssignments', () => {
  it('maps Supabase rows into assignment summaries with module context', async () => {
    const assignmentRow = {
      id: 5,
      status: 'in_progress',
      due_at: '2024-08-01T00:00:00.000Z',
      student_id: 'student-1',
      assignments: {
        id: 9,
        title: 'Module Focus',
        metadata: { module_id: 42, module_title: 'Fractions Mastery' },
        due_at: '2024-08-02T00:00:00.000Z',
      },
    };

    supabaseMock.setResponses({
      student_assignments: {
        query: async () => ({ data: [assignmentRow], error: null }),
      },
    });

    const assignments = await fetchChildAssignments('student-1');

    expect(assignments).toHaveLength(1);
    expect(assignments[0].moduleId).toBe(42);
    expect(assignments[0].moduleTitle).toBe('Fractions Mastery');
    expect(assignments[0].status).toBe('in_progress');
  });
});

describe('fetchAdminAssignmentOverview', () => {
  it('aggregates completion counts for admin views', async () => {
    const adminRow = {
      id: 10,
      title: 'Reading Module',
      metadata: { module_id: 7, module_title: 'Literacy Boost' },
      due_at: '2024-08-10T00:00:00.000Z',
      created_at: '2024-07-01T00:00:00.000Z',
      student_assignments: [
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'not_started' },
      ],
    };

    supabaseMock.setResponses({
      assignments: {
        query: async () => ({ data: [adminRow], error: null }),
      },
    });

    const overview = await fetchAdminAssignmentOverview();

    expect(overview[0].assignmentId).toBe(10);
    expect(overview[0].moduleId).toBe(7);
    expect(overview[0].completedCount).toBe(1);
    expect(overview[0].inProgressCount).toBe(1);
    expect(overview[0].notStartedCount).toBe(1);
  });
});
