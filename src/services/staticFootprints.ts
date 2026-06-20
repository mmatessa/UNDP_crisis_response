// src/services/staticFootprints.ts
//
// Static fallback for building footprints. Loads a pre-baked GeoJSON file
// (fetched once via fetch-footprints.sh) instead of calling Overpass live.
//
// This exists because public Overpass mirrors (overpass.kumi.systems,
// overpass-api.de, etc.) have no SLA and can 504 unpredictably — unacceptable
// for a live pitch demo or evaluator test. In production, this static layer
// would be replaced by a self-hosted Overpass instance or a licensed source
// like Microsoft Building Footprints / Google Open Buildings.

import type { BuildingFootprint } from './buildingFootprints';

interface StaticGeoJSON {
  type: 'FeatureCollection';
  metadata: {
    source: string;
    region: string;
    fetched_at: string;
    feature_count: number;
  };
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: number[][][] };
    properties: {
      id: number;
      osmId: string;
      tags: Record<string, string>;
      center: [number, number];
    };
  }>;
}

let cachedFootprints: BuildingFootprint[] | null = null;

/**
 * Loads the static GeoJSON file and converts it into the same
 * BuildingFootprint[] shape the live Overpass path produces, so both
 * sources are interchangeable from the caller's perspective.
 */
export async function loadStaticFootprints(): Promise<BuildingFootprint[]> {
  if (cachedFootprints) return cachedFootprints;

  const response = await fetch('/data/gaziantep-footprints.geojson');
  if (!response.ok) {
    throw new Error(`Failed to load static footprints: ${response.status}`);
  }

  const geojson: StaticGeoJSON = await response.json();

  cachedFootprints = geojson.features.map((feature) => ({
    id: feature.properties.id,
    osmId: feature.properties.osmId,
    type: feature.properties.osmId.startsWith('way') ? 'way' : 'relation',
    // Convert GeoJSON [lng, lat] back to the app's internal [lat, lng]
    geometry: feature.geometry.coordinates[0].map(
      ([lon, lat]) => [lat, lon] as [number, number]
    ),
    tags: feature.properties.tags,
    center: feature.properties.center,
  }));

  return cachedFootprints;
}

/**
 * Filters static footprints to those within the given bounds.
 * Mirrors the bbox-filtering behavior of the live Overpass fetch.
 */
export async function fetchStaticFootprintsInBounds(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<BuildingFootprint[]> {
  const all = await loadStaticFootprints();

  return all.filter((building) => {
    const [lat, lng] = building.center;
    return lat >= south && lat <= north && lng >= west && lng <= east;
  });
}
