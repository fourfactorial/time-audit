import type { Category, Session } from '../types';

export interface DayData {
  date: string; // YYYY-MM-DD
  totalMs: number;
  byTask: Record<string, number>; // taskId -> ms
}

/** Format ms duration as human readable */
export function fmtDuration(ms: number, compact = false): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (compact) {
    if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Returns YYYY-MM-DD in local time for a timestamp */
export function toLocalDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Returns all dates in range [start, end] as YYYY-MM-DD strings */
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (cur <= endDate) {
    dates.push(toLocalDate(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Returns ms overlap of interval [a,b] with [c,d] */
function overlap(a: number, b: number, c: number, d: number): number {
  return Math.max(0, Math.min(b, d) - Math.max(a, c));
}

/** Gets the start/end timestamps for a given YYYY-MM-DD in local time */
function dayBounds(date: string): [number, number] {
  const start = new Date(date + 'T00:00:00').getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return [start, end];
}

/** Aggregates sessions into per-day data */
export function aggregateToDays(
  sessions: Session[],
  dateStart: string,
  dateEnd: string
): DayData[] {
  const dates = dateRange(dateStart, dateEnd);
  return dates.map((date) => {
    const [dayStart, dayEnd] = dayBounds(date);
    const byTask: Record<string, number> = {};
    let totalMs = 0;

    for (const session of sessions) {
      for (const iv of session.intervals) {
        if (iv.end === null) continue;
        const ms = overlap(iv.start, iv.end, dayStart, dayEnd);
        if (ms <= 0) continue;
        byTask[session.taskId] = (byTask[session.taskId] ?? 0) + ms;
        totalMs += ms;
      }
    }

    return { date, totalMs, byTask };
  });
}

/** Given a set of selected category IDs and tree structure, compute "effective" task map.
 * Returns effectiveTaskId -> displayCategoryId */
export function computeEffectiveDisplay(
  categories: Category[],
  selectedIds: Set<string>
): Map<string, string> {
  const map = new Map<string, string>();
  const tasks = categories.filter((c) => c.type === 'task');

  for (const task of tasks) {
    // Walk up the hierarchy to find the closest selected ancestor (or self)
    let cur: string | null = task.id;
    let chosen: string | null = null;
    while (cur !== null) {
      if (selectedIds.has(cur)) {
        chosen = cur;
        break;
      }
      const cat = categories.find((c) => c.id === cur);
      cur = cat?.parentId ?? null;
    }
    if (chosen) map.set(task.id, chosen);
  }

  return map;
}

/** Merge dayData using effective display mapping */
export function mergeDayDataWithDisplay(
  dayData: DayData[],
  effectiveMap: Map<string, string>
): DayData[] {
  return dayData.map((day) => {
    const byTask: Record<string, number> = {};
    let totalMs = 0;
    for (const [taskId, ms] of Object.entries(day.byTask)) {
      const displayId = effectiveMap.get(taskId);
      if (!displayId) continue;
      byTask[displayId] = (byTask[displayId] ?? 0) + ms;
      totalMs += ms;
    }
    return { ...day, totalMs, byTask };
  });
}
