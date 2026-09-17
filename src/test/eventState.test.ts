import { describe, expect, it } from 'vitest';
import type { Participant, StoredEventState } from '../types/participant';
import {
  commitWinner,
  replaceParticipants,
  resetDraws,
  sanitizeStoredEventState,
  shuffleEligibleIds,
} from '../utils/eventState';

const participants: Participant[] = [
  { id: 'p-001', title: 'ร.อ.', fullName: 'ตัวอย่าง หนึ่ง', affiliation: 'กองหนึ่ง' },
  { id: 'p-002', title: 'น.อ.', fullName: 'ตัวอย่าง สอง', affiliation: 'กองสอง' },
  { id: 'p-003', title: 'นาย', fullName: 'ตัวอย่าง สาม', affiliation: 'กองสาม' },
];

const state: StoredEventState = {
  storageVersion: 2,
  participants,
  eligibleIds: participants.map((participant) => participant.id),
  history: [],
  removeSelected: true,
  muted: false,
};

describe('event state', () => {
  it('remove decision removes the winner', () => {
    const next = commitWinner(state, participants[0], true);
    expect(next.eligibleIds).toEqual(['p-002', 'p-003']);
  });

  it('keep decision leaves the winner eligible', () => {
    const next = commitWinner(state, participants[0], false);
    expect(next.eligibleIds).toEqual(['p-001', 'p-002', 'p-003']);
  });

  it('reset restores all imported participants', () => {
    const drawn = commitWinner(state, participants[0], true);
    const reset = resetDraws(drawn);
    expect(reset.eligibleIds).toEqual(['p-001', 'p-002', 'p-003']);
    expect(reset.history).toHaveLength(0);
  });

  it('shuffle preserves all eligible participant IDs', () => {
    const shuffled = shuffleEligibleIds(state, () => 0);
    expect([...shuffled.eligibleIds].sort()).toEqual(['p-001', 'p-002', 'p-003']);
  });

  it('history stores structured participant information', () => {
    const next = commitWinner(state, participants[1], true);
    expect(next.history[0]).toMatchObject({
      drawNumber: 1,
      title: 'น.อ.',
      fullName: 'ตัวอย่าง สอง',
      affiliation: 'กองสอง',
    });
  });

  it('history records removed status', () => {
    const removed = commitWinner(state, participants[1], true);
    const retained = commitWinner(state, participants[1], false);
    expect(removed.history[0].removedFromEligibility).toBe(true);
    expect(retained.history[0].removedFromEligibility).toBe(false);
  });

  it('uses the explicit decision even when legacy removeSelected disagrees', () => {
    const legacyKeep = { ...state, removeSelected: false };
    const legacyRemove = { ...state, removeSelected: true };
    expect(commitWinner(legacyKeep, participants[0], true).eligibleIds).toEqual(['p-002', 'p-003']);
    expect(commitWinner(legacyRemove, participants[0], false).eligibleIds).toEqual(state.eligibleIds);
  });

  it('replace participants resets eligibility and history', () => {
    const prior = commitWinner(state, participants[0], true);
    const next = replaceParticipants(prior, participants.slice(0, 2));
    expect(next.eligibleIds).toEqual(['p-001', 'p-002']);
    expect(next.history).toHaveLength(0);
  });

  it('invalidates legacy persisted participant data without clearing settings', () => {
    const legacy = {
      participants: [{ id: 'p-001', sequence: 1, displayName: 'ร.อ.ตัวอย่าง หนึ่ง', affiliation: 'กองหนึ่ง' }],
      eligibleIds: ['p-001'],
      history: [{ participantId: 'p-001', displayName: 'ร.อ.ตัวอย่าง หนึ่ง', affiliation: 'กองหนึ่ง' }],
      removeSelected: false,
      muted: true,
    } as unknown as StoredEventState;
    const sanitized = sanitizeStoredEventState(legacy);
    expect(sanitized.invalidatedLegacyParticipants).toBe(true);
    expect(sanitized.state.participants).toEqual([]);
    expect(sanitized.state.history).toEqual([]);
    expect(sanitized.state.removeSelected).toBe(false);
    expect(sanitized.state.muted).toBe(true);
  });
});
