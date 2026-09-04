import type { StoredEventState } from '../types/participant';
import { parseParticipantInput, type ImportValidation } from './participantParser';

export const defaultParticipantsUrl = `${import.meta.env.BASE_URL}data/default-participants.csv`;

type Fetcher = Window['fetch'];

export function shouldLoadDefaultParticipants(state: StoredEventState): boolean {
  return state.participants.length === 0;
}

export async function loadDefaultParticipants(fetcher: Fetcher = window.fetch.bind(window)): Promise<ImportValidation> {
  const response = await fetcher(defaultParticipantsUrl);
  if (!response.ok) {
    throw new Error(`Default participant CSV request failed: ${response.status}`);
  }

  const validation = parseParticipantInput(await response.text(), 'csv');
  if (
    validation.validParticipants.length === 0
    || validation.invalidRows.length > 0
    || validation.duplicateRows.length > 0
  ) {
    throw new Error('Default participant CSV did not validate');
  }

  return validation;
}
