export type PositionType = 'ASCO' | 'STRAND';

export interface Strand {
  id: string;
  name: string;
  description: string;
}

export interface Section {
  id: string;
  name: string;
  strandId: string;
  voterPopulation: number;
}

export interface Position {
  id: string;
  name: string;
  type: PositionType;
  strandId?: string;
  order: number; // For sorting
}

export interface TallyModeRecord {
  votes: Record<string, number>;
  abstains: Record<string, number>;
  submittedAt: string;
  submittedBy: string;
}

export interface Candidate {
  id: string;
  name: string;
  positionId: string;
  strandId?: string; // Relevant only if position is STRAND-specific
  alliance?: string;
  party?: string;
  color?: string; // Theme color (e.g., hex or tailwind class name)
  avatar?: string; // Mini description/avatar initials
}

export interface SectionTally {
  sectionId: string;
  ballotsCast: number; // Actual turnout for this section
  votes: Record<string, number>; // candidateId -> vote count
  abstains?: Record<string, number>; // positionId -> abstain count
  asco?: TallyModeRecord;
  strand?: TallyModeRecord;
  submittedModes?: { asco: boolean; strand: boolean };
  updatedAt: string;
  submittedBy: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}
