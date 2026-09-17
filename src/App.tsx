import { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { ImportPanel } from './components/ImportPanel';
import { Stage, type SpinPhase } from './components/Stage';
import { preloadFrogAssets } from './config/assets';
import { timing } from './config/timing';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import type { Participant, StoredEventState } from './types/participant';
import { FestivalAudio } from './utils/audio';
import { loadDefaultParticipants, shouldLoadDefaultParticipants } from './utils/defaultParticipants';
import {
  commitWinner,
  defaultEventState,
  replaceParticipants,
  resetDraws,
  sanitizeStoredEventState,
  shuffleEligibleIds,
} from './utils/eventState';
import { getUnbiasedRandomInt, pickRandomId } from './utils/random';
import type { ImportValidation } from './utils/participantParser';
import { initialRevealState, isRevealComplete, revealField, type RevealField, type RevealState } from './utils/revealState';

type Particle = {
  id: number;
  symbol: string;
  left: number;
  size: number;
  drift: number;
  duration: number;
  rotate: number;
};

const storageKey = 'log-music-festival-picker-state-v1';
const notes = ['♪', '♫', '♬', '♩', '♭', '♯'];

type CongratulationsModalProps = {
  winner: Participant;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

export function CongratulationsModal({ winner, closeButtonRef, onClose }: CongratulationsModalProps) {
  return (
    <div className="decision-backdrop">
      <section
        className="decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.preventDefault();
          if (event.key === 'Tab') {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }
        }}
      >
        <h2 id="decision-title">ยินดีกับผู้โชคดีที่ได้รับรางวัล</h2>
        <p className="decision-winner">{winner.title} {winner.fullName}</p>
        <p className="decision-affiliation">{winner.affiliation}</p>
        <div className="decision-actions">
          <button ref={closeButtonRef} type="button" onClick={onClose}>ปิด</button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [eventState, setEventState] = useLocalStorageState<StoredEventState>(storageKey, defaultEventState);
  const [phase, setPhase] = useState<SpinPhase>('idle');
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [participantPanelHidden, setParticipantPanelHidden] = useState(false);
  const [message, setMessage] = useState('');
  const [frogAssetsReady, setFrogAssetsReady] = useState(false);
  const [frogAssetError, setFrogAssetError] = useState(false);
  const timersRef = useRef<number[]>([]);
  const particleIdRef = useRef(0);
  const audioRef = useRef(new FestivalAudio());
  const committedWinnerIdRef = useRef<string | null>(null);
  const decisionPendingRef = useRef(false);
  const closeResultButtonRef = useRef<HTMLButtonElement>(null);
  const defaultLoadAttemptedRef = useRef(false);

  const participantById = useMemo(
    () => new Map(eventState.participants.map((participant) => [participant.id, participant])),
    [eventState.participants],
  );
  const canSpin = phase === 'idle' && eventState.eligibleIds.length > 0;

  useEffect(() => () => clearAllTimers(), []);

  useEffect(() => {
    let cancelled = false;
    void preloadFrogAssets()
      .then(() => {
        if (!cancelled) setFrogAssetsReady(true);
      })
      .catch(() => {
        if (!cancelled) setFrogAssetError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase === 'decision') closeResultButtonRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    const sanitized = sanitizeStoredEventState(eventState);
    if (sanitized.invalidatedLegacyParticipants) {
      setEventState(sanitized.state);
      setMessage('ข้อมูลรายชื่อเดิมไม่เข้ากับรูปแบบใหม่ กรุณานำเข้า CSV ที่แยก ยศ | ชื่อ-สกุล | สังกัด');
    }
  }, [eventState, setEventState]);

  useEffect(() => {
    if (defaultLoadAttemptedRef.current || !shouldLoadDefaultParticipants(eventState)) return;

    let cancelled = false;
    defaultLoadAttemptedRef.current = true;
    void loadDefaultParticipants()
      .then((validation) => {
        if (cancelled) return;
        setEventState((current) => (
          shouldLoadDefaultParticipants(current)
            ? replaceParticipants(current, validation.validParticipants)
            : current
        ));
        setMessage(`โหลดรายชื่อเริ่มต้น ${validation.validParticipants.length} คนแล้ว`);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('ไม่สามารถโหลดรายชื่อเริ่มต้นได้ กรุณานำเข้า CSV หรือวางรายชื่อจาก Excel');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventState, setEventState]);

  function clearAllTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }

  async function handleSpin() {
    if (!canSpin || !frogAssetsReady || frogAssetError) return;
    await audioRef.current.ensureContext();
    audioRef.current.playTap(eventState.muted);
    clearAllTimers();
    setMessage('');
    setRevealState(null);
    committedWinnerIdRef.current = null;
    decisionPendingRef.current = false;
    const winnerId = pickRandomId(eventState.eligibleIds);
    const winner = participantById.get(winnerId);
    if (!winner) return;
    setCurrentWinner(winner);
    setPhase('frogApproach');

    schedule(() => setPhase('frogSwipe'), timing.frogApproachMs);
    schedule(() => {
      setPhase('spinning');
      audioRef.current.startSpin(eventState.muted);
      emitParticlesForSpin();
    }, timing.frogApproachMs + timing.frogSwipeMs);
    schedule(() => setPhase('slowing'), timing.frogApproachMs + timing.frogSwipeMs + timing.discSpinMs - 1200);
    schedule(() => {
      audioRef.current.stopSpin();
      startReveal();
    }, timing.frogApproachMs + timing.frogSwipeMs + timing.discSpinMs);
  }

  function emitParticlesForSpin() {
    const startedAt = Date.now();
    const emit = () => {
      if (Date.now() - startedAt > timing.discSpinMs) return;
      const id = particleIdRef.current + 1;
      particleIdRef.current = id;
      const particle: Particle = {
        id,
        symbol: notes[id % notes.length],
        left: 38 + getUnbiasedRandomInt(25),
        size: 24 + getUnbiasedRandomInt(28),
        drift: -100 + getUnbiasedRandomInt(201),
        duration: 1100 + getUnbiasedRandomInt(850),
        rotate: -45 + getUnbiasedRandomInt(91),
      };
      setParticles((current) => [...current.slice(-24), particle]);
      schedule(() => setParticles((current) => current.filter((item) => item.id !== id)), particle.duration);
      schedule(emit, timing.particleIntervalMs);
    };
    emit();
  }

  function startReveal() {
    setPhase('revealing');
    setRevealState(initialRevealState);
  }

  function handleReveal(field: RevealField) {
    if (phase !== 'revealing' || !currentWinner || !revealState || decisionPendingRef.current) return;
    if (field === 'title' && revealState.titleRevealed) return;
    if (field === 'name' && revealState.nameRevealed) return;
    const next = revealField(revealState, field);
    setRevealState(next);
    if (isRevealComplete(next)) {
      decisionPendingRef.current = true;
      const committedWinnerId = committedWinnerIdRef.current;
      if (committedWinnerId !== currentWinner.id) {
        committedWinnerIdRef.current = currentWinner.id;
        setEventState((current) => commitWinner(current, currentWinner, true));
        audioRef.current.playWinner(eventState.muted);
      }
      setPhase('decision');
    }
  }

  function handleCloseResult() {
    if (phase !== 'decision') return;
    setCurrentWinner(null);
    setRevealState(null);
    setPhase('idle');
    decisionPendingRef.current = false;
  }

  function handleApplyParticipants(validation: ImportValidation) {
    setEventState((current) => replaceParticipants(current, validation.validParticipants));
    setCurrentWinner(null);
    committedWinnerIdRef.current = null;
    decisionPendingRef.current = false;
    setRevealState(null);
    setPhase('idle');
    setMessage(`ใช้รายชื่อ ${validation.validParticipants.length} คนแล้ว`);
  }

  function handleReset() {
    if (!window.confirm('ยืนยัน Reset การสุ่ม? รายชื่อที่นำเข้าจะยังอยู่')) return;
    clearAllTimers();
    audioRef.current.stopSpin();
    setEventState(resetDraws);
    setCurrentWinner(null);
    committedWinnerIdRef.current = null;
    decisionPendingRef.current = false;
    setRevealState(null);
    setPhase('idle');
    setMessage('Reset การสุ่มเรียบร้อยแล้ว');
  }

  function handleShuffle() {
    setEventState((current) => shuffleEligibleIds(current, getUnbiasedRandomInt));
    setMessage('Shuffle เรียบร้อยแล้ว');
    schedule(() => setMessage(''), 1800);
  }

  async function handleFullscreen() {
    if (!document.fullscreenEnabled) {
      setMessage('เบราว์เซอร์นี้ไม่รองรับ Full Screen');
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  return (
    <div className={`app-shell ${participantPanelHidden ? 'app-shell-sidebar-hidden' : ''}`}>
      <Stage
        phase={phase}
        currentWinner={currentWinner}
        revealState={revealState}
        sidebarHidden={participantPanelHidden}
        particles={particles}
        canSpin={canSpin && frogAssetsReady && !frogAssetError}
        eligibleCount={eventState.eligibleIds.length}
        totalCount={eventState.participants.length}
        muted={eventState.muted}
        message={frogAssetError ? 'ไม่สามารถโหลดภาพมาสคอตได้ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง' : message}
        onSpin={handleSpin}
        onReveal={handleReveal}
        onToggleMuted={(value) => {
          setEventState((current) => ({ ...current, muted: value }));
          if (value) audioRef.current.stopSpin();
        }}
        onHistory={() => setHistoryOpen(true)}
        onReset={handleReset}
        onShuffle={handleShuffle}
        onFullscreen={handleFullscreen}
        onToggleSidebar={() => setParticipantPanelHidden((hidden) => !hidden)}
      />
      <ImportPanel
        currentCount={eventState.participants.length}
        hasHistory={eventState.history.length > 0}
        onApply={handleApplyParticipants}
      />
      <HistoryPanel history={eventState.history} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {phase === 'decision' && currentWinner && (
        <CongratulationsModal
          winner={currentWinner}
          closeButtonRef={closeResultButtonRef}
          onClose={handleCloseResult}
        />
      )}
    </div>
  );
}
