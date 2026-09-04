export type Participant = {
  id: string;
  title: string;
  fullName: string;
  affiliation: string;
};

export type DrawRecord = {
  drawNumber: number;
  participantId: string;
  title: string;
  fullName: string;
  affiliation: string;
  removedFromEligibility: boolean;
  createdAt: string;
};

export type StoredEventState = {
  storageVersion: 2;
  participants: Participant[];
  eligibleIds: string[];
  history: DrawRecord[];
  removeSelected: boolean;
  muted: boolean;
};
