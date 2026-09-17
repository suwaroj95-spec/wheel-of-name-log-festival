import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CongratulationsModal } from '../App';
import { Stage, type SpinPhase } from '../components/Stage';
import { frogPoseAsset } from '../config/assets';
import type { Participant } from '../types/participant';
import { initialRevealState, revealField, type RevealState } from '../utils/revealState';

const winner: Participant = {
  id: 'p-001',
  title: 'ร.อ.',
  fullName: 'พิสิฐชัย ออเขาย้อย',
  affiliation: 'กองทดสอบพิเศษ',
};

function renderStage(phase: SpinPhase, revealState: RevealState | null, sidebarHidden = false, eligibleCount = 3) {
  return renderToStaticMarkup(
    <Stage
      phase={phase}
      currentWinner={winner}
      revealState={revealState}
      sidebarHidden={sidebarHidden}
      particles={[]}
      canSpin={phase === 'idle' && eligibleCount > 0}
      eligibleCount={eligibleCount}
      totalCount={3}
      muted={false}
      message=""
      onSpin={vi.fn()}
      onReveal={vi.fn()}
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
  it('uses the idle frog before the swipe phase', () => {
    expect(renderStage('idle', null)).toContain(`src="${frogPoseAsset.idle}"`);
    expect(renderStage('frogApproach', null)).toContain(`src="${frogPoseAsset.idle}"`);
  });

  it.each<SpinPhase>(['frogSwipe', 'spinning', 'slowing'])(
    'uses the distinct swipe frog during %s',
    (phase) => {
      expect(frogPoseAsset.swipe).not.toBe(frogPoseAsset.idle);
      expect(renderStage(phase, null)).toContain(`src="${frogPoseAsset.swipe}"`);
    },
  );

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
    const html = renderStage('revealing', initialRevealState);
    expect(html).toContain(winner.affiliation);
    expect(html).not.toContain(winner.title);
    expect(html).not.toContain(winner.fullName);
    expect(html).toContain('>ยศ</button>');
    expect(html).toContain('>ชื่อ-สกุล</button>');
    expect(html).not.toContain('เปิดทั้งหมด');
    expect(html).not.toContain('นำชื่อที่สุ่มได้ออกจากรอบถัดไป');
  });

  it('opening title exposes only title', () => {
    const html = renderStage('revealing', revealField(initialRevealState, 'title'));
    expect(html).toContain(winner.affiliation);
    expect(html).toContain(winner.title);
    expect(html).not.toContain(winner.fullName);
    expect(html).not.toContain('>ยศ</button>');
    expect(html).toContain('>ชื่อ-สกุล</button>');
  });

  it('opening name first exposes only full name', () => {
    const html = renderStage('revealing', revealField(initialRevealState, 'name'));
    expect(html).toContain(winner.fullName);
    expect(html).not.toContain(winner.title);
    expect(html).toContain('>ยศ</button>');
    expect(html).not.toContain('>ชื่อ-สกุล</button>');
  });

  it('shows both fields after both reveals while keeping SPIN disabled for decision', () => {
    const html = renderStage('decision', { titleRevealed: true, nameRevealed: true });
    expect(html).toContain(winner.affiliation);
    expect(html).toContain(winner.title);
    expect(html).toContain(winner.fullName);
    expect(html).not.toContain('เปิดทั้งหมด');
    expect(html).toMatch(/class="spin-button"[^>]*disabled/);
  });

  it('keeps the sidebar-expanded class and hides SPIN for an empty eligible pool', () => {
    const html = renderStage('idle', null, true, 0);
    expect(html).toContain('stage-expanded');
    expect(html).toContain('แสดงรายชื่อ');
    expect(html).toContain('สุ่มรายชื่อครบทุกคนแล้ว');
    expect(html).toMatch(/class="spin-button"[^>]*disabled/);
  });

  it('renders a congratulatory modal with one Close action', () => {
    const html = renderToStaticMarkup(
      <CongratulationsModal
        winner={winner}
        closeButtonRef={{ current: null }}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('ยินดีกับผู้โชคดีที่ได้รับรางวัล');
    expect(html).toContain(`${winner.title} ${winner.fullName}`);
    expect(html).toContain(winner.affiliation);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('>ปิด</button>');
    expect(html).not.toContain('นำออกจากการสุ่ม');
    expect(html).not.toContain('เก็บไว้ในรายชื่อ');
  });
});
