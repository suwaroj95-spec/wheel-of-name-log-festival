import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Stage, type SpinPhase } from '../components/Stage';
import type { Participant } from '../types/participant';
import type { RevealStage } from '../utils/revealState';

const winner: Participant = {
  id: 'p-001',
  title: 'ร.อ.',
  fullName: 'พิสิฐชัย ออเขาย้อย',
  affiliation: 'กองทดสอบพิเศษ',
};

function renderStage(phase: SpinPhase, revealStage: RevealStage | null) {
  return renderToStaticMarkup(
    <Stage
      phase={phase}
      currentWinner={winner}
      revealStage={revealStage}
      sidebarHidden={false}
      particles={[]}
      canSpin={phase === 'idle'}
      eligibleCount={316}
      totalCount={316}
      removeSelected
      muted={false}
      message=""
      onSpin={vi.fn()}
      onOpenAll={vi.fn()}
      onNext={vi.fn()}
      onAdvanceReveal={vi.fn()}
      onToggleRemoveSelected={vi.fn()}
      onToggleMuted={vi.fn()}
      onHistory={vi.fn()}
      onReset={vi.fn()}
      onShuffle={vi.fn()}
      onFullscreen={vi.fn()}
      onToggleSidebar={vi.fn()}
    />,
  );
}

describe('stage winner reveal rendering', () => {
  it.each<SpinPhase>(['frogApproach', 'frogSwipe', 'spinning', 'slowing'])(
    'hides winner data during %s',
    (phase) => {
      const html = renderStage(phase, null);
      expect(html).not.toContain(winner.affiliation);
      expect(html).not.toContain(winner.title);
      expect(html).not.toContain(winner.fullName);
    },
  );

  it('shows affiliation only after the wheel-stop reveal state begins', () => {
    const html = renderStage('revealingAffiliation', 'affiliation');
    expect(html).toContain(winner.affiliation);
    expect(html).not.toContain(winner.title);
    expect(html).not.toContain(winner.fullName);
    expect(html).toContain('คลิกเพื่อเปิดชื่อผู้โชคดี');
  });

  it('first reveal advance exposes title only and keeps full name hidden', () => {
    const html = renderStage('revealingTitle', 'title');
    expect(html).toContain(winner.affiliation);
    expect(html).toContain(winner.title);
    expect(html).not.toContain(winner.fullName);
    expect(html).toContain('คลิกอีกครั้งเพื่อเปิดชื่อผู้โชคดี');
  });

  it('second reveal advance exposes full name and removes repeated reveal actions', () => {
    const html = renderStage('complete', 'complete');
    expect(html).toContain(winner.affiliation);
    expect(html).toContain(winner.title);
    expect(html).toContain(winner.fullName);
    expect(html).not.toContain('เปิดทั้งหมด');
    expect(html).not.toContain('คลิกอีกครั้งเพื่อเปิดชื่อผู้โชคดี');
  });
});
