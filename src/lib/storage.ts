import type { ArtAsset, ArtLibrary, BackgroundImage } from "../types";

// Form state in localStorage, images in IndexedDB. Storage failures are ignored.

const STATE_KEY = "fgc-graphics:state:v1";

export function loadState<T>(): T | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveState<T>(state: T): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const DB_NAME = "fgc-graphics";
const STORE = "art";
const BG_STORE = "background";
const BG_KEY = "current";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      // v2 adds the background store
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        for (const name of [STORE, BG_STORE]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadArt(): Promise<ArtLibrary> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const out: ArtLibrary = {};
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          out[String(cur.key)] = cur.value as ArtAsset;
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve({});
    }
  });
}

export async function putArt(key: string, asset: ArtAsset | null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    if (asset) store.put(asset, key);
    else store.delete(key);
  } catch {
    /* ignore */
  }
}

export async function loadBackground(): Promise<BackgroundImage | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(BG_STORE, "readonly").objectStore(BG_STORE).get(BG_KEY);
      req.onsuccess = () => resolve((req.result as BackgroundImage | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putBackground(bg: BackgroundImage | null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(BG_STORE, "readwrite").objectStore(BG_STORE);
    if (bg) store.put(bg, BG_KEY);
    else store.delete(BG_KEY);
  } catch {
    /* ignore */
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
