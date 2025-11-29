import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchGuardianLinks } from '../parentService';

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseClientMock } = await import('../../test/supabaseMock');
  return { __esModule: true, default: createSupabaseClientMock() };
});

import supabaseMock from '../../lib/supabaseClient';

describe('parentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.setResponses({});
  });

  it('respects guardian link scoping and ordering', async () => {
    supabaseMock.setResponses({
      guardian_child_links: {
        query: async () => ({
          data: [
            {
              id: 10,
              student_id: 'student-1',
              parent_id: 'parent-1',
              relationship: 'Aunt',
              status: 'active',
              invited_at: '2024-01-01',
              accepted_at: '2024-01-02',
              metadata: { source: 'family_code' },
            },
          ],
          error: null,
        }),
      },
    });

    const links = await fetchGuardianLinks('parent-1');

    const builder = (supabaseMock.from as unknown as { mock: { results: Array<{ value: unknown }> } }).mock.results[0]
      ?.value as any;
    expect(builder.eq).toHaveBeenCalledWith('parent_id', 'parent-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(links[0].relationship).toBe('Aunt');
    expect(links[0].metadata?.source).toBe('family_code');
  });
});
