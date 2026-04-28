import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import {
  fetchStudentElaBlockContent,
  resolveElaBlockContent,
} from '../elaBlockContentService';
import type { DailyPlanBlock } from '../../shared/homeschoolDailyPlan';

const block: DailyPlanBlock = {
  id: 'ela-practice-6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
  subject: 'ela',
  kind: 'guided_practice',
  title: 'Evidence response',
  moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
  estimatedMinutes: 18,
  required: true,
  purpose: 'Answer with a claim, text evidence, and explanation.',
  completionEvidence: ['text evidence selected', 'written explanation'],
};

const moduleRow = {
  id: 42,
  slug: block.moduleSlug,
  title: 'Science/Tech Articles',
  subject: 'English Language Arts',
  strand: 'reading_informational',
  topic: 'Science/Tech Articles',
};

const grade3ModuleRow = {
  id: 43,
  slug: '3-english-language-arts-reading-informational-nonfiction-articles-open-licensed',
  title: 'Nonfiction Articles',
  subject: 'English Language Arts',
  strand: 'reading_informational',
  topic: 'Nonfiction Articles',
};

const lessonContent = (topic: string): string =>
  [
    `Students read a short ${topic} passage and identify the clearest claim before answering.`,
    `The lesson asks students to cite one concrete detail and explain how that detail supports the answer.`,
  ].join('\n\n');

const blockWithKind = (kind: DailyPlanBlock['kind']): DailyPlanBlock => ({
  ...block,
  id: `ela-${kind}-${block.moduleSlug}`,
  kind,
});

