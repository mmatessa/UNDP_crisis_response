import type { CrisisSubmission } from '../types/database';

export const exportToCSV = (submissions: CrisisSubmission[]) => {
  const headers = [
    'ID',
    'Date',
    'Infrastructure Type',
    'Damage Level',
    'Description',
    'Latitude',
    'Longitude',
    'Location Name',
    'Submitted By',
    'Photo URL',
  ];

  const rows = submissions.map((s) => [
    s.id,
    new Date(s.created_at).toISOString(),
    s.infrastructure_type,
    s.damage_level,
    `"${s.description.replace(/"/g, '""')}"`,
    s.latitude,
    s.longitude,
    s.location_name || '',
    s.submitted_by || '',
    s.photo_url,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crisis-submissions-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJSON = (submissions: CrisisSubmission[]) => {
  const data = {
    export_date: new Date().toISOString(),
    total_submissions: submissions.length,
    submissions: submissions.map((s) => ({
      id: s.id,
      timestamp: s.created_at,
      infrastructure: {
        type: s.infrastructure_type,
        damage_level: s.damage_level,
      },
      location: {
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        name: s.location_name,
      },
      description: s.description,
      photo_url: s.photo_url,
      submitted_by: s.submitted_by,
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crisis-submissions-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToGeoJSON = (submissions: CrisisSubmission[]) => {
  const geojson = {
    type: 'FeatureCollection',
    features: submissions.map((s) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(s.longitude), Number(s.latitude)],
      },
      properties: {
        id: s.id,
        timestamp: s.created_at,
        infrastructure_type: s.infrastructure_type,
        damage_level: s.damage_level,
        description: s.description,
        location_name: s.location_name,
        submitted_by: s.submitted_by,
        photo_url: s.photo_url,
      },
    })),
  };

  const json = JSON.stringify(geojson, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crisis-submissions-${new Date().toISOString().split('T')[0]}.geojson`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
