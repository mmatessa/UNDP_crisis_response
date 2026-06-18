import { Zap, Shield, Map as MapIcon, CheckCircle, Clock, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BadgeId, BadgeProgress } from '../utils/badges';

interface BadgeSystemProps {
  badgeProgress: BadgeProgress[];
  variant?: 'grid' | 'compact';
}

const BADGE_META: Record<
  BadgeId,
  {
    icon: typeof Zap;
    earnedClass: string;
    lockedClass: string;
    iconColor: string;
  }
> = {
  first_responder: {
    icon: Zap,
    earnedClass: 'bg-blue-50 border-blue-300 text-blue-700',
    lockedClass: 'bg-gray-50 border-gray-200 text-gray-400',
    iconColor: 'text-blue-600',
  },
  community_guardian: {
    icon: Shield,
    earnedClass: 'bg-green-50 border-green-300 text-green-700',
    lockedClass: 'bg-gray-50 border-gray-200 text-gray-400',
    iconColor: 'text-green-600',
  },
  crisis_mapper: {
    icon: MapIcon,
    earnedClass: 'bg-purple-50 border-purple-300 text-purple-700',
    lockedClass: 'bg-gray-50 border-gray-200 text-gray-400',
    iconColor: 'text-purple-600',
  },
  verified_witness: {
    icon: CheckCircle,
    earnedClass: 'bg-amber-50 border-amber-300 text-amber-700',
    lockedClass: 'bg-gray-50 border-gray-200 text-gray-400',
    iconColor: 'text-amber-600',
  },
  rapid_responder: {
    icon: Clock,
    earnedClass: 'bg-orange-50 border-orange-300 text-orange-700',
    lockedClass: 'bg-gray-50 border-gray-200 text-gray-400',
    iconColor: 'text-orange-600',
  },
};

export function BadgeSystem({ badgeProgress, variant = 'grid' }: BadgeSystemProps) {
  const { t } = useTranslation();

  const isCompact = variant === 'compact';
  const containerClass = isCompact
    ? 'flex flex-wrap gap-2'
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3';

  return (
    <div className={containerClass}>
      {badgeProgress.map((badge) => {
        const meta = BADGE_META[badge.id];
        const Icon = badge.earned ? meta.icon : Lock;
        const cardClass = badge.earned ? meta.earnedClass : meta.lockedClass;
        const displayName = t(`badges.${kebabToCamel(badge.id)}.name` as const, badge.id);
        const displayDesc = t(`badges.${kebabToCamel(badge.id)}.description` as const, '');

        if (isCompact) {
          return (
            <div
              key={badge.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${cardClass}`}
              title={`${displayName}: ${displayDesc}`}
            >
              <Icon size={14} className={badge.earned ? meta.iconColor : ''} />
              <span className="text-xs font-medium">{displayName}</span>
            </div>
          );
        }

        return (
          <div
            key={badge.id}
            className={`flex flex-col items-center text-center p-4 rounded-lg border-2 transition ${
              badge.earned ? cardClass : `${cardClass} opacity-60`
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                badge.earned ? 'bg-white' : 'bg-gray-100'
              }`}
            >
              <Icon size={24} className={badge.earned ? meta.iconColor : 'text-gray-400'} />
            </div>
            <div className="text-sm font-semibold leading-tight mb-1">{displayName}</div>
            <div className="text-xs leading-snug opacity-80 mb-2">{displayDesc}</div>
            <div className="text-xs font-medium">
              {badge.earned
                ? t('badges.earned')
                : t('badges.progress', {
                    current: badge.current,
                    threshold: badge.threshold,
                  })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function kebabToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

interface BadgeModalProps {
  open: boolean;
  contributor: string | null;
  badgeProgress: BadgeProgress[];
  onClose: () => void;
}

export function CongratulationsModal({
  open,
  contributor,
  badgeProgress,
  onClose,
}: BadgeModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const newlyEarned = badgeProgress.filter((b) => b.earned);
  const inProgressBadge = badgeProgress.find((b) => !b.earned);
  const greeting = contributor
    ? t('badges.modal.greetingNamed', { name: contributor })
    : t('badges.modal.greetingAnonymous');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-3">
              <Zap size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('badges.modal.title')}
            </h2>
            <p className="text-gray-600 mt-2">{greeting}</p>
          </div>

          {newlyEarned.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3 text-center">
                {t('badges.modal.earnedHeading')}
              </p>
              <BadgeSystem badgeProgress={newlyEarned} variant="grid" />
            </div>
          ) : (
            <div className="text-center text-gray-600 text-sm">
              {t('badges.modal.noNewBadges')}
            </div>
          )}

          {inProgressBadge && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-900">
                {t('badges.modal.nextBadgeIntro')}
              </p>
              <div className="mt-2">
                <BadgeSystem badgeProgress={[inProgressBadge]} variant="compact" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            {t('badges.modal.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
