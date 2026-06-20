import type { CrisisSubmission } from '../types/database';

/**
 * Returns a privacy-safe representation of the optional contact field
 * for use in PUBLIC exports. The raw value may contain a name, phone
 * number, or other personal contact info the submitter chose to share
 * for in-app coordination purposes — it is not intended for
 * redistribution in exported datasets. We surface only whether an
 * attribution was provided, not its contents.
 */
function redactContactInfo(submittedBy: string | null): string {
  return submittedBy ? 'Provided (redacted)' : 'Anonymous';
}

export const exportToCSV = (submissions: CrisisSubmission[]) => {
  const headers = [
    'ID',
    'Date',
    'Infrastructure Category',
    'Infrastructure Name',
    'Damage Level',
    'Crisis Nature',
    'Debris Clearance Required',
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
    s.infrastructure_name || '',
    s.damage_level,
    s.crisis_nature ? s.crisis_nature.join('; ') : '',
    s.debris_clearance_required ? 'Yes' : 'No',
    `"${s.description.replace(/"/g, '""')}"`,
    s.latitude,
    s.longitude,
    s.location_name || '',
    redactContactInfo(s.submitted_by),
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
        category: s.infrastructure_type,
        name: s.infrastructure_name,
        damage_level: s.damage_level,
      },
      crisis_nature: s.crisis_nature,
      debris_clearance_required: s.debris_clearance_required,
      location: {
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        name: s.location_name,
      },
      description: s.description,
      photo_url: s.photo_url,
      submitted_by: redactContactInfo(s.submitted_by),
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
        infrastructure_category: s.infrastructure_type,
        infrastructure_name: s.infrastructure_name,
        damage_level: s.damage_level,
        crisis_nature: s.crisis_nature,
        debris_clearance_required: s.debris_clearance_required,
        description: s.description,
        location_name: s.location_name,
        submitted_by: redactContactInfo(s.submitted_by),
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

export const exportToRAPIDA = (submissions: CrisisSubmission[]) => {
  const damageGradeMap: Record<string, string> = {
    minimal: 'G1',
    partial: 'G3',
    destroyed: 'G5',
  };

  const data = {
    assessment_id: `RAPIDA-${new Date().getFullYear()}-${Date.now()}`,
    assessment_type: 'community_crowdsourced',
    methodology: 'RAPIDA',
    generated_at: new Date().toISOString(),
    total_reports: submissions.length,
    damage_summary: {
      G1_minimal: submissions.filter((s) => s.damage_level === 'minimal').length,
      G3_partial: submissions.filter((s) => s.damage_level === 'partial').length,
      G5_destroyed: submissions.filter((s) => s.damage_level === 'destroyed').length,
    },
    features: submissions.map((s, index) => ({
      rapida_id: `RPD-${String(index + 1).padStart(4, '0')}`,
      timestamp: s.created_at,
      coordinates: {
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      },
      location_name: s.location_name || null,
      damage_grade: damageGradeMap[s.damage_level] || 'G0',
      damage_level_label: s.damage_level,
      infrastructure_class: s.infrastructure_type,
      infrastructure_name: s.infrastructure_name || null,
      crisis_nature: s.crisis_nature || [],
      debris_clearance_required: s.debris_clearance_required,
      description: s.description,
      photo_url: s.photo_url,
      source: 'community_report',
      confidence: 'unverified',
      submitted_by: redactContactInfo(s.submitted_by),
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RAPIDA-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};