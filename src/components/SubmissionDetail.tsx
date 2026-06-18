import { X, MapPin, Calendar, User, Building, AlertTriangle, Trash2, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CrisisSubmission } from '../types/database';

interface SubmissionDetailProps {
  submission: CrisisSubmission;
  allSubmissions?: CrisisSubmission[];
  onClose: () => void;
}

const PROXIMITY_THRESHOLD = 0.0001;

function getRelatedSubmissions(submission: CrisisSubmission, allSubmissions: CrisisSubmission[]): CrisisSubmission[] {
  const lat = Number(submission.latitude);
  const lng = Number(submission.longitude);

  const related = allSubmissions.filter((s) => {
    const sLat = Number(s.latitude);
    const sLng = Number(s.longitude);
    return Math.abs(lat - sLat) <= PROXIMITY_THRESHOLD && Math.abs(lng - sLng) <= PROXIMITY_THRESHOLD;
  });

  return related.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export default function SubmissionDetail({ submission, allSubmissions, onClose }: SubmissionDetailProps) {
  const { t, i18n } = useTranslation();

  const getDamageBadgeClass = (level: string) => {
    switch (level) {
      case 'minimal':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'partial':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'destroyed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDamageDotColor = (level: string) => {
    switch (level) {
      case 'minimal':
        return '#eab308';
      case 'partial':
        return '#f97316';
      case 'destroyed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInfrastructureTypeLabel = (type: string) => {
    if (type.startsWith('other:')) {
      return type.replace('other: ', '');
    }
    return t(`submit.infrastructureTypes.${type}`, type.replace(/_/g, ' '));
  };

  const relatedSubmissions = allSubmissions ? getRelatedSubmissions(submission, allSubmissions) : [submission];
  const hasVersionHistory = relatedSubmissions.length > 1;
  const currentSubmissionIndex = relatedSubmissions.findIndex((s) => s.id === submission.id);
  const isLatest = currentSubmissionIndex === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('detail.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <img
            src={submission.photo_url}
            alt="Damage"
            className="w-full h-64 object-cover rounded-lg"
          />

          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-4 py-2 rounded-full border-2 font-semibold text-sm ${getDamageBadgeClass(submission.damage_level)}`}>
              {t(`submit.damageLevels.${submission.damage_level}`).toUpperCase()} {t('map.damage')}
            </span>
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full border-2 border-blue-300 font-semibold text-sm">
              {getInfrastructureTypeLabel(submission.infrastructure_type).toUpperCase()}
            </span>
          </div>

          {/* Infrastructure Name */}
          {submission.infrastructure_name && (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Building className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <div className="font-semibold text-gray-900 mb-1">{t('detail.infrastructureName')}</div>
                <div className="text-sm text-gray-600">{submission.infrastructure_name}</div>
              </div>
            </div>
          )}

          {/* Crisis Nature */}
          {submission.crisis_nature && submission.crisis_nature.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <AlertTriangle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <div className="font-semibold text-gray-900 mb-2">{t('detail.crisisNature')}</div>
                <div className="flex flex-wrap gap-2">
                  {submission.crisis_nature.map((nature) => (
                    <span
                      key={nature}
                      className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                    >
                      {t(`submit.crisisNatureOptions.${nature}`, nature.replace(/_/g, ' '))}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Debris Clearance */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <Trash2 className="text-blue-600 flex-shrink-0 mt-1" size={20} />
            <div>
              <div className="font-semibold text-gray-900 mb-1">{t('detail.debrisClearance')}</div>
              <div className="text-sm text-gray-600">
                {submission.debris_clearance_required ? t('submit.yes') : t('submit.no')}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('detail.description')}</h3>
            <p className="text-gray-700 leading-relaxed">{submission.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <MapPin className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <div className="font-semibold text-gray-900 mb-1">{t('detail.location')}</div>
                <div className="text-sm text-gray-600">
                  {submission.location_name && (
                    <div className="mb-1">{submission.location_name}</div>
                  )}
                  <div>{t('submit.latitude')}: {Number(submission.latitude).toFixed(6)}</div>
                  <div>{t('submit.longitude')}: {Number(submission.longitude).toFixed(6)}</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <div className="font-semibold text-gray-900 mb-1">{t('detail.submitted')}</div>
                <div className="text-sm text-gray-600">
                  {formatDate(submission.created_at)}
                </div>
              </div>
            </div>

            {submission.submitted_by && (
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg md:col-span-2">
                <User className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <div className="font-semibold text-gray-900 mb-1">{t('detail.contact')}</div>
                  <div className="text-sm text-gray-600">{submission.submitted_by}</div>
                </div>
              </div>
            )}
          </div>

          {/* Version History */}
          {hasVersionHistory && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">{t('detail.versionHistory')}</h3>
                <span className="ml-auto text-sm text-gray-500">
                  {relatedSubmissions.length} {relatedSubmissions.length === 1 ? t('detail.report') : t('detail.reports')}
                </span>
              </div>

              <div className="relative">
                {relatedSubmissions.map((relatedSubmission, index) => {
                  const isCurrentSubmission = relatedSubmission.id === submission.id;
                  const isLatestReport = index === 0;

                  return (
                    <div
                      key={relatedSubmission.id}
                      className={`relative pl-8 pb-4 ${
                        index < relatedSubmissions.length - 1 ? 'border-l-2 border-gray-200' : ''
                      }`}
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-0 w-4 h-4 rounded-full -translate-x-[9px] ${
                          isCurrentSubmission ? 'ring-4 ring-blue-100' : ''
                        }`}
                        style={{ backgroundColor: getDamageDotColor(relatedSubmission.damage_level) }}
                      />

                      <div
                        className={`p-4 rounded-lg ${
                          isCurrentSubmission
                            ? 'bg-blue-50 border-2 border-blue-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-semibold ${
                            isLatestReport ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {isLatestReport
                              ? t('detail.latestReport')
                              : `${t('detail.previousReport')} - ${formatShortDate(relatedSubmission.created_at)}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getDamageDotColor(relatedSubmission.damage_level) }}
                          />
                          <span className={`text-sm font-medium ${
                            isCurrentSubmission ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {t(`submit.damageLevels.${relatedSubmission.damage_level}`).toUpperCase()}
                          </span>
                        </div>

                        <p className={`text-sm ${isCurrentSubmission ? 'text-gray-800' : 'text-gray-600'}`}>
                          {relatedSubmission.description.substring(0, 120)}
                          {relatedSubmission.description.length > 120 ? '...' : ''}
                        </p>

                        <div className="text-xs text-gray-400 mt-2">
                          {formatDate(relatedSubmission.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href={`https://www.google.com/maps?q=${submission.latitude},${submission.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
            >
              {t('detail.viewOnGoogleMaps')}
            </a>
            <a
              href={submission.photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition text-center"
            >
              {t('detail.viewFullImage')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
