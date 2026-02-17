import { useState, useCallback } from 'react';

export type DefaultTimeRange = '7days' | '28days' | '6months' | 'custom';

export interface AnalyticsDefaults {
  timeRange: DefaultTimeRange;
  customStart: string; // YYYY-MM-DD or ''
  customEnd: string;   // YYYY-MM-DD or ''
}

const STORAGE_KEY = 'time-tracker-analytics-defaults';

const DEFAULT_SETTINGS: AnalyticsDefaults = {
  timeRange: '7days',
  customStart: '',
  customEnd: '',
};

function load(): AnalyticsDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(settings: AnalyticsDefaults) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [analyticsDefaults, setAnalyticsDefaultsState] = useState<AnalyticsDefaults>(load);

  const setAnalyticsDefaults = useCallback((next: AnalyticsDefaults) => {
    save(next);
    setAnalyticsDefaultsState(next);
  }, []);

  return { analyticsDefaults, setAnalyticsDefaults };
}