describe('elaBlockContentService', () => {
  it('uses authored lesson content when a public module lesson is available', async () => {
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({
          data: moduleRow,
          error: null,
        }),
      },
      lessons: {
        query: async () => ({
          data: [
            {
              id: 100,
              title: 'Science article launch',
              slug: 'science-article-launch',
              content:
                '# Launch\n\nA research team tested several designs for a classroom garden. The strongest design saved water and gave students room to observe plant growth each week.\n\nThe author explains that evidence matters because students could compare each design before choosing one.',
              estimated_duration_minutes: 15,
              attribution_block: 'Author: ElevatED',
              open_track: true,
              metadata: { lesson_type: 'launch' },
            },
          ],
          error: null,
        }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, block);

    expect(content.sourceType).toBe('authored_lesson');
    expect(content.id).toBe(`ela-authored-lesson::100::${block.id}`);
    expect(content.title).toBe('Science article launch');
    expect(content.body.join(' ')).toContain('classroom garden');
    expect(content.sourceLabel).toBe('Author: ElevatED');
  });

  it('falls back to deterministic scaffold content when no authored lesson exists', async () => {
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({
          data: moduleRow,
          error: null,
        }),
      },
      lessons: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, block);

    expect(content.sourceType).toBe('deterministic_scaffold');
    expect(content.id).toBe(`ela-content::reading_informational::guided_practice::${block.moduleSlug}`);
    expect(content.sourceLabel).toBe('ElevatED deterministic scaffold');
  });

  it('ranks repair lesson content above a generic launch lesson for repair blocks', async () => {
    const repairBlock = blockWithKind('repair');
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: moduleRow, error: null }),
      },
      lessons: {
        query: async () => ({
          data: [
            {
              id: 100,
              title: 'Science article launch',
              slug: 'science-article-launch',
              content: lessonContent('launch'),
              metadata: { lesson_type: 'launch' },
            },
            {
              id: 110,
              title: 'Science article repair review',
              slug: 'science-article-repair-review',
              content: lessonContent('repair'),
              metadata: { lesson_type: 'repair', block_kind: 'repair' },
            },
          ],
          error: null,
        }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, repairBlock);

    expect(content.id).toBe(`ela-authored-lesson::110::${repairBlock.id}`);
    expect(content.title).toBe('Science article repair review');
    expect(content.parentSummary).toContain('repair block');
  });

  it('ranks diagnostic lesson content above a generic launch lesson for diagnostic blocks', async () => {
    const diagnosticBlock = blockWithKind('diagnostic');
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: moduleRow, error: null }),
      },
      lessons: {
        query: async () => ({
          data: [
            {
              id: 100,
              title: 'Science article launch',
              slug: 'science-article-launch',
              content: lessonContent('launch'),
              metadata: { lesson_type: 'launch' },
            },
            {
              id: 111,
              title: 'Science article starting check',
              slug: 'science-article-diagnostic-check',
              content: lessonContent('starting check'),
              metadata: { lesson_type: 'diagnostic', block_kind: 'diagnostic' },
            },
          ],
          error: null,
        }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, diagnosticBlock);

    expect(content.id).toBe(`ela-authored-lesson::111::${diagnosticBlock.id}`);
    expect(content.title).toBe('Science article starting check');
    expect(content.focus).toBe('show the current starting point');
  });

  it('ranks reflection lesson content above a generic launch lesson for reflection blocks', async () => {
    const reflectionBlock = blockWithKind('reflection');
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: moduleRow, error: null }),
      },
      lessons: {
        query: async () => ({
          data: [
            {
              id: 100,
              title: 'Science article launch',
              slug: 'science-article-launch',
              content: lessonContent('launch'),
              metadata: { lesson_type: 'launch' },
            },
            {
              id: 112,
              title: 'Science article reflection wrap',
              slug: 'science-article-reflection-wrap',
              content: lessonContent('reflection'),
              metadata: { lesson_type: 'reflection', block_kind: 'reflection' },
            },
          ],
          error: null,
        }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, reflectionBlock);

    expect(content.id).toBe(`ela-authored-lesson::112::${reflectionBlock.id}`);
    expect(content.title).toBe('Science article reflection wrap');
    expect(content.contentKind).toBe('reflection_note');
  });

  it('uses a Grade 3 authored ELA content pack when no database lesson exists', async () => {
    const diagnosticBlock: DailyPlanBlock = {
      ...blockWithKind('diagnostic'),
      id: `ela-diagnostic-${grade3ModuleRow.slug}`,
      moduleSlug: grade3ModuleRow.slug,
    };
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: grade3ModuleRow, error: null }),
      },
      lessons: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, diagnosticBlock);

    expect(content.id).toBe(`ela-content-pack::${grade3ModuleRow.slug}::diagnostic`);
    expect(content.sourceType).toBe('authored_lesson');
    expect(content.sourceLabel).toBe('ElevatED authored ELA content pack');
    expect(content.focus).toBe('show the current starting point');
    expect(content.body.join(' ')).toContain('Write the main idea');
  });

  it('uses a Grade 3 authored ELA content pack when the module row is unavailable', async () => {
    const diagnosticBlock: DailyPlanBlock = {
      ...blockWithKind('diagnostic'),
      id: `ela-diagnostic-${grade3ModuleRow.slug}`,
      moduleSlug: grade3ModuleRow.slug,
    };
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: null, error: null }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, diagnosticBlock);

    expect(content.id).toBe(`ela-content-pack::${grade3ModuleRow.slug}::diagnostic`);
    expect(content.sourceLabel).toBe('ElevatED authored ELA content pack');
  });

  it('prefers a block-specific content pack over generic launch content for Grade 3 repair', async () => {
    const repairBlock: DailyPlanBlock = {
      ...blockWithKind('repair'),
      id: `ela-repair-${grade3ModuleRow.slug}`,
      moduleSlug: grade3ModuleRow.slug,
    };
    const supabase = createSupabaseClientMock({
      modules: {
        maybeSingle: async () => ({ data: grade3ModuleRow, error: null }),
      },
      lessons: {
        query: async () => ({
          data: [
            {
              id: 100,
              title: 'Nonfiction article launch',
              slug: 'nonfiction-article-launch',
              content: lessonContent('launch'),
              metadata: { lesson_type: 'launch' },
            },
          ],
          error: null,
        }),
      },
    });

    const content = await resolveElaBlockContent(supabase as never, repairBlock);

    expect(content.id).toBe(`ela-content-pack::${grade3ModuleRow.slug}::repair`);
    expect(content.title).toBe('Nonfiction Articles repair');
    expect(content.parentSummary).toContain('authored repair pack');
  });

  it('returns null when the requested block is not in the daily plan', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({ data: null, error: null }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const resolution = await fetchStudentElaBlockContent(supabase as never, 'student-1', 'missing-block');

    expect(resolution).toBeNull();
  });
});
