// src/services/offlineSync.ts
//
// Watches for connectivity and flushes the offline queue (offlineQueue.ts)
// to Supabase when a connection is available. Designed to be called from
// a single place at app startup (App.tsx), not per-component, so there's
// exactly one sync loop running regardless of how many tabs/components
// are mounted.
//
// Sync strategy:
// - Try immediately on startup (in case items were queued in a previous
//   offline session and the app has since reconnected).
// - Listen for the browser's 'online' event and try again when it fires.
// - Also poll periodically as a fallback, since 'online' events are not
//   100% reliable across all browsers/network conditions (e.g. captcaptive
//   portals, flaky wifi that doesn't fully drop the OS-level connection).
// - Process one item at a time, sequentially, so a single failure doesn't
//   abandon the rest of the queue and so upload bandwidth isn't split
//   across many simultaneous large image uploads on a recovering, possibly
//   still-weak connection.

import { supabase } from '../lib/supabase';
import {
  getQueuedSubmissions,
  removeQueuedSubmission,
  updateQueuedSubmission,
  type QueuedSubmission,
} from './offlineQueue';

const POLL_INTERVAL_MS = 30_000; // fallback poll, in addition to 'online' event
const MAX_RETRY_COUNT = 5;

type SyncListener = (event: {
  type: 'sync_start' | 'item_synced' | 'item_failed' | 'sync_complete';
  localId?: string;
}) => void;

let listeners: SyncListener[] = [];
let isSyncing = false;

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify(event: Parameters<SyncListener>[0]) {
  listeners.forEach((l) => l(event));
}

async function uploadPhotoBlob(blob: Blob, fileName: string): Promise<string> {
  const filePath = `crisis-photos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('crisis-images')
    .upload(filePath, blob);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('crisis-images').getPublicUrl(filePath);

  return publicUrl;
}

async function syncOneSubmission(item: QueuedSubmission): Promise<void> {
  await updateQueuedSubmission(item.localId, { status: 'syncing' });

  try {
    const photoUrl = await uploadPhotoBlob(item.photoBlob, item.photoFileName);

    const { error } = await supabase.from('crisis_submissions').insert({
      photo_url: photoUrl,
      description: item.description,
      damage_level: item.damage_level,
      infrastructure_type: item.infrastructure_type,
      infrastructure_name: item.infrastructure_name,
      crisis_nature: item.crisis_nature,
      debris_clearance_required: item.debris_clearance_required,
      latitude: item.latitude,
      longitude: item.longitude,
      location_name: item.location_name,
      submitted_by: item.submitted_by,
      // Preserve the ORIGINAL capture time, not the sync time, since that's
      // when the observation was actually made — important for crisis
      // response triage, where "when did this damage occur/get observed"
      // matters more than "when did the upload finally succeed."
      created_at: item.createdAt,
    });

    if (error) throw error;

    await removeQueuedSubmission(item.localId);
    notify({ type: 'item_synced', localId: item.localId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    const nextRetryCount = item.retryCount + 1;

    await updateQueuedSubmission(item.localId, {
      status: nextRetryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending',
      retryCount: nextRetryCount,
      lastError: message,
    });

    notify({ type: 'item_failed', localId: item.localId });
    throw err;
  }
}

/**
 * Attempts to sync all pending queued submissions, one at a time.
 * Safe to call repeatedly/redundantly — it no-ops if a sync is already
 * in progress, and skips items already marked 'syncing' or permanently
 * 'failed' (exceeded MAX_RETRY_COUNT).
 */
export async function flushQueue(): Promise<void> {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isSyncing = true;
  notify({ type: 'sync_start' });

  try {
    const items = await getQueuedSubmissions();
    const toSync = items.filter(
      (i) => i.status === 'pending' && i.retryCount < MAX_RETRY_COUNT
    );

    for (const item of toSync) {
      try {
        await syncOneSubmission(item);
      } catch {
        // Continue to the next item even if this one failed —
        // one bad record shouldn't block the rest of the queue.
      }
    }
  } finally {
    isSyncing = false;
    notify({ type: 'sync_complete' });
  }
}

let pollHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the background sync loop. Call this ONCE, at app startup
 * (e.g. in App.tsx's top-level useEffect). Returns a cleanup function.
 */
export function startOfflineSync(): () => void {
  // Try immediately, in case items were queued in a prior session.
  flushQueue();

  const handleOnline = () => flushQueue();
  window.addEventListener('online', handleOnline);

  pollHandle = setInterval(flushQueue, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener('online', handleOnline);
    if (pollHandle) clearInterval(pollHandle);
  };
}

/**
 * Manually retries a specific failed item (e.g. user taps "retry" on
 * a queue item that exceeded MAX_RETRY_COUNT). Resets its retry count
 * so it's eligible for the normal flush cycle again.
 */
export async function retryFailedItem(localId: string): Promise<void> {
  await updateQueuedSubmission(localId, { status: 'pending', retryCount: 0 });
  flushQueue();
}
