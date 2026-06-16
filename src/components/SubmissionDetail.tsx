import { X, MapPin, Calendar, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CrisisSubmission } from '../types/database';

interface SubmissionDetailProps {
  submission: CrisisSubmission;
  onClose: () => void;
}

export default function SubmissionDetail({ submission, onClose }: SubmissionDetailProps) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full border-2 font-semibold text-sm ${getDamageBadgeClass(submission.damage_level)}`}>
              {t(`submit.damageLevels.${submission.damage_level}`).toUpperCase()} {t('map.damage')}
            </span>
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full border-2 border-blue-300 font-semibold text-sm">
              {t(`submit.types.${submission.infrastructure_type}`, submission.infrastructure_type).toUpperCase()}
            </span>
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
