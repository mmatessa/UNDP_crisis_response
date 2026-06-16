import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CrisisSubmission } from '../types/database';

interface MapViewProps {
  submissions: CrisisSubmission[];
  onSelectSubmission: (submission: CrisisSubmission) => void;
}

export default function MapView({ submissions, onSelectSubmission }: MapViewProps) {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([20, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);
    }

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (submissions.length === 0) return;

    submissions.forEach((submission) => {
      const lat = Number(submission.latitude);
      const lng = Number(submission.longitude);

      let color = '#eab308';
      if (submission.damage_level === 'partial') color = '#f97316';
      if (submission.damage_level === 'destroyed') color = '#ef4444';

      const html = `
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg" style="background-color: ${color}">
          ${submissions.filter((s) => Number(s.latitude) === lat && Number(s.longitude) === lng).length}
        </div>
      `;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: 'custom-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      })
        .bindPopup(
          `<div class="max-w-xs">
            <div class="font-semibold mb-2 text-sm">${t(`submit.types.${submission.infrastructure_type}`, submission.infrastructure_type).toUpperCase()}</div>
            <div class="text-xs mb-2">${t(`submit.damageLevels.${submission.damage_level}`).toUpperCase()} ${t('map.damage')}</div>
            <div class="text-xs text-gray-600 mb-3">${submission.description.substring(0, 100)}${submission.description.length > 100 ? '...' : ''}</div>
            <button class="w-full bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700">${t('detail.title')}</button>
          </div>`,
          { maxWidth: 300 }
        )
        .on('popupopen', () => {
          const popupButton = document.querySelector('[class*="leaflet-popup"] button');
          if (popupButton) {
            popupButton.addEventListener('click', () => onSelectSubmission(submission));
          }
        })
        .addTo(map.current!);

      markers.current.push(marker);
    });

    if (submissions.length > 0 && map.current) {
      const group = new L.FeatureGroup(markers.current);
      map.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 12 });
    }
  }, [submissions, onSelectSubmission, t]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-200">
      <div ref={mapContainer} className="w-full h-full" />

      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[400]">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t('map.legendTitle')}</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
            <span>{t('submit.damageLevels.minimal')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
            <span>{t('submit.damageLevels.partial')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span>{t('submit.damageLevels.destroyed')}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[400]">
        <div className="text-sm font-semibold text-gray-900">
          {submissions.length} {submissions.length === 1 ? t('map.reports') : t('map.reports_plural')}
        </div>
      </div>
    </div>
  );
}
