/**
 * imageStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent image storage using IndexedDB (no size limit on iOS Safari).
 * Falls back to localStorage for environments where IndexedDB is unavailable.
 *
 * iOS Safari localStorage limit: ~5 MB total
 * iOS Safari IndexedDB limit: up to 50% of available disk space
 */

const DB_NAME = "landscape_images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

/**
 * Save an image (base64 data URL) to IndexedDB + sessionStorage + localStorage.
 * Multiple layers ensure the image is always available.
 */
export async function saveImage(key: string, dataUrl: string): Promise<void> {
  // Layer 1: sessionStorage (fast, reliable within session, survives navigation)
  try { sessionStorage.setItem(key, dataUrl); } catch {}

  // Layer 2: localStorage (persists across sessions)
  try { localStorage.setItem(key, dataUrl); } catch {}

  // Layer 3: IndexedDB (primary, no size limit)
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (idbErr) {
    console.warn("[imageStorage] IndexedDB save failed (sessionStorage used as backup):", idbErr);
  }
}

/**
 * Load an image from IndexedDB → sessionStorage → localStorage.
 * Returns undefined if not found in any layer.
 */
export async function loadImage(key: string): Promise<string | undefined> {
  // Try IndexedDB first (primary)
  try {
    const db = await openDB();
    const result = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result && result.startsWith("data:")) return result;
  } catch (idbErr) {
    console.warn("[imageStorage] IndexedDB read failed:", idbErr);
  }
  // Fallback: sessionStorage (reliable within session)
  try {
    const ss = sessionStorage.getItem(key);
    if (ss && ss.startsWith("data:")) return ss;
  } catch {}
  // Fallback: localStorage
  try {
    const ls = localStorage.getItem(key);
    if (ls && ls.startsWith("data:")) return ls;
  } catch {}
  return undefined;
}

/**
 * Delete an image from both IndexedDB and localStorage.
 */
export async function deleteImage(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
    });
    db.close();
  } catch {}
  try { sessionStorage.removeItem(key); } catch {}
  try { localStorage.removeItem(key); } catch {}
  try { localStorage.removeItem(`idb_flag_${key}`); } catch {}
}

/**
 * Compress a base64 image to a maximum width/height and quality.
 */
export function compressToSize(
  dataUrl: string,
  maxW: number,
  maxH: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        } else {
          if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}
