import { useState, useEffect } from 'react';
import { AlertCircle, Map, Upload, Download, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './i18n';

const rtlLanguages = ['ar'];
import { supabase } from './lib/supabase';
import type { CrisisSubmission } from './types/database';
import SubmissionForm from './components/SubmissionForm';
import MapView from './components/MapView';
import SubmissionDetail from './components/SubmissionDetail';
import ExportPanel from './components/ExportPanel';
import LanguageSelector from './components/LanguageSelector';

type Tab = 'submit' | 'map' | 'export';

function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('submit');
  const [submissions, setSubmissions] = useState<CrisisSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<CrisisSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isRtl = rtlLanguages.includes(i18n.language);
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('crisis_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();

    const channel = supabase
      .channel('crisis_submissions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crisis_submissions',
        },
        () => {
          loadSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const tabs = [
    { id: 'submit' as Tab, label: t('nav.submit'), icon: Upload },
    { id: 'map' as Tab, label: t('nav.map'), icon: Map },
    { id: 'export' as Tab, label: t('nav.export'), icon: Download },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-lg">
                <Shield className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {t('app.title')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {t('app.subtitle')}
                </p>
              </div>
            </div>
            <LanguageSelector />
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold transition border-b-2 ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('loading')}</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'submit' && (
              <div className="max-w-2xl mx-auto">
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">{t('submit.helpTitle')}</p>
                    <p>
                      {t('submit.helpText')}
                    </p>
                  </div>
                </div>
                <SubmissionForm onSubmitSuccess={loadSubmissions} />
              </div>
            )}

            {activeTab === 'map' && (
              <div className="h-[calc(100vh-280px)] min-h-[600px]">
                <MapView
                  submissions={submissions}
                  onSelectSubmission={setSelectedSubmission}
                />
              </div>
            )}

            {activeTab === 'export' && (
              <div className="max-w-2xl mx-auto">
                <ExportPanel submissions={submissions} />
              </div>
            )}
          </>
        )}
      </main>

      {selectedSubmission && (
        <SubmissionDetail
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600 text-sm">
            <p className="mb-2">
              {t('app.poweredBy')}
            </p>
            <p className="text-gray-500">
              {t('app.openSource')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
