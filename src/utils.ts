import { Strand, Section, Position, Candidate, SectionTally, TallyModeRecord } from './types';

export function getCandidateAlliance(candidate: Candidate) {
  return candidate.alliance?.trim() || candidate.party?.trim() || 'Independent';
}

export function getPositionDisplayName(position: Position, strands: Strand[]) {
  if (position.type === 'STRAND' && position.strandId) {
    const strand = strands.find((entry) => entry.id === position.strandId);
    return `${strand?.name || position.strandId} - ${position.name}`;
  }

  return position.name;
}

export function getTallyModeRecord(tally: SectionTally, mode: 'ASCO' | 'STRAND'): TallyModeRecord | undefined {
  const modeRecord = mode === 'ASCO' ? tally.asco : tally.strand;
  if (modeRecord) return modeRecord;

  return {
    votes: tally.votes || {},
    abstains: tally.abstains || {},
    submittedAt: tally.updatedAt,
    submittedBy: tally.submittedBy,
  };
}

export function getSectionSubmissionStatus(tally?: SectionTally) {
  if (!tally) return 'pending' as const;
  const ascoDone = !!tally.submittedModes?.asco || !!tally.asco;
  const strandDone = !!tally.submittedModes?.strand || !!tally.strand;
  if (ascoDone && strandDone) return 'submitted' as const;
  if (ascoDone || strandDone) return 'partial' as const;
  return 'pending' as const;
}

export function getAllModeVotes(tally: SectionTally) {
  return {
    ...(tally.asco?.votes || tally.votes || {}),
    ...(tally.strand?.votes || {}),
  };
}

export function getAllModeAbstains(tally: SectionTally) {
  return {
    ...(tally.asco?.abstains || tally.abstains || {}),
    ...(tally.strand?.abstains || {}),
  };
}

export function calculateGlobalAbstentions(tallies: SectionTally[]) {
  const totalVotes = tallies.reduce((sum, tally) => sum + Object.values(getAllModeVotes(tally)).reduce((voteSum, vote) => voteSum + vote, 0), 0);
  const totalAbstains = tallies.reduce((sum, tally) => sum + Object.values(getAllModeAbstains(tally)).reduce((abstainSum, abstain) => abstainSum + abstain, 0), 0);
  const percentage = totalVotes + totalAbstains > 0 ? (totalAbstains / (totalVotes + totalAbstains)) * 100 : 0;

  return {
    totalAbstains,
    abstentionRate: percentage,
  };
}

export function getPositionCandidateCandidates(position: Position, candidates: Candidate[], mode: 'ASCO' | 'STRAND', selectedStrandId?: string) {
  return candidates.filter((candidate) => {
    if (candidate.positionId !== position.id) return false;
    if (mode === 'ASCO') return true;
    const targetStrandId = position.strandId || selectedStrandId;
    return !!targetStrandId && candidate.strandId === targetStrandId;
  });
}

export function calculateCandidateMetrics(
  position: Position,
  candidates: Candidate[],
  tallies: SectionTally[],
  mode: 'ASCO' | 'STRAND',
  selectedStrandId?: string,
) {
  const relevantCandidates = getPositionCandidateCandidates(position, candidates, mode, selectedStrandId);
  const voteTotals: Record<string, number> = {};
  const abstainTotals = tallies.reduce((sum, tally) => {
    const modeRecord = getTallyModeRecord(tally, mode);
    if (!modeRecord) return sum;

    relevantCandidates.forEach((candidate) => {
      voteTotals[candidate.id] = (voteTotals[candidate.id] || 0) + (modeRecord.votes[candidate.id] || 0);
    });

    return sum + (modeRecord.abstains[position.id] || 0);
  }, 0);

  const sortedCandidates = relevantCandidates
    .map((candidate) => ({
      ...candidate,
      votes: voteTotals[candidate.id] || 0,
    }))
    .sort((left, right) => right.votes - left.votes);

  const totalValidVotes = sortedCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const totalVotesCast = totalValidVotes + abstainTotals;
  const winner = sortedCandidates[0];
  const runnerUp = sortedCandidates[1];

  return {
    totalVotesCast,
    totalValidVotes,
    totalAbstentions: abstainTotals,
    abstentionRate: totalVotesCast > 0 ? (abstainTotals / totalVotesCast) * 100 : 0,
    winningMargin: winner && runnerUp ? winner.votes - runnerUp.votes : winner?.votes || 0,
    candidates: sortedCandidates.map((candidate) => ({
      ...candidate,
      validShare: totalValidVotes > 0 ? (candidate.votes / totalValidVotes) * 100 : 0,
      absoluteShare: totalVotesCast > 0 ? (candidate.votes / totalVotesCast) * 100 : 0,
    })),
  };
}

/**
 * Calculates school-wide turnout metrics.
 */
