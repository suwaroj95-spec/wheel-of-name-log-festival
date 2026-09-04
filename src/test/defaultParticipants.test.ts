import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoredEventState } from '../types/participant';
import { loadDefaultParticipants, shouldLoadDefaultParticipants } from '../utils/defaultParticipants';
import { defaultEventState, replaceParticipants } from '../utils/eventState';

const defaultCsvPath = 'D:/Wheel-of-name-log-festival/public/data/default-participants.csv';

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
    expect(validation.validParticipants).toHaveLength(316);
    expect(validation.invalidRows).toHaveLength(0);
    expect(validation.duplicateRows).toHaveLength(0);
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
