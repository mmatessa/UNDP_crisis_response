import { useState, useEffect } from 'react';
import { Camera, MapPin, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { DamageLevel, CrisisNature, InfrastructureType } from '../types/database';

interface SubmissionFormProps {
  onSubmitSuccess: () => void;
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
        infrastructure_type: infrastructureType === 'other' ? `other: ${otherInfrastructureType}` : infrastructureType,
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
          <img
            src={photoPreview}
            alt="Preview"
            className="mt-4 max-w-full h-48 object-cover rounded-lg"
          />
        )}
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

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.location')}
        </label>
        <div className="space-y-3">
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={gettingLocation}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            {gettingLocation ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <MapPin size={20} />
            )}
            <span>
              {gettingLocation
                ? t('submit.gettingLocation')
                : t('submit.updateLocation')}
            </span>
          </button>
          {coordinates && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p>
                {t('submit.latitude')}: {coordinates.lat.toFixed(6)}
              </p>
              <p>
                {t('submit.longitude')}: {coordinates.lng.toFixed(6)}
              </p>
            </div>
          )}
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('submit.locationName')}
          />
        </div>
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
