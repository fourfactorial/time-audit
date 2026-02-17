export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  type: 'category';
}

export interface Task {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  type: 'task';
}

export type Item = Category | Task;

export interface TimeInterval {
  start: number; // Unix timestamp in ms
  end: number | null; // null if currently running
}

export interface TimingSession {
  id: string;
  taskId: string;
  intervals: TimeInterval[];
  totalMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveTimerState {
  taskId: string;
  taskName: string;
  taskColor: string;
  isRunning: boolean;
  isPaused: boolean;
  elapsedMs: number;
  intervals: TimeInterval[];
  startTimeRef: number;
}

export interface ExportData {
  version: string;
  exportDate: number;
  items: Item[];
  sessions: TimingSession[];
}

export type ViewMode = 'home' | 'category' | 'timer' | 'analytics' | 'manage';

export interface NavigationState {
  mode: ViewMode;
  selectedId?: string;
  breadcrumbs: Array<{ id: string; name: string }>;
}

export type ThemeMode = 'light' | 'dark' | 'system';