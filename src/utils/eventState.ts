import type { DrawRecord, Participant, StoredEventState } from '../types/participant';

export const defaultEventState: StoredEventState = {
  storageVersion: 3,
  participants: [],
  eligibleIds: [],
  history: [],
  removeSelected: true,
  muted: false,
};

export function replaceParticipants(
  state: StoredEventState,
  participants: Participant[],
): StoredEventState {
  return {
    ...state,
    participants,
    eligibleIds: participants.map((participant) => participant.id),
    history: [],
  };
}

export function commitWinner(
  state: StoredEventState,
  winner: Participant,
  removeSelected: boolean,
): StoredEventState {
  const record: DrawRecord = {
    drawNumber: state.history.length + 1,
    participantId: winner.id,
    title: winner.title,
    fullName: winner.fullName,
    affiliation: winner.affiliation,
    removedFromEligibility: removeSelected,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    eligibleIds: removeSelected
      ? state.eligibleIds.filter((id) => id !== winner.id)
      : state.eligibleIds,
    history: [...state.history, record],
  };
}

export function resetDraws(state: StoredEventState): StoredEventState {
  return {
    ...state,
    eligibleIds: state.participants.map((participant) => participant.id),
    history: [],
  };
}

export function shuffleEligibleIds(state: StoredEventState, randomInt: (maxExclusive: number) => number): StoredEventState {
  const ids = [...state.eligibleIds];
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { ...state, eligibleIds: ids };
}

export function sanitizeStoredEventState(state: StoredEventState): {
  state: StoredEventState;
  invalidatedLegacyParticipants: boolean;
} {
  const maybeState = state as Partial<StoredEventState>;
  const hasCurrentShape = Array.isArray(maybeState.participants)
    && maybeState.participants.every((participant) => (
      typeof participant.id === 'string'
      && typeof participant.title === 'string'
      && typeof participant.fullName === 'string'
      && typeof participant.affiliation === 'string'
    ))
    && Array.isArray(maybeState.eligibleIds)
    && Array.isArray(maybeState.history)
    && maybeState.history.every((record) => (
      typeof record.participantId === 'string'
      && typeof record.title === 'string'
      && typeof record.fullName === 'string'
      && typeof record.affiliation === 'string'
    ));

  if (maybeState.storageVersion === 3 && hasCurrentShape) {
    return { state, invalidatedLegacyParticipants: false };
  }

  return {
    state: {
      ...defaultEventState,
      removeSelected: typeof maybeState.removeSelected === 'boolean'
        ? maybeState.removeSelected
        : defaultEventState.removeSelected,
      muted: typeof maybeState.muted === 'boolean' ? maybeState.muted : defaultEventState.muted,
    },
    invalidatedLegacyParticipants: true,
  };
}
