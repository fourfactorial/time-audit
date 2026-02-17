import { Item, TimingSession } from '../types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const DEFAULT_COLORS = [
  '#E63946', // Red
  '#F77F00', // Orange
  '#FCBF49', // Yellow
  '#06A77D', // Green
  '#4EA8DE', // Blue
  '#5E60CE', // Indigo
  '#9D4EDD', // Violet
  '#FF006E', // Magenta
  '#FB5607', // Orange-red
  '#06FFA5', // Mint
  '#4CC9F0', // Cyan
  '#7209B7', // Purple
];

export function calculateSessionDuration(session: TimingSession): number {
  return session.intervals.reduce((total, interval) => {
    const end = interval.end || Date.now();
    return total + (end - interval.start);
  }, 0);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  } else if (minutes > 0) {
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getItemChildren(items: Item[], parentId: string): Item[] {
  return items.filter(item => item.parentId === parentId);
}

export function getRootItems(items: Item[]): Item[] {
  return items.filter(item => item.parentId === null);
}

export function getItemPath(items: Item[], itemId: string): string[] {
  const path: string[] = [];
  let currentId: string | null = itemId;
  
  while (currentId) {
    const item = items.find(i => i.id === currentId);
    if (!item) break;
    path.unshift(item.name);
    currentId = item.parentId;
  }
  
  return path;
}

export function getItemPathString(items: Item[], itemId: string): string {
  const path = getItemPath(items, itemId);
  // Remove the last element (the item itself) and join with /
  return path.length > 1 ? path.slice(0, -1).join('/') : '';
}

export function getAllDescendantTaskIds(items: Item[], categoryId: string): string[] {
  const taskIds: string[] = [];
  const queue = [categoryId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = getItemChildren(items, currentId);
    
    for (const child of children) {
      if (child.type === 'task') {
        taskIds.push(child.id);
      } else {
        queue.push(child.id);
      }
    }
  }
  
  return taskIds;
}

export function getStartOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getEndOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function getDaysArray(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

export function calculateTimeByDay(
  sessions: TimingSession[],
  startDate: Date,
  endDate: Date
): Map<string, number> {
  const timeByDay = new Map<string, number>();
  const startMidnight = new Date(startDate);
  startMidnight.setHours(0, 0, 0, 0);
  
  for (const session of sessions) {
    for (const interval of session.intervals) {
      const intervalEnd = interval.end || Date.now();
      const intervalStart = interval.start;
      
      // Process each day the interval spans
      const startDay = new Date(intervalStart);
      startDay.setHours(0, 0, 0, 0);
      
      const endDay = new Date(intervalEnd);
      endDay.setHours(0, 0, 0, 0);
      
      let currentDay = new Date(startDay);
      
      while (currentDay <= endDay && currentDay <= endDate) {
        if (currentDay >= startMidnight) {
          const dayKey = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
          const dayStart = getStartOfDay(currentDay);
          const dayEnd = getEndOfDay(currentDay);
          
          const overlapStart = Math.max(intervalStart, dayStart);
          const overlapEnd = Math.min(intervalEnd, dayEnd);
          
          if (overlapEnd > overlapStart) {
            const duration = overlapEnd - overlapStart;
            timeByDay.set(dayKey, (timeByDay.get(dayKey) || 0) + duration);
          }
        }
        
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }
  }
  
  return timeByDay;
}

export function downloadJSON(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
