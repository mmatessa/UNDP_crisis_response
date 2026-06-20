interface BuildingFootprint {
  id: number;
  osmId: string;
  type: 'way' | 'relation';
  geometry: [number, number][];
  tags: Record<string, string>;
  center: [number, number];
}

interface OverpassElement {
  type: string;
  id: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
  members?: Array<{ type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }>;
}

import { fetchStaticFootprintsInBounds } from './staticFootprints';

const CACHE_KEY = 'building_footprints_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MIN_ZOOM = 15;

interface CachedData {
  bboxKey: string;
  buildings: BuildingFootprint[];
  timestamp: number;
}

 const cache = new Map<string, { buildings: BuildingFootprint[]; timestamp: number; isFallback?: boolean }>();

function getBboxKey(bounds: L.LatLngBounds): string {
  return `${bounds.getSouth().toFixed(4)},${bounds.getWest().toFixed(4)},${bounds.getNorth().toFixed(4)},${bounds.getEast().toFixed(4)}`;
}

function parseOverpassResponse(data: OverpassElement[]): BuildingFootprint[] {
  const buildings: BuildingFootprint[] = [];

  for (const element of data) {
    if (element.type === 'way' && element.geometry && element.geometry.length > 2) {
      const geometry: [number, number][] = element.geometry.map((g) => [g.lat, g.lon]);

      const center = element.center
        ? [element.center.lat, element.center.lon] as [number, number]
        : calculateCenter(geometry);

      buildings.push({
        id: element.id,
        osmId: `${element.type}/${element.id}`,
        type: 'way',
        geometry,
        tags: element.tags || {},
        center,
      });
    } else if (element.type === 'relation' && element.members) {
      for (const member of element.members) {
        if (member.geometry && member.geometry.length > 2) {
          const geometry: [number, number][] = member.geometry.map((g) => [g.lat, g.lon]);

          const center = calculateCenter(geometry);

          buildings.push({
            id: element.id,
            osmId: `${element.type}/${element.id}`,
            type: 'relation',
            geometry,
            tags: element.tags || {},
            center,
          });
        }
      }
    }
  }

  return buildings;
}

function calculateCenter(geometry: [number, number][]): [number, number] {
  const sumLat = geometry.reduce((acc, [lat]) => acc + lat, 0);
  const sumLon = geometry.reduce((acc, [, lon]) => acc + lon, 0);
  return [sumLat / geometry.length, sumLon / geometry.length];
}

export async function fetchBuildingFootprints(
  bounds: L.LatLngBounds,
  zoom: number
): Promise<{ buildings: BuildingFootprint[]; error?: string; usingFallback?: boolean }> {
  if (zoom < MIN_ZOOM) {
    return { buildings: [], error: 'zoom_too_low' };
  }
 
  const bboxKey = getBboxKey(bounds);
 
  const cached = cache.get(bboxKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { buildings: cached.buildings, usingFallback: cached.isFallback };
  }
 
  // STEP 1: Try static data first (instant, reliable, no network risk).
  // This always succeeds for areas covered by the static demo file.
  let staticBuildings: BuildingFootprint[] = [];
  try {
    staticBuildings = await fetchStaticFootprintsInBounds(
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast()
    );
  } catch (staticError) {
    console.warn('Static footprint load failed:', staticError);
  }
 
  if (staticBuildings.length > 0) {
    cache.set(bboxKey, { buildings: staticBuildings, timestamp: Date.now(), isFallback: true });
 
    // STEP 2 (best-effort, non-blocking): try live Overpass in the background.
    // If it succeeds, silently upgrade the cache for next time — but don't
    // make the current render wait on it, and don't surface errors to the UI.
    attemptLiveUpgrade(bounds, bboxKey).catch(() => {
      // Swallow errors — this is opportunistic, not required.
    });
 
    return { buildings: staticBuildings, usingFallback: true };
  }
 
  // STEP 3: No static coverage for this area (e.g. user panned away from the
  // demo region) — fall through to a real, blocking live Overpass attempt.
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
    );
    out geom;
  `;
 
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
 
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
 
    clearTimeout(timeoutId);
 
    if (!response.ok) {
      throw new Error(`Overpass returned ${response.status}`);
    }
 
    const data = await response.json();
    const buildings = parseOverpassResponse(data.elements || []);
 
    cache.set(bboxKey, { buildings, timestamp: Date.now(), isFallback: false });
    if (cache.size > 50) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
 
    return { buildings };
  } catch (error) {
    console.warn('Live Overpass fetch failed and no static coverage available:', error);
    return { buildings: [], error: 'network_error' };
  }
}
 
/**
 * Best-effort background upgrade: tries live Overpass and, if it succeeds,
 * replaces the cached entry with real data for next time. Never throws
 * upward, never blocks the caller.
 */
async function attemptLiveUpgrade(bounds: L.LatLngBounds, bboxKey: string): Promise<void> {
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const query = `
    [out:json][timeout:10];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
    );
    out geom;
  `;
 
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
 
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: controller.signal,
  });
 
  clearTimeout(timeoutId);
 
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
 
  const data = await response.json();
  const buildings = parseOverpassResponse(data.elements || []);
 
  if (buildings.length > 0) {
    cache.set(bboxKey, { buildings, timestamp: Date.now(), isFallback: false });
    console.info('Live Overpass data became available, cache upgraded for', bboxKey);
  }
}

export type { BuildingFootprint };
export { MIN_ZOOM };
