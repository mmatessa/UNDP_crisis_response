// src/services/offlineQueue.ts
//
// IndexedDB-backed queue for crisis submissions made while offline.
// Stores the full submission payload (including the photo as a Blob,
// not just a URL, since there's no server to upload to yet) and exposes
// add/list/remove/update operations the sync manager and UI consume.
//
// Design notes:
// - IndexedDB (not localStorage) because localStorage can't store Blobs
//   and has a much smaller storage ceiling — unworkable for photo data.
// - Each queued item carries a client-generated `localId` immediately,
//   so the UI can render a "pending" map marker / list entry right away,
//   before any server round-trip ever happens.
// - This module has zero network code in it — it only knows how to
//   persist and retrieve. Network/sync logic lives in offlineSync.ts.

const DB_NAME = 'crisis-response-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_submissions';

export interface QueuedSubmission {
  localId: string;          // client-generated UUID, stable identity before sync
  createdAt: string;        // ISO timestamp, set at queue-time (not sync-time)
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;

  // Photo, stored as a Blob (not yet uploaded anywhere)
  photoBlob: Blob;
  photoFileName: string;

  // Exact same fields the live handleSubmit sends to crisis_submissions,
  // minus photo_url (which only exists after upload succeeds).
  description: string;
  damage_level: 'minimal' | 'partial' | 'destroyed';
  infrastructure_type: string;
  infrastructure_name: string | null;
  crisis_nature: string[];
  debris_clearance_required: boolean;
  latitude: number;
  longitude: number;
  location_name: string | null;
  submitted_by: string | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateLocalId(): string {
  // crypto.randomUUID is supported in all modern browsers; fall back
  // to a timestamp+random string for older environments.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Adds a new submission to the offline queue. Called when a submit
 * attempt fails due to no connectivity (or proactively, if the app
 * detects it's offline before even trying the network).
 */
export async function queueSubmission(
  data: Omit<QueuedSubmission, 'localId' | 'createdAt' | 'status' | 'retryCount' | 'lastError'>
): Promise<QueuedSubmission> {
  const db = await openDB();
  const item: QueuedSubmission = {
    ...data,
    localId: generateLocalId(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns all queued submissions, most recent first.
 */
export async function getQueuedSubmissions(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const items = request.result as QueuedSubmission[];
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns just the count of pending (not-yet-synced) submissions.
 * Cheap, frequent-poll-friendly version of getQueuedSubmissions().
 */
export async function getPendingCount(): Promise<number> {
  const items = await getQueuedSubmissions();
  return items.filter((i) => i.status === 'pending' || i.status === 'failed').length;
}

/**
 * Removes a submission from the queue — called after a successful sync.
 */
export async function removeQueuedSubmission(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Updates a queued submission's status/retry metadata in place
 * (e.g. marking it 'syncing', or recording a failure + incrementing
 * retryCount) without needing to delete and re-add it.
 */
export async function updateQueuedSubmission(
  localId: string,
  patch: Partial<Pick<QueuedSubmission, 'status' | 'retryCount' | 'lastError'>>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(localId);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as QueuedSubmission | undefined;
      if (!existing) {
        resolve();
        return;
      }
      store.put({ ...existing, ...patch });
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
