// src/components/OfflineQueueStatus.tsx
//
// Small, persistent status indicator (intended for the top-level App
// layout, near the language selector) showing:
//   - current connectivity (online/offline)
//   - how many submissions are queued locally, awaiting sync
//   - a manual "retry" affordance for items that failed repeatedly
//
// This exists so users get HONEST feedback in low-connectivity settings —
// "your report is saved on this device and will send automatically" is a
// materially different (and more trustworthy) experience than a submit
// button that just spins or silently fails.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi, UploadCloud, RefreshCw, AlertCircle } from 'lucide-react';
import {
  getQueuedSubmissions,
  type QueuedSubmission,
} from '../services/offlineQueue';
import { onSyncEvent, flushQueue, retryFailedItem } from '../services/offlineSync';

export default function OfflineQueueStatus() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshQueue = async () => {
    const items = await getQueuedSubmissions();
    setQueue(items);
  };

  useEffect(() => {
    refreshQueue();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onSyncEvent((event) => {
      if (event.type === 'sync_start') setSyncing(true);
      if (event.type === 'sync_complete') {
        setSyncing(false);
        refreshQueue();
      }
      if (event.type === 'item_synced' || event.type === 'item_failed') {
        refreshQueue();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const pendingCount = queue.filter(
    (q) => q.status === 'pending' || q.status === 'syncing'
  ).length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  // Nothing queued and online: render nothing, stay out of the way.
  if (pendingCount === 0 && failedCount === 0 && isOnline) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
          failedCount > 0
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : !isOnline
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        }`}
      >
        {!isOnline ? (
          <WifiOff size={16} />
        ) : syncing ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Wifi size={16} />
        )}
        <span>
          {!isOnline
            ? t('offline.statusOffline')
            : syncing
            ? t('offline.statusSyncing')
            : t('offline.statusOnline')}
        </span>
        {(pendingCount > 0 || failedCount > 0) && (
          <span className="bg-white/80 rounded-full px-2 py-0.5 text-xs font-bold">
            {pendingCount + failedCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-y-auto z-[2000]">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <UploadCloud size={16} />
              <span className="font-semibold">{t('offline.queueTitle')}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {!isOnline ? t('offline.offlineExplainer') : t('offline.onlineExplainer')}
            </p>
          </div>

          {queue.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              {t('offline.noQueuedItems')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {queue.map((item) => (
                <li key={item.localId} className="p-3 flex items-start gap-3">
                  <img
                    src={URL.createObjectURL(item.photoBlob)}
                    alt=""
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {item.location_name || t('offline.unnamedLocation')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {item.status === 'failed' ? (
                        <>
                          <AlertCircle size={12} className="text-red-500" />
                          <span className="text-xs text-red-600">
                            {t('offline.statusFailed')}
                          </span>
                          <button
                            onClick={() => retryFailedItem(item.localId)}
                            className="text-xs text-blue-600 underline ml-2"
                          >
                            {t('offline.retry')}
                          </button>
                        </>
                      ) : item.status === 'syncing' ? (
                        <span className="text-xs text-blue-600">
                          {t('offline.statusItemSyncing')}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">
                          {t('offline.statusItemPending')}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isOnline && queue.some((q) => q.status === 'pending') && (
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={() => flushQueue()}
                disabled={syncing}
                className="w-full text-sm text-center py-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
              >
                {syncing ? t('offline.statusSyncing') : t('offline.syncNow')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
