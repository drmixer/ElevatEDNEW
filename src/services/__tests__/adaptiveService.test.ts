import { describe, expect, it } from 'vitest';
import { describeSuggestionReason } from '../adaptiveService';

describe('describeSuggestionReason', () => {
  it('includes lesson title and subject for reinforcement suggestions', () => {
    const message = describeSuggestionReason('reinforcement', 'Fractions Basics', 'math', 0.82);
    expect(message).toContain('Fractions Basics');
    expect(message.toLowerCase()).toContain('reinforce');
    expect(message).toContain('82%');
  });

  it('handles advance_next_topic with fallback copy', () => {
    const message = describeSuggestionReason('advance_next_topic', 'Plate Tectonics', 'science', null);
    expect(message).toContain('Plate Tectonics');
    expect(message.toLowerCase()).toContain('explore');
  });

  it('falls back gracefully when reason is missing', () => {
    const message = describeSuggestionReason(null, 'Writing Workshop', 'english', 0.65);
    expect(message).toContain('Writing Workshop');
    expect(message.toLowerCase()).toContain('momentum');
    expect(message).toContain('65%');
  });
});
