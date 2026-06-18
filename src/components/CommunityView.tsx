import { useMemo } from 'react';
import { Users, Award, Info, MapPin, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CrisisSubmission } from '../types/database';
import { BadgeSystem } from './BadgeSystem';
import { getUniqueLocations } from '../utils/badges';
import type { BadgeProgress } from '../utils/badges';

interface CommunityViewProps {
  submissions: CrisisSubmission[];
  verifiedSubmissionIds: Set<string>;
}

interface ContributorRow {
  name: string;
  reportCount: number;
  uniqueLocations: number;
  uniqueCrisisTypes: number;
  badgeProgress: BadgeProgress[];
}

const ANONYMOUS_KEY = '__anonymous__';

function progressForContributor(
  contributorSubs: CrisisSubmission[],
  verifiedIds: Set<string>
): { uniqueLocations: number; uniqueCrisisTypes: number; hasVerified: boolean; progress: BadgeProgress[] } {
  const uniqueLocations = getUniqueLocations(contributorSubs).length;
  const crisisTypes = new Set<string>();
  contributorSubs.forEach((s) => (s.crisis_nature ?? []).forEach((n) => crisisTypes.add(n)));
  const hasVerified = contributorSubs.some((s) => verifiedIds.has(s.id));

  const progress: BadgeProgress[] = [
    { id: 'first_responder', earned: contributorSubs.length >= 1, current: contributorSubs.length, threshold: 1 },
    { id: 'community_guardian', earned: uniqueLocations >= 5, current: uniqueLocations, threshold: 5 },
    { id: 'crisis_mapper', earned: crisisTypes.size >= 3, current: crisisTypes.size, threshold: 3 },
    { id: 'verified_witness', earned: hasVerified, current: hasVerified ? 1 : 0, threshold: 1 },
    {
      id: 'rapid_responder',
      earned: false,
      current: 0,
      threshold: 1,
    },
  ];

  return { uniqueLocations, uniqueCrisisTypes: crisisTypes.size, hasVerified, progress };
}

export default function CommunityView({ submissions, verifiedSubmissionIds }: CommunityViewProps) {
  const { t } = useTranslation();

  const contributors = useMemo<ContributorRow[]>(() => {
    const byContributor = new Map<string, CrisisSubmission[]>();
    submissions.forEach((s) => {
      const key = s.submitted_by?.trim() ? s.submitted_by.trim() : ANONYMOUS_KEY;
      const list = byContributor.get(key) ?? [];
      list.push(s);
      byContributor.set(key, list);
    });

    const rows: ContributorRow[] = [];
    byContributor.forEach((subs, name) => {
      const { uniqueLocations, uniqueCrisisTypes, progress } = progressForContributor(
        subs,
        verifiedSubmissionIds
      );
      rows.push({
        name: name === ANONYMOUS_KEY ? t('community.anonymous') : name,
        reportCount: subs.length,
        uniqueLocations,
        uniqueCrisisTypes,
        badgeProgress: progress,
      });
    });

    rows.sort((a, b) => {
      const aBadges = a.badgeProgress.filter((p) => p.earned).length;
      const bBadges = b.badgeProgress.filter((p) => p.earned).length;
      if (bBadges !== aBadges) return bBadges - aBadges;
      if (b.uniqueLocations !== a.uniqueLocations) return b.uniqueLocations - a.uniqueLocations;
      return b.reportCount - a.reportCount;
    });

    return rows;
  }, [submissions, verifiedSubmissionIds, t]);

  const communityStats = useMemo(() => {
    const totalReports = submissions.length;
    const totalReporters = contributors.length;
    const uniqueLocations = getUniqueLocations(submissions).length;
    const crisisTypes = new Set<string>();
    submissions.forEach((s) => (s.crisis_nature ?? []).forEach((n) => crisisTypes.add(n)));

    return {
      totalReports,
      totalReporters,
      uniqueLocations,
      crisisTypesReported: crisisTypes.size,
    };
  }, [submissions, contributors]);

  const topContributors = contributors.slice(0, 10);

  const statCards = [
    { label: t('community.stats.totalReports'), value: communityStats.totalReports, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: t('community.stats.totalReporters'), value: communityStats.totalReporters, icon: Users, color: 'text-green-600 bg-green-50' },
    { label: t('community.stats.areasCovered'), value: communityStats.uniqueLocations, icon: MapPin, color: 'text-purple-600 bg-purple-50' },
    { label: t('community.stats.crisisTypes'), value: communityStats.crisisTypesReported, icon: AlertCircle, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Community Stats */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {t('community.statsHeading')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className={`inline-flex w-10 h-10 rounded-lg items-center justify-center mb-3 ${stat.color}`}>
                  <Icon size={20} />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Award className="text-blue-600" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">
            {t('community.leaderboardHeading')}
          </h2>
        </div>

        {topContributors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            {t('community.noContributors')}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {topContributors.map((contributor, index) => (
                <div key={`${contributor.name}-${index}`} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="flex items-center gap-3 md:w-56 flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-amber-100 text-amber-700'
                          : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="font-semibold text-gray-900 truncate">{contributor.name}</div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 flex-1">
                    <div>
                      <span className="font-semibold text-gray-900">{contributor.reportCount}</span>{' '}
                      {t('community.reportsLabel')}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{contributor.uniqueLocations}</span>{' '}
                      {t('community.locationsLabel')}
                    </div>
                  </div>

                  <div className="md:ml-auto">
                    <BadgeSystem badgeProgress={contributor.badgeProgress} variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Anonymous note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-blue-900">{t('community.anonymousNote')}</p>
      </div>

      {/* How It Works */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Info className="text-blue-600" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">
            {t('community.howItWorksHeading')}
          </h2>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-700 mb-4">{t('community.howItWorksIntro')}</p>
          <BadgeSystem
            badgeProgress={ALL_BADGES_PREVIEW}
            variant="grid"
          />
          <p className="text-sm text-gray-500 mt-4">
            {t('community.howItWorksFooter')}
          </p>
        </div>
      </section>
    </div>
  );
}

const ALL_BADGES_PREVIEW: BadgeProgress[] = [
  { id: 'first_responder', earned: true, current: 1, threshold: 1 },
  { id: 'community_guardian', earned: true, current: 5, threshold: 5 },
  { id: 'crisis_mapper', earned: true, current: 3, threshold: 3 },
  { id: 'verified_witness', earned: true, current: 1, threshold: 1 },
  { id: 'rapid_responder', earned: true, current: 1, threshold: 1 },
];
