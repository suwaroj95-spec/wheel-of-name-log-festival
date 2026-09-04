import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { nextRevealStage, type RevealStage } from './utils/revealState';

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
  const [revealStage, setRevealStage] = useState<RevealStage | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [participantPanelHidden, setParticipantPanelHidden] = useState(false);
  const [message, setMessage] = useState('');
  const timersRef = useRef<number[]>([]);
  const particleIdRef = useRef(0);
  const audioRef = useRef(new FestivalAudio());
  const committedWinnerIdRef = useRef<string | null>(null);
  const defaultLoadAttemptedRef = useRef(false);

  const participantById = useMemo(
    () => new Map(eventState.participants.map((participant) => [participant.id, participant])),
    [eventState.participants],
  );
  const canSpin = phase === 'idle' && eventState.eligibleIds.length > 0;

  useEffect(() => () => clearAllTimers(), []);

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
    setRevealStage(null);
    committedWinnerIdRef.current = null;
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
    setPhase('revealingAffiliation');
    setRevealStage('affiliation');
  }

  const finishReveal = useCallback((winner: Participant) => {
    if (committedWinnerIdRef.current === winner.id) return;
    committedWinnerIdRef.current = winner.id;
    setPhase('celebrating');
    setEventState((current) => commitWinner(current, winner, current.removeSelected));
    audioRef.current.playWinner(eventState.muted);
    schedule(() => setPhase('complete'), timing.celebrationDelayMs);
  }, [eventState.muted, setEventState]);

  const advanceReveal = useCallback(() => {
    if (!currentWinner || !revealStage || revealStage === 'complete') return;
    const nextStage = nextRevealStage(revealStage);
    setRevealStage(nextStage);
    if (nextStage === 'title') {
      setPhase('revealingTitle');
      return;
    }
    setPhase('celebrating');
    finishReveal(currentWinner);
  }, [currentWinner, finishReveal, revealStage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'TEXTAREA'
        || target?.tagName === 'INPUT'
        || target?.isContentEditable;
      if (isTyping || !currentWinner || !revealStage || revealStage === 'complete') return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        advanceReveal();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceReveal, currentWinner, revealStage]);

  function handleOpenAll() {
    if (!currentWinner) return;
    clearAllTimers();
    audioRef.current.stopSpin();
    setRevealStage('complete');
    finishReveal(currentWinner);
  }

  function handleApplyParticipants(validation: ImportValidation) {
    setEventState((current) => replaceParticipants(current, validation.validParticipants));
    setCurrentWinner(null);
    committedWinnerIdRef.current = null;
    setRevealStage(null);
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
    setRevealStage(null);
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
        revealStage={revealStage}
        sidebarHidden={participantPanelHidden}
        particles={particles}
        canSpin={canSpin}
        eligibleCount={eventState.eligibleIds.length}
        totalCount={eventState.participants.length}
        removeSelected={eventState.removeSelected}
        muted={eventState.muted}
        message={message}
        onSpin={handleSpin}
        onOpenAll={handleOpenAll}
        onNext={() => {
          setCurrentWinner(null);
          committedWinnerIdRef.current = null;
          setRevealStage(null);
          setPhase('idle');
        }}
        onAdvanceReveal={advanceReveal}
        onToggleRemoveSelected={(value) => setEventState((current) => ({ ...current, removeSelected: value }))}
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
    </div>
  );
}
