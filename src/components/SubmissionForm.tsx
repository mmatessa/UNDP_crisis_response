import { useState, useEffect } from 'react';
import { Camera, MapPin, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { DamageLevel } from '../types/database';

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
  const [infrastructureType, setInfrastructureType] = useState('');
  const [locationName, setLocationName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

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

    const { data: { publicUrl } } = supabase.storage
      .from('crisis-images')
      .getPublicUrl(filePath);

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

    setLoading(true);

    try {
      const photoUrl = await uploadPhoto(photoFile);

      const { error } = await supabase.from('crisis_submissions').insert({
        photo_url: photoUrl,
        description,
        damage_level: damageLevel,
        infrastructure_type: infrastructureType,
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

  const infrastructureTypes = [
    'hospital', 'school', 'residential', 'road', 'bridge',
    'water', 'electricity', 'communications', 'other'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900">{t('submit.title')}</h2>

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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('submit.infrastructureType')} <span className="text-red-500">*</span>
        </label>
        <select
          value={infrastructureType}
          onChange={(e) => setInfrastructureType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">{t('submit.selectType')}</option>
          {infrastructureTypes.map((type) => (
            <option key={type} value={type}>{t(`submit.types.${type}`)}</option>
          ))}
        </select>
      </div>

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
            {gettingLocation ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
            <span>{gettingLocation ? t('submit.gettingLocation') : t('submit.updateLocation')}</span>
          </button>
          {coordinates && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p>{t('submit.latitude')}: {coordinates.lat.toFixed(6)}</p>
              <p>{t('submit.longitude')}: {coordinates.lng.toFixed(6)}</p>
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
