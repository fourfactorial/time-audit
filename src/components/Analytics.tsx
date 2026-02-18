import React, { useState, useMemo, Fragment } from 'react';
import { Item, TimingSession } from '../types';
import {
  // calculateTimeByDay,
  getDaysArray,
  getAllDescendantTaskIds,
  formatDuration,
  getItemPathString,
} from '../utils/helpers';

interface AnalyticsProps {
  defaultTimeRange?: TimeRange;
  defaultCustomStart?: string;
  defaultCustomEnd?: string;
  items: Item[];
  sessions: TimingSession[];
  onBack: () => void;
}

type TimeRange = '7days' | '28days' | '6months' | 'custom';

interface DaySegment {
  itemId: string;
  itemName: string;
  itemColor: string;
  ms: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ items, sessions, onBack, defaultTimeRange = '7days', defaultCustomStart = '', defaultCustomEnd = '' }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const [customStart, setCustomStart] = useState(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState(defaultCustomEnd || todayStr);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<{ day: string; segment: DaySegment } | null>(null);
  const [_, setHoveredDay] = useState<string | null>(null);
  const [expandedDayOfWeek, setExpandedDayOfWeek] = useState(false);
  const [excludeZeroDays, setExcludeZeroDays] = useState(false);

  // Calculates start@midnight/end@23:59:59 dates only if timeRange/custom dates have changed; otherwise, uses memoized values
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (timeRange) {
      case '7days':
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        break;
      case '28days':
        start = new Date(now);
        start.setDate(start.getDate() - 27);
        break;
      case '6months':
        start = new Date(now);
        start.setMonth(start.getMonth() - 6);
        break;
      case 'custom':
        if (customStart) {
          const [sy, sm, sd] = customStart.split('-').map(Number);
          start = new Date(sy, sm - 1, sd);
        } else {
          start = new Date(now);
          start.setDate(start.getDate() - 13);
        }
        if (customEnd) {
          const [ey, em, ed] = customEnd.split('-').map(Number);
          end = new Date(ey, em - 1, ed);
        }
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 6);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }, [timeRange, customStart, customEnd]);

  // Filters sessions based on selected tasks/categories
  const filteredSessions = useMemo(() => {
    if (selectedItems.length === 0) return sessions;

    const taskIds = new Set<string>();
    const selectedCategories = new Set<string>();
    
    for (const itemId of selectedItems) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        if (item.type === 'task') {
          taskIds.add(item.id);
        } else {
          // It's a category - mark it as selected
          selectedCategories.add(item.id);
          const descendants = getAllDescendantTaskIds(items, item.id);
          descendants.forEach(id => taskIds.add(id));
        }
      }
    }

    return sessions.filter(s => taskIds.has(s.taskId));
  }, [sessions, selectedItems, items]);

  // Track which items should be aggregated at category level
  const aggregateAsCategories = useMemo(() => {
    const categorySet = new Set<string>();
    
    for (const itemId of selectedItems) {
      const item = items.find(i => i.id === itemId);
      if (item?.type === 'category') {
        // Check if any child tasks are also selected
        const descendants = getAllDescendantTaskIds(items, item.id);
        const hasSelectedChildren = descendants.some(taskId => selectedItems.includes(taskId));
        
        // Only aggregate if no children are selected
        if (!hasSelectedChildren) {
          categorySet.add(item.id);
        }
      }
    }
    
    return categorySet;
  }, [selectedItems, items]);

  // Build itemMap for quick lookups
  const itemMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach(item => map.set(item.id, item));
    return map;
  }, [items]);

  // Calculate time per day per item
  const chartData = useMemo(() => {
    // Format a local Date as YYYY-MM-DD without UTC conversion
    const toLocalDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Stable local-midnight start — constructed purely from local date parts, never mutated
    const startMidnight = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0, 0, 0, 0,
    );

    const rangeDays = Math.round((endDate.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
    const groupByWeek = rangeDays > 28;

    const relevantSessions = filteredSessions.filter(s =>
      s.intervals.some(int => {
        const intEnd = int.end || Date.now();
        return int.start <= endDate.getTime() && intEnd >= startMidnight.getTime();
      })
    );

    // Resolve which item a task's time should be attributed to (category aggregation)
    const resolveAttributeId = (taskId: string): string => {
      const task = itemMap.get(taskId);
      if (!task) return taskId;
      let currentId: string | null = task.parentId;
      while (currentId) {
        if (aggregateAsCategories.has(currentId)) return currentId;
        currentId = itemMap.get(currentId)?.parentId ?? null;
      }
      return taskId;
    };

    // Bucket map: bucketKey -> (itemId -> ms)
    const buckets = new Map<string, Map<string, number>>();

    relevantSessions.forEach(session => {
      const task = itemMap.get(session.taskId);
      if (!task) return;
      const attributeToId = resolveAttributeId(session.taskId);

      session.intervals.forEach(interval => {
        const intervalEnd = interval.end || Date.now();
        const intervalStart = interval.start;

        // Walk day-by-day through the interval, clamped to [startMidnight, endDate]
        // Use local date parts throughout to avoid any UTC shift
        const clampedStart = Math.max(intervalStart, startMidnight.getTime());
        const clampedEnd   = Math.min(intervalEnd,   endDate.getTime());
        if (clampedEnd < clampedStart) return;

        const walkStart = new Date(clampedStart);
        const currentDay = new Date(
          walkStart.getFullYear(),
          walkStart.getMonth(),
          walkStart.getDate(),
        );

        const walkEndDay = new Date(clampedEnd);
        const lastDay = new Date(
          walkEndDay.getFullYear(),
          walkEndDay.getMonth(),
          walkEndDay.getDate(),
        );

        while (currentDay <= lastDay) {
          // Day boundaries in local time
          const dayStart = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), 0, 0, 0, 0).getTime();
          const dayEnd   = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), 23, 59, 59, 999).getTime();

          const overlapStart = Math.max(intervalStart, dayStart);
          const overlapEnd   = Math.min(intervalEnd,   dayEnd);

          if (overlapEnd > overlapStart) {
            const duration = overlapEnd - overlapStart;

            const bucketKey = groupByWeek
              ? toLocalDateKey(new Date(
                  currentDay.getFullYear(),
                  currentDay.getMonth(),
                  currentDay.getDate() - currentDay.getDay(), // Sunday of this week
                ))
              : toLocalDateKey(currentDay);

            if (!buckets.has(bucketKey)) buckets.set(bucketKey, new Map());
            const bkt = buckets.get(bucketKey)!;
            bkt.set(attributeToId, (bkt.get(attributeToId) || 0) + duration);
          }

          currentDay.setDate(currentDay.getDate() + 1);
        }
      });
    });

    const buildSegments = (taskMap: Map<string, number>): DaySegment[] => {
      const segments: DaySegment[] = [];
      taskMap.forEach((ms, itemId) => {
        const item = itemMap.get(itemId);
        if (item) segments.push({ itemId, itemName: item.name, itemColor: item.color, ms });
      });
      segments.sort((a, b) => b.ms - a.ms);
      return segments;
    };

    if (!groupByWeek) {
      // Day-by-day: enumerate every day in the range so zero-days still appear
      const days = getDaysArray(startMidnight, endDate);
      return days.map(day => {
        const key = toLocalDateKey(day);
        const segments = buildSegments(buckets.get(key) ?? new Map());
        return {
          label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          fullDate: key,
          segments,
          totalMs: segments.reduce((s, seg) => s + seg.ms, 0),
        };
      });
    } else {
      // Week-by-week: only weeks that have data
      return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, taskMap]) => {
          const [wy, wm, wd] = weekKey.split('-').map(Number);
          const weekDate = new Date(wy, wm - 1, wd);
          const segments = buildSegments(taskMap);
          return {
            label: 'Week of ' + weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            fullDate: weekKey,
            segments,
            totalMs: segments.reduce((s, seg) => s + seg.ms, 0),
          };
        });
    }
  }, [filteredSessions, startDate, endDate, timeRange, itemMap, aggregateAsCategories]);


  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.totalMs), 1);
  }, [chartData]);

  // Calculate bar heights in pixels (not percentages)
  const getBarHeight = (ms: number) => {
    const maxMs = maxValue;
    const maxMinutes = maxMs / (1000 * 60);
    
    // Scale: 60-80px per minute for the max value
    const maxBarHeight = Math.min(Math.max(maxMinutes * 70, 250), 500);
    
    // Calculate this bar's height as proportion of max
    return (ms / maxMs) * maxBarHeight;
  };

  const totalTime = useMemo(() => {
    return chartData.reduce((sum, day) => sum + day.totalMs, 0);
  }, [chartData]);

  const avgPerDay = useMemo(() => {
    if (excludeZeroDays) {
      const daysWithData = chartData.filter(d => d.totalMs > 0).length;
      return daysWithData > 0 ? totalTime / daysWithData : 0;
    }
    return chartData.length > 0 ? totalTime / chartData.length : 0;
  }, [chartData, totalTime, excludeZeroDays]);

  // Calculate averages per item
  const averagesByItem = useMemo(() => {
    const itemTotals = new Map<string, number>();
    
    chartData.forEach(day => {
      // Skip days with zero time if excludeZeroDays is enabled
      if (excludeZeroDays && day.totalMs === 0) return;
      
      day.segments.forEach(seg => {
        itemTotals.set(seg.itemId, (itemTotals.get(seg.itemId) || 0) + seg.ms);
      });
    });

    const daysWithData = excludeZeroDays 
      ? chartData.filter(d => d.totalMs > 0).length 
      : chartData.length;
    const numDays = daysWithData || 1;
    
    const averages: Array<{ 
      itemId: string; 
      itemName: string; 
      itemColor: string; 
      avgMs: number; 
      totalMs: number;
      path: string;
    }> = [];

    itemTotals.forEach((totalMs, itemId) => {
      const item = itemMap.get(itemId);
      if (item) {
        const path = getItemPathString(items, itemId);
        averages.push({
          itemId,
          itemName: item.name,
          itemColor: item.color,
          avgMs: totalMs / numDays,
          totalMs,
          path,
        });
      }
    });

    averages.sort((a, b) => b.totalMs - a.totalMs);
    return averages;
  }, [chartData, itemMap, items, excludeZeroDays]);

  // Calculate time by day of week (for longer periods)
  const timeByDayOfWeek = useMemo(() => {
    if (timeRange !== '28days' && timeRange !== '6months') return null;

    const dayOfWeekTotals = new Map<number, number>();
    const dayOfWeekCounts = new Map<number, number>();
    const dayOfWeekByItem = new Map<number, Map<string, number>>();

    chartData.forEach(day => {
      // Skip days with zero time if excludeZeroDays is enabled
      if (excludeZeroDays && day.totalMs === 0) return;

      // Parse date correctly in local timezone
      const [year, month, dayOfMonth] = day.fullDate.split('-').map(Number);
      const date = new Date(year, month - 1, dayOfMonth);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      
      dayOfWeekTotals.set(dayOfWeek, (dayOfWeekTotals.get(dayOfWeek) || 0) + day.totalMs);
      dayOfWeekCounts.set(dayOfWeek, (dayOfWeekCounts.get(dayOfWeek) || 0) + 1);

      // Track per-item time
      if (!dayOfWeekByItem.has(dayOfWeek)) {
        dayOfWeekByItem.set(dayOfWeek, new Map());
      }
      const itemMap = dayOfWeekByItem.get(dayOfWeek)!;
      
      day.segments.forEach(seg => {
        itemMap.set(seg.itemId, (itemMap.get(seg.itemId) || 0) + seg.ms);
      });
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const result: Array<{ 
      day: string; 
      avgMs: number;
      itemBreakdown: Array<{ itemId: string; itemName: string; itemColor: string; avgMs: number; path: string }>;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const total = dayOfWeekTotals.get(i) || 0;
      const count = dayOfWeekCounts.get(i) || 0;
      
      // Skip days with no data if they have zero count
      if (count === 0) {
        result.push({
          day: dayNames[i],
          avgMs: 0,
          itemBreakdown: [],
        });
        continue;
      }

      const dayItemMap = dayOfWeekByItem.get(i) || new Map();
      const itemBreakdown: Array<{ itemId: string; itemName: string; itemColor: string; avgMs: number; path: string }> = [];
      
      dayItemMap.forEach((totalMs, itemId) => {
        const item = itemMap.get(itemId);
        if (item) {
          const path = getItemPathString(items, itemId);
          itemBreakdown.push({
            itemId,
            itemName: item.name,
            itemColor: item.color,
            avgMs: totalMs / count,
            path,
          });
        }
      });

      itemBreakdown.sort((a, b) => b.avgMs - a.avgMs);

      result.push({
        day: dayNames[i],
        avgMs: total / count,
        itemBreakdown,
      });
    }

    return result;
  }, [chartData, timeRange, itemMap, excludeZeroDays]);

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  return (
    <div className="analytics-screen">
      <div className="analytics-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h2>Analytics</h2>
      </div>

      <div className="analytics-controls">
        <div className="time-range-selector">
          <button
            className={timeRange === '7days' ? 'active' : ''}
            onClick={() => setTimeRange('7days')}
          >
            Last 7 Days
          </button>
          <button
            className={timeRange === '28days' ? 'active' : ''}
            onClick={() => setTimeRange('28days')}
          >
            Last 28 Days
          </button>
          <button
            className={timeRange === '6months' ? 'active' : ''}
            onClick={() => setTimeRange('6months')}
          >
            Last 6 Months
          </button>
          <button
            className={timeRange === 'custom' ? 'active' : ''}
            onClick={() => setTimeRange('custom')}
          >
            Custom
          </button>
        </div>

        {timeRange === 'custom' && (
          <div className="custom-date-range">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              placeholder="Start date"
            />
            <span>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              placeholder="End date"
            />
          </div>
        )}

        <div className="item-filter">
          <div className="filter-header">
            <h3>Filter by:</h3>
            <div className="filter-actions">
              <button
                className="filter-action-btn"
                onClick={() => setSelectedItems(items.map(i => i.id))}
              >
                Select All
              </button>
              <button
                className="filter-action-btn"
                onClick={() => setSelectedItems([])}
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="filter-items">
            {items.map(item => (
              <label key={item.id} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => handleItemToggle(item.id)}
                />
                <span style={{ backgroundColor: item.color }}></span>
                {item.name}
              </label>
            ))}
          </div>
        </div>

        <div className="analytics-options">
          <label className="exclude-zero-checkbox">
            <input
              type="checkbox"
              checked={excludeZeroDays}
              onChange={(e) => setExcludeZeroDays(e.target.checked)}
            />
            Exclude days with 0 time from averages
          </label>
        </div>
      </div>

      <div className="analytics-summary">
        <div className="summary-card">
          <span className="summary-label">Total Time</span>
          <span className="summary-value">{formatDuration(totalTime)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">
            {timeRange === '7days' ? 'Days' : timeRange === '28days' ? 'Days' : 'Weeks'}
          </span>
          <span className="summary-value">{chartData.length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Avg Per Day</span>
          <span className="summary-value">
            {formatDuration(avgPerDay)}
          </span>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart">
          {chartData.map((day, index) => (
            <div key={index} className="bar-container">
              <div
                className="bar-stack"
                style={{ height: `${getBarHeight(day.totalMs)}px` }}
                onMouseEnter={() => setHoveredDay(day.fullDate)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {day.segments.map((segment, segIndex) => (
                  <div
                    key={segIndex}
                    className="bar-segment"
                    style={{
                      backgroundColor: segment.itemColor,
                      height: `${(segment.ms / day.totalMs) * 100}%`,
                    }}
                    onMouseEnter={(e) => {
                      setHoveredSegment({ day: day.fullDate, segment });
                      // Check if tooltip would overflow
                      const barRect = e.currentTarget.getBoundingClientRect();
                      const tooltipHeight = 60; // Approximate tooltip height
                      const chartContainer = e.currentTarget.closest('.chart-container');
                      if (chartContainer) {
                        const containerRect = chartContainer.getBoundingClientRect();
                        const wouldOverflow = barRect.top - tooltipHeight < containerRect.top;
                        e.currentTarget.setAttribute('data-overflow', wouldOverflow ? 'true' : 'false');
                      }
                    }}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    {hoveredSegment?.day === day.fullDate && 
                     hoveredSegment?.segment.itemId === segment.itemId && (
                      <div className="segment-tooltip">
                        <div className="segment-tooltip-name">{segment.itemName}</div>
                        <div className="segment-tooltip-time">{formatDuration(segment.ms)}</div>
                      </div>
                    )}
                  </div>
                ))}
                {day.totalMs > 0 && (
                  <div className="bar-total-label">
                    {formatDuration(day.totalMs)}
                  </div>
                )}
              </div>
              <span className="bar-label">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="averages-section">
        <h3>Average Time by Category/Task</h3>
        <div className="averages-list">
          {averagesByItem.map(item => (
            <div key={item.itemId} className="average-item">
              <div className="average-item-info">
                <div
                  className="average-item-color"
                  style={{ backgroundColor: item.itemColor }}
                />
                <div className="average-item-name-container">
                  <span className="average-item-name">{item.itemName}</span>
                  {item.path && <span className="average-item-path">({item.path})</span>}
                </div>
              </div>
              <div className="average-item-stats">
                <span className="average-item-avg">
                  {formatDuration(item.avgMs)} / day
                </span>
                <span className="average-item-total">
                  {formatDuration(item.totalMs)} total
                </span>
              </div>
            </div>
          ))}
          {averagesByItem.length === 0 && (
            <div className="empty-state">No data for selected period</div>
          )}
        </div>
      </div>

      {timeByDayOfWeek && (
        <div className="day-of-week-section">
          <div className="day-of-week-header">
            <h3>Average by Day of Week</h3>
            <button 
              className="expand-toggle-btn"
              onClick={() => setExpandedDayOfWeek(!expandedDayOfWeek)}
            >
              {expandedDayOfWeek ? '− Hide Breakdown' : '+ Show Breakdown'}
            </button>
          </div>
          
          {!expandedDayOfWeek ? (
            <div className="day-of-week-grid">
              {timeByDayOfWeek.map(dow => (
                <div key={dow.day} className="day-of-week-item">
                  <span className="day-of-week-name">{dow.day}</span>
                  <span className="day-of-week-time">{formatDuration(dow.avgMs)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="day-of-week-table">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Total Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {timeByDayOfWeek.map(dow => (
                    <Fragment key={dow.day}>
                      <tr className="day-row">
                        <td className="day-name-cell">{dow.day}</td>
                        <td className="day-total-cell">{formatDuration(dow.avgMs)}</td>
                      </tr>
                      {dow.itemBreakdown.map(item => (
                        <tr key={`${dow.day}-${item.itemId}`} className="item-row">
                          <td className="item-name-cell">
                            <div className="item-cell-content">
                              <div 
                                className="item-color-dot"
                                style={{ backgroundColor: item.itemColor }}
                              />
                              <div className="item-name-with-path">
                                <span>{item.itemName}</span>
                                {item.path && <span className="item-path-small">({item.path})</span>}
                              </div>
                            </div>
                          </td>
                          <td className="item-time-cell">{formatDuration(item.avgMs)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
