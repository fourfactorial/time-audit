import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type {
  ActiveTimer,
  Category,
  Screen,
  Session,
  Settings,
} from '../types';
import { DEFAULT_COLOR } from '../colors';
import * as db from '../db/db';

// ─── State ───────────────────────────────────────────────────────────────────

interface AppState {
  screen: Screen;
  categories: Category[];
  sessions: Session[];
  settings: Settings;
  timer: ActiveTimer | null;
  loaded: boolean;
  // Interrupted session detected on load — user is prompted to resume or close
  interruptedSession: Session | null;
}

const defaultSettings: Settings = {
  theme: 'dark',                    // default to dark mode
  defaultCategoryColor: DEFAULT_COLOR,
  analyticsExcludeZeroDays: true,
  analyticsDefaultEndToday: true,
  analyticsCustomDefaultStart: null,
  analyticsCustomDefaultEnd: null,
};

const initialState: AppState = {
  screen: 'timing',
  categories: [],
  sessions: [],
  settings: defaultSettings,
  timer: null,
  loaded: false,
  interruptedSession: null,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOADED'; categories: Category[]; sessions: Session[]; settings: Settings; interruptedSession: Session | null }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'UPSERT_CATEGORY'; category: Category }
  | { type: 'DELETE_CATEGORY'; id: string }
  | { type: 'UPSERT_SESSION'; session: Session }
  | { type: 'DELETE_SESSION'; id: string }
  | { type: 'DELETE_SESSIONS_BY_TASK_IDS'; taskIds: string[] }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SET_TIMER'; timer: ActiveTimer | null }
  | { type: 'CLEAR_INTERRUPTED' }
  | { type: 'REPLACE_ALL'; categories: Category[]; sessions: Session[]; settings: Settings };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOADED':
      return {
        ...state,
        categories: action.categories,
        sessions: action.sessions,
        settings: action.settings,
        interruptedSession: action.interruptedSession,
        loaded: true,
      };

    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'UPSERT_CATEGORY': {
      const exists = state.categories.some((c) => c.id === action.category.id);
      const categories = exists
        ? state.categories.map((c) => (c.id === action.category.id ? action.category : c))
        : [...state.categories, action.category];
      return { ...state, categories };
    }

    case 'DELETE_CATEGORY':
      return { ...state, categories: state.categories.filter((c) => c.id !== action.id) };

    case 'UPSERT_SESSION': {
      const exists = state.sessions.some((s) => s.id === action.session.id);
      const sessions = exists
        ? state.sessions.map((s) => (s.id === action.session.id ? action.session : s))
        : [...state.sessions, action.session];
      return { ...state, sessions };
    }

    case 'DELETE_SESSION':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.id) };

    case 'DELETE_SESSIONS_BY_TASK_IDS':
      return {
        ...state,
        sessions: state.sessions.filter((s) => !action.taskIds.includes(s.taskId)),
      };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'SET_TIMER':
      return { ...state, timer: action.timer };

    case 'CLEAR_INTERRUPTED':
      return { ...state, interruptedSession: null };

    case 'REPLACE_ALL':
      return {
        ...state,
        categories: action.categories,
        sessions: action.sessions,
        settings: action.settings,
      };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  navigate: (screen: Screen) => void;
  upsertCategory: (cat: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  deleteCategories: (ids: string[]) => Promise<void>;
  deleteSessionsByTaskIds: (taskIds: string[]) => Promise<void>;
  upsertSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  reloadAll: () => Promise<void>;
  // Timer
  startTimer: (taskId: string) => Promise<void>;
  resumeInterrupted: (session: Session) => Promise<void>;
  closeInterrupted: (session: Session) => Promise<void>;
  dismissInterrupted: () => void;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: (save: boolean) => Promise<void>;
  getElapsedMs: () => number;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns the session with an open-ended interval, if any (most recently started). */
function findInterruptedSession(sessions: Session[]): Session | null {
  const interrupted = sessions.filter((s) =>
    s.intervals.some((iv) => iv.end === null)
  );
  if (interrupted.length === 0) return null;
  // Take the one with the most recent open interval start
  return interrupted.sort((a, b) => {
    const aStart = Math.max(...a.intervals.map((iv) => iv.start));
    const bStart = Math.max(...b.intervals.map((iv) => iv.start));
    return bStart - aStart;
  })[0];
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load all data on mount, detect any interrupted sessions
  const reloadAll = useCallback(async () => {
    const [categories, sessions, settings] = await Promise.all([
      db.getAllCategories(),
      db.getAllSessions(),
      db.getSettings(),
    ]);
    const interruptedSession = findInterruptedSession(sessions);
    dispatch({ type: 'LOADED', categories, sessions, settings, interruptedSession });
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Apply theme
  useEffect(() => {
    if (!state.loaded) return;
    const root = document.documentElement;
    const { theme } = state.settings;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [state.settings.theme, state.loaded]);

  const navigate = useCallback((screen: Screen) => {
    dispatch({ type: 'SET_SCREEN', screen });
  }, []);

  const upsertCategory = useCallback(async (cat: Category) => {
    await db.upsertCategory(cat);
    dispatch({ type: 'UPSERT_CATEGORY', category: cat });
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await db.deleteCategory(id);
    dispatch({ type: 'DELETE_CATEGORY', id });
  }, []);

  const deleteCategories = useCallback(async (ids: string[]) => {
    await db.deleteCategories(ids);
    for (const id of ids) dispatch({ type: 'DELETE_CATEGORY', id });
  }, []);

  const deleteSessionsByTaskIds = useCallback(async (taskIds: string[]) => {
    await db.deleteSessionsByTaskIds(taskIds);
    dispatch({ type: 'DELETE_SESSIONS_BY_TASK_IDS', taskIds });
  }, []);

  const upsertSession = useCallback(async (session: Session) => {
    await db.upsertSession(session);
    dispatch({ type: 'UPSERT_SESSION', session });
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await db.deleteSession(id);
    dispatch({ type: 'DELETE_SESSION', id });
  }, []);

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    for (const [key, value] of Object.entries(s)) {
      await db.saveSetting(key as keyof Settings, value as Settings[keyof Settings]);
    }
    dispatch({ type: 'UPDATE_SETTINGS', settings: s });
  }, []);

  // ─── Interrupted session handling ─────────────────────────────────────────

  /**
   * Resume an interrupted session: close the open interval, add a new one
   * starting now, and set the active timer to that session in 'running' state.
   */
  const resumeInterrupted = useCallback(async (session: Session) => {
    const now = Date.now();
    // Close the dangling open interval (treat it as if we paused then)
    const closedIntervals = session.intervals.map((iv) =>
      iv.end === null ? { ...iv, end: now } : iv
    );
    // Add a fresh interval starting now
    const newInterval = { start: now, end: null };
    const newIntervals = [...closedIntervals, newInterval];

    // Compute elapsed from all closed intervals
    const elapsedMs = closedIntervals.reduce(
      (acc, iv) => acc + ((iv.end ?? now) - iv.start),
      0
    );

    const updatedSession: Session = { ...session, intervals: newIntervals };
    await db.upsertSession(updatedSession);
    dispatch({ type: 'UPSERT_SESSION', session: updatedSession });

    const newTimer: ActiveTimer = {
      sessionId: session.id,
      taskId: session.taskId,
      status: 'running',
      intervals: newIntervals,
      elapsedMs,
      intervalStart: now,
    };
    dispatch({ type: 'SET_TIMER', timer: newTimer });
    dispatch({ type: 'CLEAR_INTERRUPTED' });
  }, []);

  /**
   * Close an interrupted session: seal the open interval with the current time,
   * save it, and dismiss the prompt.
   */
  const closeInterrupted = useCallback(async (session: Session) => {
    const now = Date.now();
    const closedIntervals = session.intervals.map((iv) =>
      iv.end === null ? { ...iv, end: now } : iv
    );
    const updatedSession: Session = { ...session, intervals: closedIntervals };
    await db.upsertSession(updatedSession);
    dispatch({ type: 'UPSERT_SESSION', session: updatedSession });
    dispatch({ type: 'CLEAR_INTERRUPTED' });
  }, []);

  /** Just dismiss the prompt without touching the session. */
  const dismissInterrupted = useCallback(() => {
    dispatch({ type: 'CLEAR_INTERRUPTED' });
  }, []);

  // ─── Timer logic ──────────────────────────────────────────────────────────

  const startTimer = useCallback(async (taskId: string) => {
    const now = Date.now();
    const sessionId = genId();
    const interval = { start: now, end: null };
    const newTimer: ActiveTimer = {
      sessionId,
      taskId,
      status: 'running',
      intervals: [interval],
      elapsedMs: 0,
      intervalStart: now,
    };
    const session: Session = {
      id: sessionId,
      taskId,
      intervals: [interval],
    };
    await db.upsertSession(session);
    dispatch({ type: 'UPSERT_SESSION', session });
    dispatch({ type: 'SET_TIMER', timer: newTimer });
  }, []);

  const pauseTimer = useCallback(async () => {
    const { timer } = stateRef.current;
    if (!timer || timer.status !== 'running' || !timer.intervalStart) return;
    const now = Date.now();
    const elapsed = timer.elapsedMs + (now - timer.intervalStart);
    const closedIntervals = timer.intervals.map((iv, i) =>
      i === timer.intervals.length - 1 ? { ...iv, end: now } : iv
    );
    const updated: ActiveTimer = {
      ...timer,
      status: 'paused',
      intervals: closedIntervals,
      elapsedMs: elapsed,
      intervalStart: null,
    };
    const session: Session = {
      id: timer.sessionId,
      taskId: timer.taskId,
      intervals: closedIntervals,
    };
    await db.upsertSession(session);
    dispatch({ type: 'UPSERT_SESSION', session });
    dispatch({ type: 'SET_TIMER', timer: updated });
  }, []);

  const resumeTimer = useCallback(async () => {
    const { timer } = stateRef.current;
    if (!timer || timer.status !== 'paused') return;
    const now = Date.now();
    const newInterval = { start: now, end: null };
    const updated: ActiveTimer = {
      ...timer,
      status: 'running',
      intervals: [...timer.intervals, newInterval],
      intervalStart: now,
    };
    const session: Session = {
      id: timer.sessionId,
      taskId: timer.taskId,
      intervals: updated.intervals,
    };
    await db.upsertSession(session);
    dispatch({ type: 'UPSERT_SESSION', session });
    dispatch({ type: 'SET_TIMER', timer: updated });
  }, []);

  const stopTimer = useCallback(async (save: boolean) => {
    const { timer } = stateRef.current;
    if (!timer) return;
    const now = Date.now();

    if (save) {
      const closedIntervals = timer.intervals.map((iv, i) =>
        i === timer.intervals.length - 1 && iv.end === null ? { ...iv, end: now } : iv
      );
      const session: Session = {
        id: timer.sessionId,
        taskId: timer.taskId,
        intervals: closedIntervals,
      };
      await db.upsertSession(session);
      dispatch({ type: 'UPSERT_SESSION', session });
    } else {
      await db.deleteSession(timer.sessionId);
      dispatch({ type: 'DELETE_SESSION', id: timer.sessionId });
    }

    dispatch({ type: 'SET_TIMER', timer: null });
  }, []);

  const getElapsedMs = useCallback((): number => {
    const { timer } = stateRef.current;
    if (!timer) return 0;
    if (timer.status === 'running' && timer.intervalStart) {
      return timer.elapsedMs + (Date.now() - timer.intervalStart);
    }
    return timer.elapsedMs;
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    navigate,
    upsertCategory,
    deleteCategory,
    deleteCategories,
    deleteSessionsByTaskIds,
    upsertSession,
    deleteSession,
    updateSettings,
    reloadAll,
    startTimer,
    resumeInterrupted,
    closeInterrupted,
    dismissInterrupted,
    pauseTimer,
    resumeTimer,
    stopTimer,
    getElapsedMs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
