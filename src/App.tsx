import { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryPanel } from './components/HistoryPanel';
import { ImportPanel } from './components/ImportPanel';
import { Stage, type SpinPhase } from './components/Stage';
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

export function App() {
  const [eventState, setEventState] = useLocalStorageState<StoredEventState>(storageKey, defaultEventState);
  const [phase, setPhase] = useState<SpinPhase>('idle');
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [participantPanelHidden, setParticipantPanelHidden] = useState(false);
  const [message, setMessage] = useState('');
  const timersRef = useRef<number[]>([]);
  const particleIdRef = useRef(0);
  const audioRef = useRef(new FestivalAudio());
  const committedWinnerIdRef = useRef<string | null>(null);
  const decisionPendingRef = useRef(false);
  const removeDecisionButtonRef = useRef<HTMLButtonElement>(null);
  const defaultLoadAttemptedRef = useRef(false);

  const participantById = useMemo(
    () => new Map(eventState.participants.map((participant) => [participant.id, participant])),
    [eventState.participants],
  );
  const canSpin = phase === 'idle' && eventState.eligibleIds.length > 0;

  useEffect(() => () => clearAllTimers(), []);

  useEffect(() => {
    if (phase === 'decision') removeDecisionButtonRef.current?.focus();
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
    if (!canSpin) return;
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
      audioRef.current.playWinner(eventState.muted);
      setPhase('decision');
    }
  }

  function handleDecision(removeFromEligibility: boolean) {
    if (phase !== 'decision' || !currentWinner || committedWinnerIdRef.current === currentWinner.id) return;
    committedWinnerIdRef.current = currentWinner.id;
    setEventState((current) => commitWinner(current, currentWinner, removeFromEligibility));
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
        canSpin={canSpin}
        eligibleCount={eventState.eligibleIds.length}
        totalCount={eventState.participants.length}
        muted={eventState.muted}
        message={message}
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
        <div className="decision-backdrop">
          <section
            className="decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.preventDefault();
              if (event.key !== 'Tab') return;
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
              if (event.shiftKey && document.activeElement === buttons[0]) {
                event.preventDefault();
                buttons[buttons.length - 1]?.focus();
              } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
                event.preventDefault();
                buttons[0]?.focus();
              }
            }}
          >
            <h2 id="decision-title">ต้องการนำผู้โชคดีรายนี้ออกจากรายชื่อสำหรับการสุ่มรอบถัดไปหรือไม่?</h2>
            <p className="decision-winner">{currentWinner.title} {currentWinner.fullName}</p>
            <p className="decision-affiliation">{currentWinner.affiliation}</p>
            <div className="decision-actions">
              <button ref={removeDecisionButtonRef} type="button" onClick={() => handleDecision(true)}>นำออกจากการสุ่ม</button>
              <button type="button" onClick={() => handleDecision(false)}>เก็บไว้ในรายชื่อ</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
