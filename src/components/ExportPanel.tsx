import { Download, FileJson, FileSpreadsheet, Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportToCSV, exportToJSON, exportToGeoJSON } from '../utils/exportData';
import type { CrisisSubmission } from '../types/database';
import { exportToCSV, exportToJSON, exportToGeoJSON, exportToRAPIDA } from '../utils/exportData';

interface ExportPanelProps {
  submissions: CrisisSubmission[];
}

export default function ExportPanel({ submissions }: ExportPanelProps) {
  const { t } = useTranslation();

  const handleExport = (format: 'csv' | 'json' | 'geojson') => {
    if (submissions.length === 0) {
      alert(t('export.noData'));
      return;
    }

    switch (format) {
      case 'csv':
        exportToCSV(submissions);
        break;
      case 'json':
        exportToJSON(submissions);
        break;
      case 'geojson':
        exportToGeoJSON(submissions);
        break;
      case 'rapida':
        exportToRAPIDA(submissions);
        break;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Download className="text-blue-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">{t('export.title')}</h2>
      </div>

      <div className="space-y-4">
        <p className="text-gray-600 mb-6">
          {t('export.description')}
        </p>

        <button
          onClick={() => handleExport('csv')}
          className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
        >
          <FileSpreadsheet className="text-green-600 group-hover:text-blue-600" size={24} />
          <div className="text-left flex-1">
            <div className="font-semibold text-gray-900">{t('export.csvTitle')}</div>
            <div className="text-sm text-gray-600">{t('export.csvDesc')}</div>
          </div>
        </button>

        <button
          onClick={() => handleExport('json')}
          className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
        >
          <FileJson className="text-blue-600 group-hover:text-blue-600" size={24} />
          <div className="text-left flex-1">
            <div className="font-semibold text-gray-900">{t('export.jsonTitle')}</div>
            <div className="text-sm text-gray-600">{t('export.jsonDesc')}</div>
          </div>
        </button>

        <button
          onClick={() => handleExport('geojson')}
          className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
        >
          <Map className="text-red-600 group-hover:text-blue-600" size={24} />
          <div className="text-left flex-1">
            <div className="font-semibold text-gray-900">{t('export.geojsonTitle')}</div>
            <div className="text-sm text-gray-600">{t('export.geojsonDesc')}</div>
          </div>
        </button>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <div className="flex justify-between mb-2">
              <span>{t('export.totalSubmissions')}:</span>
              <span className="font-semibold">{submissions.length}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>{t('export.minimalDamage')}:</span>
              <span className="font-semibold text-yellow-600">
                {submissions.filter((s) => s.damage_level === 'minimal').length}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span>{t('export.partialDamage')}:</span>
              <span className="font-semibold text-orange-600">
                {submissions.filter((s) => s.damage_level === 'partial').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('export.destroyed')}:</span>
              <span className="font-semibold text-red-600">
                {submissions.filter((s) => s.damage_level === 'destroyed').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
