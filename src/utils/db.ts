import {
  openDB,
  DBSchema,
  IDBPDatabase,
  // IDBPTransaction,
} from "idb";
import { Item, TimingSession, ExportData } from "../types";

// =============================================================================
// Database setup
// =============================================================================
const DB_NAME = "time-tracker-db";
const DB_VERSION = 2;
let dbInstance: IDBPDatabase<TimeTrackerDB> | null = null;

interface TimeTrackerDB extends DBSchema {
  items: {
    key: string;
    value: Item;
  };
  sessions: {
    key: string;
    value: TimingSession;
    indexes: {
      "by-task": string;
      "by-date": number;
    };
  };
}

// =============================================================================
// Database Initialization
// =============================================================================
/** Opens database if it exists, and handles upgrade/creation as needed */
export async function getDB(): Promise<IDBPDatabase<TimeTrackerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<TimeTrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, _tx) {
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("by-task", "taskId");
        store.createIndex("by-date", "createdAt");
      }
    },
  });

  return dbInstance;
}

// =============================================================================
// Item Methods
// =============================================================================
/** Returns a list of all categories/tasks */
export async function getAllItems(): Promise<Item[]> {
  const db = await getDB();
  return db.getAll("items");
}

/** Gets an item by id, if it exists (returns undefined otherwise) */
export async function getItem(id: string): Promise<Item | undefined> {
  const db = await getDB();
  return db.get("items", id);
}

/** Saves an item to the database */
export async function saveItem(item: Item): Promise<void> {
  const db = await getDB();
  await db.put("items", item);
}

/** Deletes an item and all its children (cascade), but does NOT delete
 * associated sessions. */
export async function deleteItem(id: string): Promise<void> {
  const db = await getDB();
  const allItems = await db.getAll("items");
  const idsToDelete = new Set<string>();

  function collectChildren(parentId: string) {
    idsToDelete.add(parentId);
    for (const item of allItems) {
      if (item.parentId === parentId) collectChildren(item.id);
    }
  }

  collectChildren(id);

  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");

  for (const itemId of idsToDelete) {
    await store.delete(itemId);
  }

  await tx.done;
}

// =============================================================================
// Session Methods
// =============================================================================
/** Returns a list of all recorded timing sessions */
export async function getAllSessions(): Promise<TimingSession[]> {
  const db = await getDB();
  return db.getAll("sessions");
}

/** Gets a session by id, if it exists (returns undefined otherwise) */
export async function getSession(id: string): Promise<TimingSession | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

/** Saves a session to the database */
export async function saveSession(session: TimingSession): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

/** Deletes a session by id */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sessions", id);
}

/** Get all sessions for a specific task */
export async function getSessionsByTask(taskId: string): Promise<TimingSession[]> {
  const db = await getDB();
  return db.getAllFromIndex("sessions", "by-task", taskId);
}

/** Delete all sessions for a specific task */
export async function deleteSessionsByTask(taskId: string): Promise<number> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex("sessions", "by-task", taskId);

  const tx = db.transaction("sessions", "readwrite");
  const store = tx.objectStore("sessions");

  for (const session of sessions) {
    await store.delete(session.id);
  }

  await tx.done;
  return sessions.length;
}

// =============================================================================
// Clear / Export Methods
// =============================================================================
/** Deletes all categories/tasks and recorded sessions */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["items", "sessions"], "readwrite");
  await tx.objectStore("items").clear();
  await tx.objectStore("sessions").clear();
  await tx.done;
}

/** Deletes all sessions that were recorded in a specified date range */
export async function clearSessionsInRange(startMs: number, endMs: number): Promise<number> {
  const db = await getDB();
  const allSessions = await db.getAll("sessions");
  const sessionsToDelete = allSessions.filter(session =>
    session.intervals.some(interval => {
      const intervalEnd = interval.end ?? Date.now();
      return interval.start <= endMs && intervalEnd >= startMs;
    })
  );

  const tx = db.transaction("sessions", "readwrite");
  for (const session of sessionsToDelete) {
    await tx.objectStore("sessions").delete(session.id);
  }
  await tx.done;

  return sessionsToDelete.length;
}

/** Prepares data for export */
export async function exportData(): Promise<ExportData> {
  const items = await getAllItems();
  const sessions = await getAllSessions();
  return {
    version: "2.0",
    exportDate: Date.now(),
    items,
    sessions,
  };
}

/** Handles importing data */
export async function importData(data: ExportData): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["items", "sessions"], "readwrite");

  for (const item of data.items) {
    await tx.objectStore("items").put(item);
  }

  for (const session of data.sessions) {
    await tx.objectStore("sessions").put(session);
  }

  await tx.done;
}