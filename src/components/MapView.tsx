import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CrisisSubmission } from '../types/database';
import type { BuildingFootprint } from '../services/buildingFootprints';
import { useBuildingFootprintLayer, getZoomNotice } from './BuildingFootprintLayer';
import { Loader2 } from 'lucide-react';

interface MapViewProps {
  submissions: CrisisSubmission[];
  allSubmissions?: CrisisSubmission[];
  onSelectSubmission: (submission: CrisisSubmission) => void;
  onBuildingSelect?: (building: BuildingFootprint | null) => void;
  selectedBuilding?: BuildingFootprint | null;
  enableBuildingSelection?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  respectInitialView?: boolean;
}

const PROXIMITY_THRESHOLD = 0.0001;

function getReportCount(lat: number, lng: number, allSubmissions: CrisisSubmission[]): number {
  return allSubmissions.filter((s) => {
    const sLat = Number(s.latitude);
    const sLng = Number(s.longitude);
    return Math.abs(lat - sLat) <= PROXIMITY_THRESHOLD && Math.abs(lng - sLng) <= PROXIMITY_THRESHOLD;
  }).length;
}

export default function MapView({
  submissions,
  allSubmissions,
  onSelectSubmission,
  onBuildingSelect,
  selectedBuilding,
  enableBuildingSelection = false,
  initialCenter = [20, 0],
  initialZoom = 2,
  respectInitialView = false,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const [zoom, setZoom] = useState(initialZoom);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasFitBounds = useRef(false);

  const handleBuildingSelect = useCallback(
    (building: BuildingFootprint | null) => {
      if (onBuildingSelect) {
        onBuildingSelect(building);
      }
    },
    [onBuildingSelect]
  );

  useBuildingFootprintLayer({
    map: mapReady ? map.current : null,
    selectedBuilding: selectedBuilding || null,
    onSelectBuilding: handleBuildingSelect,
    enabled: enableBuildingSelection,
    onError: setBuildingError,
  });

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = L.map(mapContainer.current).setView(initialCenter, initialZoom);
setMapReady(true);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);

      map.current.on('zoomend', () => {
        if (map.current) {
          setZoom(map.current.getZoom());
        }
      });

      map.current.on('moveend', () => {
        if (map.current && enableBuildingSelection) {
          setZoom(map.current.getZoom());
        }
      });
    }

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (submissions.length === 0) return;

    const allSubs = allSubmissions || submissions;
    submissions.forEach((submission) => {
      const lat = Number(submission.latitude);
      const lng = Number(submission.longitude);
      const reportCount = getReportCount(lat, lng, allSubs);

      let color = '#eab308';
      if (submission.damage_level === 'partial') color = '#f97316';
      if (submission.damage_level === 'destroyed') color = '#ef4444';

      const badge = reportCount > 1 ? `
        <div class="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-xs font-bold shadow" style="color: ${color}">
          ${reportCount}
        </div>
      ` : '';

      const html = `
        <div class="relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg" style="background-color: ${color}">
          ${reportCount > 1 ? reportCount : ''}
          ${badge}
        </div>
      `;

      const infraLabel = submission.infrastructure_type.startsWith('other:')
        ? submission.infrastructure_type.replace('other: ', '')
        : t(`submit.infrastructureTypes.${submission.infrastructure_type}`, submission.infrastructure_type.replace(/_/g, ' '));

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
            <div class="font-semibold mb-2 text-sm">${infraLabel.toUpperCase()}</div>
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

if (submissions.length > 0 && map.current && !enableBuildingSelection && !respectInitialView && !hasFitBounds.current) {
  const group = new L.FeatureGroup(markers.current);
  map.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 12 });
  hasFitBounds.current = true;
}
}, [submissions, allSubmissions, onSelectSubmission, t, enableBuildingSelection, initialCenter, initialZoom, respectInitialView]);

  const zoomNotice = enableBuildingSelection ? getZoomNotice(zoom) : null;

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-200">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Building footprints zoom notice */}
      {enableBuildingSelection && zoomNotice && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 z-[400] shadow-md">
          <p className="text-sm text-yellow-800">{t('map.zoomNotice')}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoadingBuildings && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg px-4 py-2 z-[400] shadow-md flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span className="text-sm text-gray-700">{t('map.loadingBuildings')}</span>
        </div>
      )}

      {/* Building fetch error */}
      {buildingError && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 rounded-lg px-4 py-2 z-[400] shadow-md">
          <p className="text-sm text-red-800">{t(`map.errors.${buildingError}`)}</p>
        </div>
      )}

      {/* Damage Level Legend */}
      <div className="absolute top-20 right-4 bg-white rounded-lg shadow-lg p-4 z-[400]">
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
        {enableBuildingSelection && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-gray-300 border border-gray-500 rounded-sm"></div>
              <span className="text-xs text-gray-600">{t('map.buildingFootprint')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Reports count */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[400]">
        <div className="text-sm font-semibold text-gray-900">
          {submissions.length} {submissions.length === 1 ? t('map.locations') : t('map.locations_plural')}
        </div>
        {allSubmissions && allSubmissions.length > submissions.length && (
          <div className="text-xs text-gray-600 mt-1">
            {allSubmissions.length} {allSubmissions.length === 1 ? t('map.reports') : t('map.reports_plural')}
          </div>
        )}
      </div>

      {/* Selected building info */}
      {enableBuildingSelection && selectedBuilding && (
        <div className="absolute bottom-4 left-4 bg-blue-50 border border-blue-300 rounded-lg p-3 z-[400] shadow-md max-w-xs">
          <p className="text-xs font-semibold text-blue-900 mb-1">{t('map.selectedBuilding')}</p>
          <p className="text-xs text-blue-800">
            {selectedBuilding.tags.name || selectedBuilding.tags['addr:housenumber'] || `OSM ID: ${selectedBuilding.osmId}`}
          </p>
        </div>
      )}
    </div>
  );
}
