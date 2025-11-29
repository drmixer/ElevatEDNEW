import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listPrivacyRequests } from '../privacyService';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';

describe('privacyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.setResponses({});
  });

  it('filters requests by learner and requester so RLS stays scoped to guardians', async () => {
    supabaseMock.setResponses({
      privacy_requests: {
        query: async () => ({
          data: [
            {
              id: 1,
              requester_id: 'parent-1',
              student_id: 'student-1',
              request_type: 'export',
              status: 'pending',
              contact_email: 'parent@example.com',
              reason: null,
              admin_notes: null,
              handled_by: null,
              resolved_at: null,
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      },
    });

    const results = await listPrivacyRequests({ studentId: 'student-1', requesterId: 'parent-1' });

    const builder = (supabaseMock.from as unknown as { mock: { results: Array<{ value: unknown }> } }).mock.results[0]
      ?.value as any;
    expect(builder.eq).toHaveBeenCalledWith('student_id', 'student-1');
    expect(builder.eq).toHaveBeenCalledWith('requester_id', 'parent-1');
    expect(results[0].requestType).toBe('export');
    expect(results[0].status).toBe('pending');
  });
});
