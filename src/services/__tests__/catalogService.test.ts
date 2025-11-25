import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCatalogModules,
  fetchLessonDetail,
  fetchModuleAssessment,
  fetchRecommendations,
} from '../catalogService';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('catalogService', () => {
  it('builds a filtered module query and maps fields safely', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 1,
              slug: 'algebra',
              title: 'Algebra I',
              summary: null,
              grade_band: '5',
              subject: 'math',
              strand: 'numbers',
              topic: 'fractions',
              open_track: true,
              suggested_source_category: null,
              example_source: 'OpenStax',
            },
          ],
          total: 1,
        }),
        { status: 200 },
      ),
    );

    const result = await fetchCatalogModules({
      subject: 'math',
      grade: '5',
      standards: ['CCSS.5.NBT'],
      openTrack: true,
      sort: 'title-asc',
      search: 'algebra',
      page: 2,
      pageSize: 5,
    });

    const requestUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestUrl).toContain('subject=math');
    expect(requestUrl).toContain('page=2');
    expect(requestUrl).toContain('standards=CCSS.5.NBT');
    expect(result.total).toBe(1);
    expect(result.data[0].openTrack).toBe(true);
    expect(result.data[0].exampleSource).toBe('OpenStax');
  });

  it('returns null for missing module assessments', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    const assessment = await fetchModuleAssessment(99);

    expect(assessment).toBeNull();
  });

  it('throws for missing lessons and maps recommendations', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendations: [
              {
                id: 10,
                slug: 'starter',
                title: 'Starter',
                subject: 'math',
                strand: null,
                topic: null,
                grade_band: '4',
                summary: 'Do this first',
                open_track: false,
                reason: 'practice',
                fallback: 0,
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(fetchLessonDetail(1)).rejects.toThrow(/not found/i);

    const recs = await fetchRecommendations(5, 80);
    expect(recs[0].fallback).toBe(false);
    expect(recs[0].reason).toBe('practice');
  });
});
