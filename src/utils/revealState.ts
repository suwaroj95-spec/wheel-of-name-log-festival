export type RevealStage = 'affiliation' | 'title' | 'complete';

export function nextRevealStage(stage: RevealStage): RevealStage {
  if (stage === 'affiliation') return 'title';
  if (stage === 'title') return 'complete';
  return 'complete';
}

export function revealInstruction(stage: RevealStage): string {
  if (stage === 'affiliation') return 'คลิกเพื่อเปิดชื่อผู้โชคดี';
  if (stage === 'title') return 'คลิกอีกครั้งเพื่อเปิดชื่อผู้โชคดี';
  return '';
}
