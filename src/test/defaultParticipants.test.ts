import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoredEventState } from '../types/participant';
import { loadDefaultParticipants, shouldLoadDefaultParticipants } from '../utils/defaultParticipants';
import { commitWinner, defaultEventState, replaceParticipants, sanitizeStoredEventState } from '../utils/eventState';

const defaultCsvPath = resolve(process.cwd(), 'public', 'data', 'default-participants.csv');

const configuredState: StoredEventState = replaceParticipants(defaultEventState, [{
  id: 'custom-001',
  title: 'นาย',
  fullName: 'รายชื่อ กำหนดเอง',
  affiliation: 'หน่วยงานทดสอบ',
}]);

describe('default participants', () => {
  it('loads defaults only when no participant state exists', () => {
    expect(shouldLoadDefaultParticipants(defaultEventState)).toBe(true);
  });

  it('preserves compatible persisted participant data', () => {
    expect(shouldLoadDefaultParticipants(configuredState)).toBe(false);
  });

  it('does not overwrite an existing imported list after reset or history changes', () => {
    const resetCurrentList = { ...configuredState, eligibleIds: ['custom-001'], history: [] };
    expect(shouldLoadDefaultParticipants(resetCurrentList)).toBe(false);
  });

  it('parses the bundled default CSV through the shared participant parser', async () => {
    const csv = readFileSync(defaultCsvPath, 'utf8');
    const validation = await loadDefaultParticipants(async () => new Response(csv));
    expect(validation.validParticipants).toHaveLength(372);
    expect(validation.invalidRows).toHaveLength(0);
    expect(validation.duplicateRows).toHaveLength(0);
  });

  it('loads defaults after version-2 migration and preserves a removed winner on refresh', async () => {
    const oldParticipants = Array.from({ length: 316 }, (_, index) => ({
      id: `old-${index}`,
      title: 'นาย',
      fullName: `รายชื่อเดิม ${index}`,
      affiliation: 'หน่วยงานเดิม',
    }));
    const legacy = {
      ...replaceParticipants(defaultEventState, oldParticipants),
      storageVersion: 2,
    } as unknown as StoredEventState;
    const migrated = sanitizeStoredEventState(legacy).state;
    expect(shouldLoadDefaultParticipants(migrated)).toBe(true);

    const csv = readFileSync(defaultCsvPath, 'utf8');
    const validation = await loadDefaultParticipants(async () => new Response(csv));
    const loaded = replaceParticipants(migrated, validation.validParticipants);
    expect(loaded.storageVersion).toBe(3);
    expect(loaded.participants).toHaveLength(372);
    expect(loaded.eligibleIds).toHaveLength(372);

    const drawn = commitWinner(loaded, loaded.participants[0], true);
    const refreshed = sanitizeStoredEventState(JSON.parse(JSON.stringify(drawn)) as StoredEventState);
    expect(refreshed.invalidatedLegacyParticipants).toBe(false);
    expect(refreshed.state.participants).toHaveLength(372);
    expect(refreshed.state.eligibleIds).toHaveLength(371);
    expect(refreshed.state.history).toHaveLength(1);
    expect(shouldLoadDefaultParticipants(refreshed.state)).toBe(false);
  });

  it('keeps default load failure recoverable', async () => {
    await expect(loadDefaultParticipants(async () => new Response('', { status: 404 }))).rejects.toThrow(
      'Default participant CSV request failed',
    );
  });

  it('rejects invalid default CSV content instead of inventing participants', async () => {
    await expect(loadDefaultParticipants(async () => new Response('ยศ,ชื่อ-สกุล,สังกัด\nนาย,,หน่วย'))).rejects.toThrow(
      'Default participant CSV did not validate',
    );
  });
});
