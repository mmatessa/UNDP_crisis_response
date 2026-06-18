import type { CrisisSubmission, CrisisNature } from '../types/database';

export const PROXIMITY_THRESHOLD = 0.0001;

export type BadgeId =
  | 'first_responder'
  | 'community_guardian'
  | 'crisis_mapper'
  | 'verified_witness'
  | 'rapid_responder';

export interface BadgeDefinition {
  id: BadgeId;
  nameKey: string;
  descriptionKey: string;
  threshold: number;
  thresholdLabel: (current: number) => string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_responder',
    nameKey: 'badges.firstResponder.name',
    descriptionKey: 'badges.firstResponder.description',
    threshold: 1,
    thresholdLabel: (current) => `${Math.min(current, 1)}/1`,
  },
  {
    id: 'community_guardian',
    nameKey: 'badges.communityGuardian.name',
    descriptionKey: 'badges.communityGuardian.description',
    threshold: 5,
    thresholdLabel: (current) => `${Math.min(current, 5)}/5`,
  },
  {
    id: 'crisis_mapper',
    nameKey: 'badges.crisisMapper.name',
    descriptionKey: 'badges.crisisMapper.description',
    threshold: 3,
    thresholdLabel: (current) => `${Math.min(current, 3)}/3`,
  },
  {
    id: 'verified_witness',
    nameKey: 'badges.verifiedWitness.name',
    descriptionKey: 'badges.verifiedWitness.description',
    threshold: 1,
    thresholdLabel: (current) => `${Math.min(current, 1)}/1`,
  },
  {
    id: 'rapid_responder',
    nameKey: 'badges.rapidResponder.name',
    descriptionKey: 'badges.rapidResponder.description',
    threshold: 1,
    thresholdLabel: (current) => `${Math.min(current, 1)}/1`,
  },
];

export interface BadgeProgress {
  id: BadgeId;
  earned: boolean;
  current: number;
  threshold: number;
}

export interface BadgeStats {
  totalReports: number;
  uniqueLocations: number;
  uniqueCrisisTypes: number;
  hasVerifiedReport: boolean;
  hasRapidResponse: boolean;
}

export function locationsAreClose(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return (
    Math.abs(lat1 - lat2) <= PROXIMITY_THRESHOLD &&
    Math.abs(lng1 - lng2) <= PROXIMITY_THRESHOLD
  );
}

/**
 * Groups submissions into unique-location clusters using the same proximity
 * threshold (0.0001 degrees) used elsewhere in the app.
 */
export function getUniqueLocations(submissions: CrisisSubmission[]): CrisisSubmission[][] {
  const groups: CrisisSubmission[][] = [];

  for (const submission of submissions) {
    const lat = Number(submission.latitude);
    const lng = Number(submission.longitude);

    const existing = groups.find((group) => {
      const rep = group[0];
      return locationsAreClose(lat, lng, Number(rep.latitude), Number(rep.longitude));
    });

    if (existing) {
      existing.push(submission);
    } else {
      groups.push([submission]);
    }
  }

  return groups;
}

export function isDuplicateLocation(
  submission: { latitude: number; longitude: number },
  existing: CrisisSubmission[]
): boolean {
  const lat = Number(submission.latitude);
  const lng = Number(submission.longitude);
  return existing.some((s) =>
    locationsAreClose(lat, lng, Number(s.latitude), Number(s.longitude))
  );
}

function flattenCrisisNatures(submission: CrisisSubmission): CrisisNature[] {
  return submission.crisis_nature ?? [];
}

export function computeBadgeStats(
  contributorSubmissions: CrisisSubmission[],
  allConfirmableByOthers: Set<string>
): BadgeStats {
  const uniqueLocations = getUniqueLocations(contributorSubmissions).length;

  const crisisTypes = new Set<string>();
  contributorSubmissions.forEach((s) => {
    flattenCrisisNatures(s).forEach((n) => crisisTypes.add(n));
  });

  const hasVerifiedReport = contributorSubmissions.some((s) =>
    allConfirmableByOthers.has(s.id)
  );

  const hasRapidResponse = contributorSubmissions.some((s) => {
    const submittedAt = new Date(s.created_at).getTime();
    const earliest = Math.min(
      ...contributorSubmissions.map((x) => new Date(x.created_at).getTime())
    );
    if (submittedAt !== earliest) return false;
    const sameLocation = contributorSubmissions.filter((x) =>
      locationsAreClose(
        Number(x.latitude),
        Number(x.longitude),
        Number(s.latitude),
        Number(s.longitude)
      )
    );
    if (sameLocation.length < 2) return false;
    const otherReport = sameLocation.find((x) => x.id !== s.id);
    if (!otherReport) return false;
    const gap = Math.abs(new Date(otherReport.created_at).getTime() - submittedAt);
    return gap <= 60 * 60 * 1000;
  });

  return {
    totalReports: contributorSubmissions.length,
    uniqueLocations,
    uniqueCrisisTypes: crisisTypes.size,
    hasVerifiedReport,
    hasRapidResponse,
  };
}

export function computeBadgeProgress(stats: BadgeStats): BadgeProgress[] {
  return [
    {
      id: 'first_responder',
      earned: stats.totalReports >= 1,
      current: stats.totalReports,
      threshold: 1,
    },
    {
      id: 'community_guardian',
      earned: stats.uniqueLocations >= 5,
      current: stats.uniqueLocations,
      threshold: 5,
    },
    {
      id: 'crisis_mapper',
      earned: stats.uniqueCrisisTypes >= 3,
      current: stats.uniqueCrisisTypes,
      threshold: 3,
    },
    {
      id: 'verified_witness',
      earned: stats.hasVerifiedReport,
      current: stats.hasVerifiedReport ? 1 : 0,
      threshold: 1,
    },
    {
      id: 'rapid_responder',
      earned: stats.hasRapidResponse,
      current: stats.hasRapidResponse ? 1 : 0,
      threshold: 1,
    },
  ];
}

/**
 * Returns the set of submission IDs that were confirmed by another user
 * (excluding self-confirmations where confirmed_by matches submitted_by).
 */
export function getVerifiedSubmissionIds(
  confirmations: { submission_id: string; confirmed_by: string | null }[],
  submissions: CrisisSubmission[]
): Set<string> {
  const ownerBySubmissionId = new Map<string, string | null>();
  submissions.forEach((s) => ownerBySubmissionId.set(s.id, s.submitted_by ?? null));

  const verified = new Set<string>();
  for (const c of confirmations) {
    const owner = ownerBySubmissionId.get(c.submission_id) ?? null;
    const confirmer = c.confirmed_by ?? null;
    const isSelfConfirmation = owner !== null && confirmer !== null && owner === confirmer;
    if (!isSelfConfirmation) {
      verified.add(c.submission_id);
    }
  }
  return verified;
}
