export type RevealField = 'title' | 'name';

export type RevealState = {
  titleRevealed: boolean;
  nameRevealed: boolean;
};

export const initialRevealState: RevealState = {
  titleRevealed: false,
  nameRevealed: false,
};

export function revealField(state: RevealState, field: RevealField): RevealState {
  return field === 'title'
    ? { ...state, titleRevealed: true }
    : { ...state, nameRevealed: true };
}

export function isRevealComplete(state: RevealState): boolean {
  return state.titleRevealed && state.nameRevealed;
}
