import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { fetchBuildingFootprints, BuildingFootprint, MIN_ZOOM } from '../services/buildingFootprints';

interface BuildingFootprintLayerProps {
  map: L.Map | null;
  selectedBuilding: BuildingFootprint | null;
  onSelectBuilding: (building: BuildingFootprint | null) => void;
  enabled?: boolean;
}

export function useBuildingFootprintLayer({
  map,
  selectedBuilding,
  onSelectBuilding,
  enabled = true,
}: BuildingFootprintLayerProps) {
  const { t } = useTranslation();
  const buildingsLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedLayerRef = useRef<L.Polygon | null>(null);
  const loadingRef = useRef<boolean>(false);
  const lastFetchBboxRef = useRef<string>('');
  const loadedBuildingsRef = useRef<BuildingFootprint[]>([]);
  const pendingRequestRef = useRef<boolean>(false);

  const clearBuildings = useCallback(() => {
    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.clearLayers();
    }
    loadedBuildingsRef.current = [];
  }, []);

  const renderBuildings = useCallback(
    (buildings: BuildingFootprint[]) => {
      if (!buildingsLayerRef.current || !map) return;

      const currentZoom = map.getZoom();
      if (currentZoom < MIN_ZOOM) {
        clearBuildings();
        return;
      }

      buildingsLayerRef.current.clearLayers();

      buildings.forEach((building) => {
        const isSelected = selectedBuilding?.id === building.id;
        if (isSelected) return;

        const polygon = L.polygon(building.geometry, {
          color: '#6b7280',
          weight: 1,
          fillColor: '#d1d5db',
          fillOpacity: 0.4,
          className: 'building-footprint',
        });

        polygon.bindTooltip(t('map.clickToSelectBuilding'), {
          permanent: false,
          direction: 'top',
          offset: [0, -5],
        });

        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectBuilding(building);
        });

        polygon.on('mouseover', function () {
          this.setStyle({
            fillColor: '#93c5fd',
            fillOpacity: 0.6,
          });
        });

        polygon.on('mouseout', function () {
          this.setStyle({
            fillColor: '#d1d5db',
            fillOpacity: 0.4,
          });
        });

        polygon.addTo(buildingsLayerRef.current!);
      });

      loadedBuildingsRef.current = buildings;
    },
    [selectedBuilding, onSelectBuilding, clearBuildings, t, map]
  );

  const renderSelectedBuilding = useCallback(() => {
    if (selectedLayerRef.current) {
      selectedLayerRef.current.remove();
      selectedLayerRef.current = null;
    }

    if (selectedBuilding) {
      const polygon = L.polygon(selectedBuilding.geometry, {
        color: '#2563eb',
        weight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.6,
        className: 'selected-building-footprint',
      });

      polygon.bindTooltip(t('map.selectedBuilding'), {
        permanent: false,
        direction: 'top',
        offset: [0, -5],
      });

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectBuilding(null);
      });

      polygon.addTo(map!);
      selectedLayerRef.current = polygon;
    }
  }, [selectedBuilding, map, onSelectBuilding, t]);

  const fetchBuildings = useCallback(async () => {
    if (!map || loadingRef.current || !enabled) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    if (zoom < MIN_ZOOM) {
      clearBuildings();
      return;
    }

    const bboxKey = `${bounds.getSouth().toFixed(3)},${bounds.getWest().toFixed(3)},${bounds.getNorth().toFixed(3)},${bounds.getEast().toFixed(3)}`;

    if (bboxKey === lastFetchBboxRef.current) return;

    loadingRef.current = true;
    pendingRequestRef.current = true;
    lastFetchBboxRef.current = bboxKey;

    const result = await fetchBuildingFootprints(bounds, zoom);

    loadingRef.current = false;
    pendingRequestRef.current = false;

    renderBuildings(result.buildings);
  }, [map, enabled, clearBuildings, renderBuildings]);

  useEffect(() => {
    if (!map) return;

    buildingsLayerRef.current = L.layerGroup().addTo(map);

    const onMoveEnd = () => {
      fetchBuildings();
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    fetchBuildings();

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      if (buildingsLayerRef.current) {
        buildingsLayerRef.current.remove();
      }
      if (selectedLayerRef.current) {
        selectedLayerRef.current.remove();
      }
    };
  }, [map, fetchBuildings]);

  useEffect(() => {
    renderBuildings(loadedBuildingsRef.current);
    renderSelectedBuilding();
  }, [selectedBuilding, renderBuildings, renderSelectedBuilding]);

  return {
    isLoading: loadingRef.current,
    loadedBuildings: loadedBuildingsRef.current,
    fetchBuildings,
    clearBuildings,
  };
}

export function getZoomNotice(zoom: number, minZoom: number = MIN_ZOOM): string | null {
  if (zoom < minZoom) {
    return `Zoom in to level ${minZoom}+ to see building footprints (currently at ${zoom})`;
  }
  return null;
}
