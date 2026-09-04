import { describe, expect, it } from 'vitest';
import { nextRevealStage, revealInstruction } from '../utils/revealState';

describe('reveal stages', () => {
  it('starts from affiliation only and advances to title', () => {
    expect(nextRevealStage('affiliation')).toBe('title');
    expect(revealInstruction('affiliation')).toBe('คลิกเพื่อเปิดชื่อผู้โชคดี');
  });

  it('reveals full name on the second advance', () => {
    expect(nextRevealStage('title')).toBe('complete');
    expect(revealInstruction('title')).toBe('คลิกอีกครั้งเพื่อเปิดชื่อผู้โชคดี');
  });

  it('keeps repeated clicks after complete idempotent', () => {
    expect(nextRevealStage('complete')).toBe('complete');
  });
});
