import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, Loader2, X, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import type { DamageLevel, CrisisNature, InfrastructureType } from '../types/database';
import type { BuildingFootprint } from '../services/buildingFootprints';
import { fetchBuildingFootprints, MIN_ZOOM } from '../services/buildingFootprints';

interface SubmissionFormProps {
  onSubmitSuccess: () => void;
}

function BuildingSelectionMap({
  selectedBuilding,
  onSelectBuilding,
  coordinates,
}: {
  selectedBuilding: BuildingFootprint | null;
  onSelectBuilding: (building: BuildingFootprint | null) => void;
  coordinates: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const buildingsLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedPolygonRef = useRef<L.Polygon | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const [zoom, setZoom] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedBuildingsRef = useRef<BuildingFootprint[]>([]);
  const lastFetchBboxRef = useRef<string>('');

  const initialCenter: [number, number] = coordinates
    ? [coordinates.lat, coordinates.lng]
    : [20, 0];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, {
      center: initialCenter,
      zoom: coordinates ? 17 : 15,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    buildingsLayerRef.current = L.layerGroup().addTo(map.current);

    map.current.on('zoomend', () => {
      if (map.current) {
        setZoom(map.current.getZoom());
      }
    });

    map.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      onSelectBuilding({
        id: -Date.now(),
        osmId: 'custom',
        type: 'way',
        geometry: [[lat, lng]],
        tags: {},
        center: [lat, lng],
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (map.current && coordinates) {
      map.current.setView([coordinates.lat, coordinates.lng], 17);
    }
  }, [coordinates]);

  useEffect(() => {
    if (!map.current || !buildingsLayerRef.current) return;

    if (currentMarkerRef.current) {
      currentMarkerRef.current.remove();
    }

    if (coordinates && !selectedBuilding) {
      const marker = L.marker([coordinates.lat, coordinates.lng], {
        icon: L.divIcon({
          html: '<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>',
          className: 'gps-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });
      marker.addTo(map.current);
      currentMarkerRef.current = marker;
    }
  }, [coordinates, selectedBuilding]);

  const fetchBuildings = useCallback(async () => {
    if (!map.current || isLoading || zoom < MIN_ZOOM) return;

    const bounds = map.current.getBounds();
    const bboxKey = `${bounds.getSouth().toFixed(3)},${bounds.getWest().toFixed(3)},${bounds.getNorth().toFixed(3)},${bounds.getEast().toFixed(3)}`;

    if (bboxKey === lastFetchBboxRef.current) return;

    setIsLoading(true);
    setError(null);
    lastFetchBboxRef.current = bboxKey;

    const result = await fetchBuildingFootprints(bounds, zoom);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (buildingsLayerRef.current) {
      buildingsLayerRef.current.clearLayers();

      result.buildings.forEach((building) => {
        if (selectedBuilding?.id === building.id) return;

        const polygon = L.polygon(building.geometry, {
          color: '#6b7280',
          weight: 1,
          fillColor: '#d1d5db',
          fillOpacity: 0.4,
        });

        polygon.bindTooltip(t('submit.clickToSelectBuilding'), {
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

      loadedBuildingsRef.current = result.buildings;
    }
  }, [zoom, isLoading, selectedBuilding, onSelectBuilding, t]);

  useEffect(() => {
    if (map.current) {
      fetchBuildings();
    }
  }, [map.current, zoom, fetchBuildings]);

  useEffect(() => {
    if (!map.current) return;

    const onMoveEnd = () => {
      if (map.current && map.current.getZoom() >= MIN_ZOOM) {
        fetchBuildings();
      }
    };

    map.current.on('moveend', onMoveEnd);

    return () => {
      map.current?.off('moveend', onMoveEnd);
    };
  }, [fetchBuildings]);

  useEffect(() => {
    if (selectedPolygonRef.current) {
      selectedPolygonRef.current.remove();
      selectedPolygonRef.current = null;
    }

    if (selectedBuilding && map.current) {
      if (selectedBuilding.geometry.length > 2) {
        const polygon = L.polygon(selectedBuilding.geometry, {
          color: '#2563eb',
          weight: 3,
          fillColor: '#3b82f6',
          fillOpacity: 0.6,
        });

        polygon.bindTooltip(t('submit.selectedBuilding'), {
          permanent: false,
          direction: 'top',
          offset: [0, -5],
        });

        polygon.on('click', () => {
          onSelectBuilding(null);
        });

        polygon.addTo(map.current);
        selectedPolygonRef.current = polygon;

        map.current.fitBounds(polygon.getBounds(), { padding: [50, 50] });
      } else {
        const marker = L.marker(selectedBuilding.center, {
          icon: L.divIcon({
            html: '<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="6"/></svg></div>',
            className: 'selected-point-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        });

        marker.addTo(map.current);
        selectedPolygonRef.current = marker as unknown as L.Polygon;
      }
    }
  }, [selectedBuilding, t, onSelectBuilding]);

  const zoomNotice = zoom < MIN_ZOOM ? t('submit.zoomNotice', { minZoom: MIN_ZOOM }) : null;

  return (
    <div className="relative w-full h-64 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
      <div ref={mapContainer} className="w-full h-full" />

      {zoomNotice && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-300 rounded px-3 py-1 z-[1000] shadow">
          <p className="text-xs text-yellow-800">{zoomNotice}</p>
        </div>
      )}

      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded px-3 py-1 z-[1000] shadow flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-blue-600" />
          <span className="text-xs">{t('submit.loadingBuildings')}</span>
        </div>
      )}

      {error && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-300 rounded px-3 py-1 z-[1000] shadow">
          <p className="text-xs text-red-800">{t(`submit.buildingError.${error}`)}</p>
        </div>
      )}

      {selectedBuilding && (
        <div className="absolute top-2 left-2 bg-blue-50 border border-blue-300 rounded px-3 py-2 z-[1000] shadow max-w-[200px]">
          <p className="text-xs font-semibold text-blue-900">{t('submit.selectedBuildingLabel')}</p>
          <p className="text-xs text-blue-800 truncate">
            {selectedBuilding.tags.name ||
              selectedBuilding.tags['addr:housenumber'] ||
              (selectedBuilding.osmId === 'custom'
                ? t('submit.customLocation')
                : `OSM: ${selectedBuilding.osmId}`)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SubmissionForm({ onSubmitSuccess }: SubmissionFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [description, setDescription] = useState('');
  const [damageLevel, setDamageLevel] = useState<DamageLevel>('minimal');
  const [infrastructureType, setInfrastructureType] = useState<InfrastructureType | ''>('');
  const [otherInfrastructureType, setOtherInfrastructureType] = useState('');
  const [infrastructureName, setInfrastructureName] = useState('');
  const [crisisNature, setCrisisNature] = useState<CrisisNature[]>([]);
  const [debrisClearanceRequired, setDebrisClearanceRequired] = useState<boolean | null>(null);
  const [locationName, setLocationName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingFootprint | null>(null);

  const infrastructureTypes: InfrastructureType[] = [
    'residential_infrastructure',
    'commercial_infrastructure',
    'government_building',
    'utility_infrastructure',
    'transport_communication_infrastructure',
    'community_infrastructure',
    'public_spaces_recreation_infrastructure',
    'other',
  ];

  const crisisNatureOptions: { category: string; options: CrisisNature[] }[] = [
    {
      category: 'natural',
      options: ['earthquake', 'flood', 'tsunami', 'hurricane_cyclone', 'wildfire'],
    },
    {
      category: 'technological',
      options: ['explosion', 'chemical_incident'],
    },
    {
      category: 'human_made',
      options: ['conflict', 'civil_unrest'],
    },
  ];

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert(t('submit.locationError'));
          setGettingLocation(false);
        }
      );
    } else {
      alert(t('submit.geolocationNotSupported'));
      setGettingLocation(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const handleBuildingSelect = useCallback((building: BuildingFootprint | null) => {
    setSelectedBuilding(building);
    if (building && building.center) {
      setCoordinates({
        lat: building.center[0],
        lng: building.center[1],
      });
      if (building.tags.name) {
        setLocationName(building.tags.name);
      } else if (building.tags['addr:street']) {
        const addr = [
          building.tags['addr:housenumber'],
          building.tags['addr:street'],
          building.tags['addr:city'],
        ]
          .filter(Boolean)
          .join(', ');
        if (addr) setLocationName(addr);
      }
    }
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCrisisNature = (option: CrisisNature) => {
    setCrisisNature((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `crisis-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('crisis-images')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('crisis-images').getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photoFile) {
      alert(t('submit.photoRequired'));
      return;
    }

    if (!coordinates) {
      alert(t('submit.locationRequired'));
      return;
    }

    if (!infrastructureType) {
      alert(t('submit.infrastructureTypeRequired'));
      return;
    }

    if (infrastructureType === 'other' && !otherInfrastructureType.trim()) {
      alert(t('submit.otherInfrastructureRequired'));
      return;
    }

    if (crisisNature.length === 0) {
      alert(t('submit.crisisNatureRequired'));
      return;
    }

    if (debrisClearanceRequired === null) {
      alert(t('submit.debrisClearanceRequired'));
      return;
    }

    setLoading(true);

    try {
      const photoUrl = await uploadPhoto(photoFile);

      const { error } = await supabase.from('crisis_submissions').insert({
        photo_url: photoUrl,
        description,
        damage_level: damageLevel,
        infrastructure_type:
          infrastructureType === 'other' ? `other: ${otherInfrastructureType}` : infrastructureType,
        infrastructure_name: infrastructureName || null,
        crisis_nature: crisisNature,
        debris_clearance_required: debrisClearanceRequired,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        location_name: locationName || null,
        submitted_by: submittedBy || null,
      });

      if (error) throw error;

      alert(t('submit.successMessage'));

      setPhotoFile(null);
      setPhotoPreview('');
      setDescription('');
      setDamageLevel('minimal');
      setInfrastructureType('');
      setOtherInfrastructureType('');
      setInfrastructureName('');
      setCrisisNature([]);
      setDebrisClearanceRequired(null);
      setLocationName('');
      setSubmittedBy('');
      setSelectedBuilding(null);

      onSubmitSuccess();
    } catch (error) {
      console.error('Error submitting:', error);
      alert(t('submit.submitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900">{t('submit.title')}</h2>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.photoLabel')} <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
            <Camera size={20} />
            <span>{t('submit.uploadPhoto')}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              required
            />
          </label>
        </div>
        {photoPreview && (
          <img src={photoPreview} alt="Preview" className="mt-4 max-w-full h-48 object-cover rounded-lg" />
        )}
      </div>

      {/* Building / Location Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.buildingLocationLabel')} <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">{t('submit.buildingLocationHelp')}</p>
        <BuildingSelectionMap
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleBuildingSelect}
          coordinates={coordinates}
        />

        {/* GPS Fallback */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={gettingLocation}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50"
          >
            {gettingLocation ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MapPin size={16} />
            )}
            <span>{gettingLocation ? t('submit.gettingLocation') : t('submit.useGPS')}</span>
          </button>

          {selectedBuilding && (
            <button
              type="button"
              onClick={() => {
                setSelectedBuilding(null);
                if (coordinates) {
                  getCurrentLocation();
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
              <X size={14} />
              <span>{t('submit.clearBuilding')}</span>
            </button>
          )}
        </div>

        {/* Coordinates display */}
        {coordinates && (
          <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Building size={14} className="text-blue-600" />
              <span className="font-medium">{t('submit.currentCoordinates')}</span>
            </div>
            <p>
              {t('submit.latitude')}: {coordinates.lat.toFixed(6)}, {t('submit.longitude')}:{' '}
              {coordinates.lng.toFixed(6)}
            </p>
            {selectedBuilding && (
              <p className="text-xs text-blue-600 mt-1">
                {t('submit.osmId')}: {selectedBuilding.osmId}
              </p>
            )}
          </div>
        )}

        {/* Location name input */}
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          className="mt-3 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('submit.locationName')}
        />
      </div>

      {/* Infrastructure Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.infrastructureType')} <span className="text-red-500">*</span>
        </label>
        <select
          value={infrastructureType}
          onChange={(e) => setInfrastructureType(e.target.value as InfrastructureType)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">{t('submit.selectType')}</option>
          {infrastructureTypes.map((type) => (
            <option key={type} value={type}>
              {t(`submit.infrastructureTypes.${type}`)}
            </option>
          ))}
        </select>
        {infrastructureType === 'other' && (
          <input
            type="text"
            value={otherInfrastructureType}
            onChange={(e) => setOtherInfrastructureType(e.target.value)}
            className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('submit.otherInfrastructurePlaceholder')}
            required
          />
        )}
      </div>

      {/* Infrastructure Name/Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.infrastructureNameLabel')}
        </label>
        <input
          type="text"
          value={infrastructureName}
          onChange={(e) => setInfrastructureName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('submit.infrastructureNamePlaceholder')}
        />
      </div>

      {/* Damage Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.damageLevel')} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['minimal', 'partial', 'destroyed'] as DamageLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDamageLevel(level)}
              className={`px-4 py-3 rounded-lg border-2 font-medium transition ${
                damageLevel === level
                  ? level === 'minimal'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                    : level === 'partial'
                    ? 'border-orange-500 bg-orange-50 text-orange-900'
                    : 'border-red-500 bg-red-50 text-red-900'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {t(`submit.damageLevels.${level}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Nature of Crisis */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.crisisNatureLabel')} <span className="text-red-500">*</span>
        </label>
        <div className="space-y-4">
          {crisisNatureOptions.map(({ category, options }) => (
            <div key={category}>
              <p className="text-sm font-semibold text-gray-600 mb-2">
                {t(`submit.crisisNatureCategory.${category}`)}
              </p>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleCrisisNature(option)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      crisisNature.includes(option)
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t(`submit.crisisNatureOptions.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {crisisNature.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {crisisNature.map((nature) => (
              <span
                key={nature}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {t(`submit.crisisNatureOptions.${nature}`)}
                <button
                  type="button"
                  onClick={() => toggleCrisisNature(nature)}
                  className="hover:text-blue-600"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Debris Clearance Required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.debrisClearanceLabel')} <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setDebrisClearanceRequired(true)}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              debrisClearanceRequired === true
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {t('submit.yes')}
          </button>
          <button
            type="button"
            onClick={() => setDebrisClearanceRequired(false)}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              debrisClearanceRequired === false
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {t('submit.no')}
          </button>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.description')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('submit.descriptionPlaceholder')}
          required
        />
      </div>

      {/* Contact */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.contactLabel')}
        </label>
        <input
          type="text"
          value={submittedBy}
          onChange={(e) => setSubmittedBy(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('submit.contactPlaceholder')}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>{t('submit.submitting')}</span>
          </>
        ) : (
          <span>{t('submit.submitReport')}</span>
        )}
      </button>
    </form>
  );
}