export function calculateSchoolTurnout(sections: Section[], tallies: SectionTally[]) {
  const totalPopulation = sections.reduce((sum, sec) => sum + sec.voterPopulation, 0);
  const totalBallots = tallies.reduce((sum, tal) => sum + tal.ballotsCast, 0);
  const percentage = totalPopulation > 0 ? (totalBallots / totalPopulation) * 100 : 0;

  return {
    totalPopulation,
    totalBallots,
    percentage: Math.min(percentage, 100)
  };
}

/**
 * Calculates turnout metrics for a specific strand.
 */
export function calculateStrandTurnout(strandId: string, sections: Section[], tallies: SectionTally[]) {
  const strandSections = sections.filter(sec => sec.strandId === strandId);
  const totalPopulation = strandSections.reduce((sum, sec) => sum + sec.voterPopulation, 0);
  
  const strandSectionIds = new Set(strandSections.map(s => s.id));
  const totalBallots = tallies
    .filter(tal => strandSectionIds.has(tal.sectionId))
    .reduce((sum, tal) => sum + tal.ballotsCast, 0);
    
  const percentage = totalPopulation > 0 ? (totalBallots / totalPopulation) * 100 : 0;

  return {
    totalPopulation,
    totalBallots,
    percentage: Math.min(percentage, 100)
  };
}

/**
 * Calculates turnout metrics per individual section.
 */
export function calculateSectionTurnout(section: Section, tallies: SectionTally[]) {
  const tally = tallies.find(tal => tal.sectionId === section.id);
  const ballotsCast = tally ? tally.ballotsCast : 0;
  const percentage = section.voterPopulation > 0 ? (ballotsCast / section.voterPopulation) * 100 : 0;
  
  return {
    voterPopulation: section.voterPopulation,
    ballotsCast,
    percentage: Math.min(percentage, 100),
    hasSubmitted: !!tally
  };
}

/**
 * Aggregates candidate vote counts.
 * Returns a Record of candidateId -> totalVotes.
 */
export function aggregateVotes(tallies: SectionTally[]) {
  const votes: Record<string, number> = {};
  
  tallies.forEach(tally => {
    Object.entries(tally.votes).forEach(([candidateId, count]) => {
      votes[candidateId] = (votes[candidateId] || 0) + count;
    });
  });
  
  return votes;
}

/**
 * Ranks candidates for a given position.
 * If strandId is provided, filters for that specific strand's candidates.
 */
export function rankCandidates(
  positionId: string,
  candidates: Candidate[],
  aggregatedVotes: Record<string, number>,
  strandId?: string
) {
  // Filter candidates matching the position
  let filtered = candidates.filter(cand => cand.positionId === positionId);
  
  // If strand-specific, filter by strand
  if (strandId) {
    filtered = filtered.filter(cand => cand.strandId === strandId);
  }
  
  // Map to candidate with vote counts and sort
  return filtered
    .map(cand => ({
      ...cand,
      votes: aggregatedVotes[cand.id] || 0
    }))
    .sort((a, b) => b.votes - a.votes); // Descending order
}

export function rankAllianceResults(
  positionId: string,
  candidates: Candidate[],
  aggregatedVotes: Record<string, number>,
  strandId?: string
) {
  const filtered = candidates.filter((cand) => cand.positionId === positionId);
  const scoped = strandId
    ? filtered.filter((cand) => cand.strandId === strandId)
    : filtered;

  const grouped = new Map<string, { alliance: string; votes: number; candidates: Candidate[] }>();

  scoped.forEach((candidate) => {
    const alliance = getCandidateAlliance(candidate);
    const current = grouped.get(alliance) || { alliance, votes: 0, candidates: [] };
    current.votes += aggregatedVotes[candidate.id] || 0;
    current.candidates.push(candidate);
    grouped.set(alliance, current);
  });

  return Array.from(grouped.values()).sort((a, b) => b.votes - a.votes);
}

/**
 * Helper to generate a random or pastel color based on candidate ID
 */
export function getPartyColorClass(colorName?: string): { bg: string; text: string; border: string; raw: string } {
  switch (colorName?.toLowerCase()) {
    case 'red':
      return { bg: 'bg-red-50 text-red-700', text: 'text-red-700', border: 'border-red-200', raw: 'red' };
    case 'blue':
      return { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-700', border: 'border-blue-200', raw: 'blue' };
    case 'green':
      return { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200', raw: 'emerald' };
    case 'yellow':
    case 'orange':
      return { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200', raw: 'amber' };
    case 'purple':
      return { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', border: 'border-purple-200', raw: 'purple' };
    default:
      return { bg: 'bg-slate-50 text-slate-700', text: 'text-slate-700', border: 'border-slate-200', raw: 'slate' };
  }
}
