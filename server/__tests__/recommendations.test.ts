import { describe, expect, it, vi } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import { fetchModuleById } from '../recommendations';

describe('fetchModuleById', () => {
  it('returns the public module row when the query resolves cleanly', async () => {
    const supabase = createSupabaseClientMock({
      modules: {
        query: async () => ({
          data: [
            {
              id: 252,
              slug: 'shapes',
              title: '2D/3D Shapes & Attributes',
              summary: null,
              grade_band: '1',
              subject: 'math',
              strand: null,
              topic: null,
              subtopic: null,
              open_track: true,
              metadata: null,
              visibility: 'public',
            },
          ],
          error: null,
        }),
      },
    });

    await expect(fetchModuleById(supabase as never, 252)).resolves.toMatchObject({
      id: 252,
      title: '2D/3D Shapes & Attributes',
    });
  });

  it('warns and returns the first public row when duplicate rows appear', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const supabase = createSupabaseClientMock({
      modules: {
        query: async () => ({
          data: [
            {
              id: 252,
              slug: 'shapes-a',
              title: '2D/3D Shapes & Attributes',
              summary: null,
              grade_band: '1',
              subject: 'math',
              strand: null,
              topic: null,
              subtopic: null,
              open_track: true,
              metadata: null,
              visibility: 'public',
            },
            {
              id: 252,
              slug: 'shapes-b',
              title: '2D/3D Shapes & Attributes Duplicate',
              summary: null,
              grade_band: '1',
              subject: 'math',
              strand: null,
              topic: null,
              subtopic: null,
              open_track: true,
              metadata: null,
              visibility: 'public',
            },
          ],
          error: null,
        }),
      },
    });

    await expect(fetchModuleById(supabase as never, 252)).resolves.toMatchObject({
      slug: 'shapes-a',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[recommendations] multiple module rows returned for id',
      expect.objectContaining({ moduleId: 252, count: 2 }),
    );
  });

  it('returns null when no public row is available', async () => {
    const supabase = createSupabaseClientMock({
      modules: {
        query: async () => ({
          data: [
            {
              id: 252,
              slug: 'shapes',
              title: '2D/3D Shapes & Attributes',
              summary: null,
              grade_band: '1',
              subject: 'math',
              strand: null,
              topic: null,
              subtopic: null,
              open_track: true,
              metadata: null,
              visibility: 'draft',
            },
          ],
          error: null,
        }),
      },
    });

    await expect(fetchModuleById(supabase as never, 252)).resolves.toBeNull();
  });
});
