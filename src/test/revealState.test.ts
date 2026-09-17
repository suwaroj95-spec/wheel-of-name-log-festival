import { describe, expect, it } from 'vitest';
import { initialRevealState, isRevealComplete, revealField } from '../utils/revealState';

describe('independent reveal state', () => {
  it('starts with title and name hidden', () => {
    expect(initialRevealState).toEqual({ titleRevealed: false, nameRevealed: false });
    expect(isRevealComplete(initialRevealState)).toBe(false);
  });

  it.each(['title', 'name'] as const)('reveals %s without revealing the other field', (field) => {
    const next = revealField(initialRevealState, field);
    expect(next).toEqual(field === 'title'
      ? { titleRevealed: true, nameRevealed: false }
      : { titleRevealed: false, nameRevealed: true });
    expect(isRevealComplete(next)).toBe(false);
  });

  it.each(['title', 'name'] as const)('completes when %s is revealed first, then the other field', (first) => {
    const second = first === 'title' ? 'name' : 'title';
    const once = revealField(initialRevealState, first);
    expect(isRevealComplete(once)).toBe(false);
    expect(isRevealComplete(revealField(once, second))).toBe(true);
  });
});
