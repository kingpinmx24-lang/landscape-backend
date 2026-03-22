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
 * Save an image (base64 data URL) to IndexedDB.
 * Falls back to localStorage if IndexedDB is unavailable.
 */
export async function saveImage(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    // Also store a flag in localStorage so we know the image exists in IDB
    try { localStorage.setItem(`idb_flag_${key}`, "1"); } catch {}
  } catch (idbErr) {
    console.warn("[imageStorage] IndexedDB failed, trying localStorage:", idbErr);
    // Fallback: try localStorage with progressively smaller images
    const sizes: Array<[number, number, number]> = [
      [800, 600, 0.5],
      [640, 480, 0.35],
      [480, 360, 0.25],
      [320, 240, 0.2],
    ];
    for (const [w, h, q] of sizes) {
      try {
        const small = await compressToSize(dataUrl, w, h, q);
        localStorage.setItem(key, small);
        return;
      } catch {}
    }
    throw new Error("Cannot save image: storage quota exceeded on all attempts");
  }
}

/**
 * Load an image from IndexedDB (or localStorage fallback).
 * Returns undefined if not found.
 */
export async function loadImage(key: string): Promise<string | undefined> {
  // Try IndexedDB first
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
  // Fallback: localStorage
  const ls = localStorage.getItem(key);
  if (ls && ls.startsWith("data:")) return ls;
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
