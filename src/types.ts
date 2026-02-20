// ─── Core Data Types ────────────────────────────────────────────────────────

export type ItemType = 'folder' | 'task';

export interface Category {
  id: string;
  type: ItemType;
  name: string;
  color: string;       // hex string, e.g. "#e05c3a"
  parentId: string | null;
  order: number;       // sort order among siblings
}

export interface TimeInterval {
  start: number;  // UNIX ms
  end: number | null; // null = currently running
}

export interface Session {
  id: string;
  taskId: string;
  intervals: TimeInterval[];
  note?: string;
}

// ─── UI / App State Types ───────────────────────────────────────────────────

export type Screen = 'timing' | 'analytics' | 'categories' | 'settings';

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  theme: Theme;
  defaultCategoryColor: string;    // hex — used as the pre-selected color in the new-item form
  analyticsExcludeZeroDays: boolean;
  analyticsDefaultEndToday: boolean;
  analyticsCustomDefaultStart: string | null; // ISO date string YYYY-MM-DD
  analyticsCustomDefaultEnd: string | null;
}

export type AnalyticsPeriod = '7d' | '28d' | '6m' | 'custom';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// ─── Timer State ────────────────────────────────────────────────────────────

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface ActiveTimer {
  sessionId: string;
  taskId: string;
  status: TimerStatus;
  intervals: TimeInterval[]; // intervals so far (last one may have null end if running)
  elapsedMs: number;         // cumulative elapsed, not counting current running interval
  intervalStart: number | null; // when current interval started (if running)
}
