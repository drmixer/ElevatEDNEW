import { describe, expect, it } from 'vitest';

import { buildElaBlockPrompt } from '../../shared/elaBlockPrompts';

describe('elaBlockPrompts', () => {
  it('builds deterministic informational reading prompts', () => {
    const first = buildElaBlockPrompt({
      blockKind: 'guided_practice',
      moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      moduleTitle: 'Science/Tech Articles',
      strand: 'reading_informational',
    });
    const second = buildElaBlockPrompt({
      blockKind: 'guided_practice',
      moduleSlug: '6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
      moduleTitle: 'Science/Tech Articles',
      strand: 'reading_informational',
    });

    expect(first).toEqual(second);
    expect(first.id).toBe(
      'ela::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
    );
    expect(first.responseKind).toBe('evidence_response');
    expect(first.promptText).toContain("main idea or author's point");
    expect(first.checklist).toContain('Use text evidence or a concrete detail');
  });

  it('uses strand-specific writing and repair prompts', () => {
    const writing = buildElaBlockPrompt({
      blockKind: 'independent_practice',
      moduleSlug: '3-english-language-arts-writing-grammar-sentence-combining',
      strand: 'writing_grammar',
    });
    const repair = buildElaBlockPrompt({
      blockKind: 'repair',
      moduleSlug: '3-english-language-arts-writing-grammar-sentence-combining',
      strand: 'writing_grammar',
    });

    expect(writing.responseKind).toBe('writing_response');
    expect(writing.promptText).toContain('draft or revise');
    expect(writing.checklist).toContain('Revise one sentence');
    expect(repair.promptText).toContain('Repair');
    expect(repair.checklist).toContain('Show one corrected example');
  });
});
