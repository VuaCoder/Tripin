export interface ReviewDraft { rating: number; comment: string; files: File[]; updatedAt: number }
const writes = new Map<string, Promise<unknown>>();
const metadataKey = (key: string) => `tripri:review-draft:v1:${key}`;
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Image draft storage unavailable')); return; }
    const request = indexedDB.open('tripri-review-drafts-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function imageOperation(key: string, value?: ReviewDraft | null): Promise<ReviewDraft | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('drafts');
      const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(value, key);
      tx.oncomplete = () => resolve(value === undefined ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
function enqueue(key: string, action: () => Promise<unknown>) {
  const operation = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
  writes.set(key, operation);
  void operation.finally(() => { if (writes.get(key) === operation) writes.delete(key); }).catch(() => undefined);
  return operation;
}
export async function loadReviewDraft(key: string): Promise<ReviewDraft | undefined> {
  let meta: ReviewDraft | undefined;
  try { meta = JSON.parse(localStorage.getItem(metadataKey(key)) ?? 'null') ?? undefined; } catch { /* Broken metadata is ignored. */ }
  let images: ReviewDraft | undefined;
  try { images = await imageOperation(key); } catch { /* Text drafts still work without IndexedDB. */ }
  const value = meta ?? images;
  if (!value || Date.now() - value.updatedAt > 14 * 86400000 || !Number.isInteger(value.rating) || value.rating < 0 || value.rating > 5 || typeof value.comment !== 'string') return undefined;
  return { ...value, files: (images?.files ?? []).filter((file) => file instanceof File).slice(0, 6) };
}
export function saveReviewDraft(key: string, draft: ReviewDraft): void {
  try { localStorage.setItem(metadataKey(key), JSON.stringify({ ...draft, files: undefined })); } catch { /* Quota must not prevent submission. */ }
  void enqueue(key, () => imageOperation(key, draft)).catch(() => undefined);
}
export async function clearReviewDraft(key: string): Promise<void> {
  try { localStorage.removeItem(metadataKey(key)); } catch { /* Storage may be disabled. */ }
  await enqueue(key, () => imageOperation(key, null)).catch(() => undefined);
}
