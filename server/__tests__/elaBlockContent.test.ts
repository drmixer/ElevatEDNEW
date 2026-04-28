import { describe, expect, it } from 'vitest';

import { buildElaBlockContent } from '../../shared/elaBlockContent';

describe('elaBlockContent', () => {
  it('builds deterministic informational reading content', () => {
    const first = buildElaBlockContent({
      blockKind: 'guided_practice',
      moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      moduleTitle: 'Science/Tech Articles',
      strand: 'reading_informational',
    });
    const second = buildElaBlockContent({
      blockKind: 'guided_practice',
      moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      moduleTitle: 'Science/Tech Articles',
      strand: 'reading_informational',
    });

    expect(first).toEqual(second);
    expect(first.id).toBe(
      'ela-content::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
    );
    expect(first.contentKind).toBe('passage');
    expect(first.focus).toContain('main idea');
    expect(first.body.join(' ')).toContain("author's main point");
  });

  it('builds strand-specific mini-lessons and repair content', () => {
    const writing = buildElaBlockContent({
      blockKind: 'independent_practice',
      moduleSlug: '3-english-language-arts-writing-grammar-sentence-combining',
      strand: 'writing_grammar',
    });
    const repair = buildElaBlockContent({
      blockKind: 'repair',
      moduleSlug: '3-english-language-arts-reading-informational-main-idea',
      strand: 'reading_informational',
    });

    expect(writing.contentKind).toBe('mini_lesson');
    expect(writing.body.join(' ')).toContain('Revision');
    expect(repair.focus).toBe('repair the skill before moving forward');
    expect(repair.body.join(' ')).toContain('corrected thinking');
  });
});
