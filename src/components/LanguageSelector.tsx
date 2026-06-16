import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700"
      >
        <Globe size={18} />
        <span className="text-sm font-medium">
          {languages.find(l => l.code === i18n.language)?.nativeName || 'English'}
        </span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[160px]">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition first:rounded-t-lg last:rounded-b-lg ${
              i18n.language === lang.code ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
            }`}
          >
            <span className="font-medium">{lang.nativeName}</span>
            <span className="text-gray-500 ml-2">{lang.name !== lang.nativeName ? lang.name : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
