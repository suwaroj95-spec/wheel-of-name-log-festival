import { assets, frogPoseAsset, type FrogPose } from '../config/assets';
import type { Participant } from '../types/participant';
import { revealInstruction, type RevealStage } from '../utils/revealState';

export type SpinPhase =
  | 'idle'
  | 'frogApproach'
  | 'frogSwipe'
  | 'spinning'
  | 'slowing'
  | 'revealingAffiliation'
  | 'revealingTitle'
  | 'celebrating'
  | 'complete';

type Particle = {
  id: number;
  symbol: string;
  left: number;
  size: number;
  drift: number;
  duration: number;
  rotate: number;
};

type StageProps = {
  phase: SpinPhase;
  currentWinner: Participant | null;
  revealStage: RevealStage | null;
  sidebarHidden: boolean;
  particles: Particle[];
  canSpin: boolean;
  eligibleCount: number;
  totalCount: number;
  removeSelected: boolean;
  muted: boolean;
  message: string;
  onSpin: () => void;
  onOpenAll: () => void;
  onNext: () => void;
  onAdvanceReveal: () => void;
  onToggleRemoveSelected: (value: boolean) => void;
  onToggleMuted: (value: boolean) => void;
  onHistory: () => void;
  onReset: () => void;
  onShuffle: () => void;
  onFullscreen: () => void;
  onToggleSidebar: () => void;
};

export function Stage({
  phase,
  currentWinner,
  revealStage,
  sidebarHidden,
  particles,
  canSpin,
  eligibleCount,
  totalCount,
  removeSelected,
  muted,
  message,
  onSpin,
  onOpenAll,
  onNext,
  onAdvanceReveal,
  onToggleRemoveSelected,
  onToggleMuted,
  onHistory,
  onReset,
  onShuffle,
  onFullscreen,
  onToggleSidebar,
}: StageProps) {
  const frogPose: FrogPose = phase === 'celebrating' || phase === 'complete'
    ? 'celebrate'
    : phase === 'frogSwipe'
      ? 'swipe'
      : 'idle';
  const isReveal = phase === 'revealingAffiliation' || phase === 'revealingTitle';
  const isActive = !['idle', 'complete'].includes(phase);
  const hasRevealedWinner = Boolean(currentWinner && revealStage);
  const showTitle = revealStage === 'title' || revealStage === 'complete';
  const showFullName = revealStage === 'complete';
  const instruction = revealStage ? revealInstruction(revealStage) : '';
  const resultStateClass = showFullName ? 'winner-board-complete' : showTitle ? 'winner-board-title' : '';

  return (
    <main className={`stage ${sidebarHidden ? 'stage-expanded' : ''}`} style={{ backgroundImage: `url(${assets.background})` }}>
      <div className="stage-overlay" />
      <header className="top-bar">
        <div>
          <p className="eyebrow">LOG MUSIC FESTIVAL 2026</p>
          <h1>Random Picker</h1>
        </div>
        <div className="toolbar">
          <button type="button" onClick={onFullscreen}>Full Screen</button>
          <button type="button" onClick={onHistory}>ประวัติการสุ่ม</button>
          <button type="button" onClick={onShuffle} disabled={isActive || eligibleCount < 2}>Shuffle รายชื่อ</button>
          <button type="button" onClick={onReset} disabled={isActive || totalCount === 0}>Reset การสุ่ม</button>
          <button type="button" onClick={onToggleSidebar}>
            {sidebarHidden ? 'แสดงรายชื่อ' : 'ซ่อนรายชื่อ'}
          </button>
        </div>
      </header>

      <section className="show-area">
        <div className="mascot-lane">
          <img
            className={`frog frog-${phase}`}
            src={frogPoseAsset[frogPose]}
            alt=""
            draggable={false}
          />
        </div>

        <div className="disc-zone" aria-label="festival disc">
          <img className={`festival-disc disc-${phase}`} src={assets.disc} alt="" draggable={false} />
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="note-particle"
              style={{
                left: `${particle.left}%`,
                fontSize: `${particle.size}px`,
                '--drift': `${particle.drift}px`,
                '--duration': `${particle.duration}ms`,
                '--rotate': `${particle.rotate}deg`,
              } as React.CSSProperties}
            >
              {particle.symbol}
            </span>
          ))}
        </div>

        <div
          className={`winner-board ${resultStateClass} ${isReveal ? 'winner-board-clickable' : ''}`}
          role={isReveal ? 'button' : undefined}
          tabIndex={isReveal ? 0 : undefined}
          onClick={isReveal ? onAdvanceReveal : undefined}
        >
          {hasRevealedWinner && currentWinner ? (
            <>
              <section className="result-section result-section-affiliation">
                <p className="result-label">สังกัด</p>
                <p className="affiliation-text">{currentWinner.affiliation}</p>
              </section>
              {showTitle && (
                <section className="result-section result-section-title">
                  <p className="result-label compact">ยศ</p>
                  <p className="title-text">{currentWinner.title}</p>
                </section>
              )}
              {showFullName && (
                <section className="result-section result-section-name">
                  <p className="result-label compact">ชื่อ-สกุล</p>
                  <p className="name-text">{currentWinner.fullName}</p>
                </section>
              )}
              {isReveal && (
                <div className="reveal-actions">
                  <p className="reveal-instruction">{instruction}</p>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenAll();
                    }}
                  >
                    เปิดทั้งหมด
                  </button>
                </div>
              )}
              {(phase === 'celebrating' || phase === 'complete') && (
                <button className="primary-action" type="button" onClick={onNext}>
                  สุ่มคนถัดไป
                </button>
              )}
            </>
          ) : (
            <>
              <p className="result-label">พร้อมสุ่มรายชื่อ</p>
              <p className="idle-copy">{eligibleCount === 0 && totalCount > 0 ? 'สุ่มรายชื่อครบทุกคนแล้ว' : 'กด SPIN เพื่อเริ่ม'}</p>
            </>
          )}
          {message && <p className="status-message">{message}</p>}
        </div>
      </section>

      <footer className="control-deck">
        <button className="spin-button" type="button" disabled={!canSpin} onClick={onSpin}>
          SPIN
        </button>
        <div className="switches">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={removeSelected}
              onChange={(event) => onToggleRemoveSelected(event.target.checked)}
              disabled={isActive}
            />
            นำชื่อที่สุ่มได้ออกจากรอบถัดไป
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={!muted}
              onChange={(event) => onToggleMuted(!event.target.checked)}
            />
            Sound On
          </label>
        </div>
        <div className="count-box">
          <span>ผู้มีสิทธิ์คงเหลือ</span>
          <strong>{eligibleCount}</strong>
          <span>จาก {totalCount} คน</span>
        </div>
      </footer>
    </main>
  );
}
