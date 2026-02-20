import type { Category, Session, Settings } from '../types';
import { DEFAULT_COLOR } from '../colors';

const DB_NAME = 'timetracker';
const DB_VERSION = 1;

// ─── Open DB ────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('parentId', 'parentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const sessStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessStore.createIndex('taskId', 'taskId', { unique: false });
        sessStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── Generic helpers ────────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = 'readonly'
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return promisify(store.getAll());
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getAllCategories(): Promise<Category[]> {
  const db = await openDB();
  const store = tx(db, 'categories').objectStore('categories');
  return getAll<Category>(store);
}

export async function upsertCategory(cat: Category): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'categories', 'readwrite').objectStore('categories');
  await promisify(store.put(cat));
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'categories', 'readwrite').objectStore('categories');
  await promisify(store.delete(id));
}

export async function deleteCategories(ids: string[]): Promise<void> {
  const db = await openDB();
  const t = tx(db, 'categories', 'readwrite');
  const store = t.objectStore('categories');
  await Promise.all(ids.map((id) => promisify(store.delete(id))));
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getAllSessions(): Promise<Session[]> {
  const db = await openDB();
  const store = tx(db, 'sessions').objectStore('sessions');
  return getAll<Session>(store);
}

export async function upsertSession(session: Session): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'sessions', 'readwrite').objectStore('sessions');
  await promisify(store.put(session));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'sessions', 'readwrite').objectStore('sessions');
  await promisify(store.delete(id));
}

export async function deleteSessionsByTaskIds(taskIds: string[]): Promise<void> {
  const db = await openDB();
  const sessions = await getAllSessions();
  const toDelete = sessions.filter((s) => taskIds.includes(s.taskId));
  const t = tx(db, 'sessions', 'readwrite');
  const store = t.objectStore('sessions');
  await Promise.all(toDelete.map((s) => promisify(store.delete(s.id))));
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  defaultCategoryColor: DEFAULT_COLOR,
  analyticsExcludeZeroDays: true,
  analyticsDefaultEndToday: true,
  analyticsCustomDefaultStart: null,
  analyticsCustomDefaultEnd: null,
};

export async function getSettings(): Promise<Settings> {
  const db = await openDB();
  const store = tx(db, 'settings').objectStore('settings');
  const entries = await getAll<{ key: string; value: unknown }>(store);
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of entries) {
    result[key] = value;
  }
  return (result as unknown) as Settings;
}

export async function saveSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'settings', 'readwrite').objectStore('settings');
  await promisify(store.put({ key, value }));
}

// ─── Import / Export ─────────────────────────────────────────────────────────

export async function exportAllData(): Promise<string> {
  const [categories, sessions, settings] = await Promise.all([
    getAllCategories(),
    getAllSessions(),
    getSettings(),
  ]);
  return JSON.stringify({ categories, sessions, settings }, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    categories?: Category[];
    sessions?: Session[];
    settings?: Partial<Settings>;
  };

  const db = await openDB();

  // Merge categories: add new ones, update existing ones by id (no clearing)
  if (data.categories) {
    const t = tx(db, 'categories', 'readwrite').objectStore('categories');
    await Promise.all(data.categories.map((c) => promisify(t.put(c))));
  }

  // Merge sessions: add new ones, update existing ones by id (no clearing)
  if (data.sessions) {
    const t = tx(db, 'sessions', 'readwrite').objectStore('sessions');
    await Promise.all(data.sessions.map((s) => promisify(t.put(s))));
  }

  // Merge settings: only overwrite keys present in the backup
  if (data.settings) {
    const settingsStore = tx(db, 'settings', 'readwrite').objectStore('settings');
    for (const [key, value] of Object.entries(data.settings)) {
      await promisify(settingsStore.put({ key, value }));
    }
  }
}

export async function deleteAllData(): Promise<void> {
  const db = await openDB();
  await Promise.all([
    promisify(tx(db, 'categories', 'readwrite').objectStore('categories').clear()),
    promisify(tx(db, 'sessions', 'readwrite').objectStore('sessions').clear()),
    promisify(tx(db, 'settings', 'readwrite').objectStore('settings').clear()),
  ]);
}
