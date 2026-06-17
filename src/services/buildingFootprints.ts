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

const CACHE_KEY = 'building_footprints_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MIN_ZOOM = 15;

interface CachedData {
  bboxKey: string;
  buildings: BuildingFootprint[];
  timestamp: number;
}

const cache = new Map<string, { buildings: BuildingFootprint[]; timestamp: number }>();

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
): Promise<{ buildings: BuildingFootprint[]; error?: string }> {
  if (zoom < MIN_ZOOM) {
    return { buildings: [], error: 'zoom_too_low' };
  }

  const bboxKey = getBboxKey(bounds);

  const cached = cache.get(bboxKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { buildings: cached.buildings };
  }

  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  const query = `
    [out:json][timeout:10];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
    );
    out geom;
  `;

  try {
    const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { buildings: [], error: 'rate_limited' };
      }
      return { buildings: [], error: 'network_error' };
    }

    const data = await response.json();
    const buildings = parseOverpassResponse(data.elements || []);

    cache.set(bboxKey, { buildings, timestamp: Date.now() });

    if (cache.size > 50) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    return { buildings };
  } catch (error) {
    console.error('Error fetching building footprints:', error);
    return { buildings: [], error: 'timeout' };
  }
}

export type { BuildingFootprint };
export { MIN_ZOOM };
