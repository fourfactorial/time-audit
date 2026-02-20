import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../types';
import { useApp } from '../store/AppContext';
import type { AnalyticsPeriod, DateRange } from '../types';
import {
  aggregateToDays,
  computeEffectiveDisplay,
  // dateRange,
  fmtDuration,
  mergeDayDataWithDisplay,
  toLocalDate,
} from './analyticsUtils';
import styles from './AnalyticsScreen.module.css';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function today(): string {
  return toLocalDate(Date.now());
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toLocalDate(d.getTime());
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return toLocalDate(d.getTime());
}

function getPeriodRange(period: AnalyticsPeriod, custom: DateRange, _settings: { analyticsCustomDefaultStart: string | null; analyticsCustomDefaultEnd: string | null }): DateRange {
  const end = today();
  if (period === '7d') return { start: addDays(end, -6), end };
  if (period === '28d') return { start: addDays(end, -27), end };
  if (period === '6m') return { start: addMonths(end, -6), end };
  return custom;
}

// ── Bar chart component ──────────────────────────────────────────────────────

interface ChartProps {
  data: { date: string; totalMs: number; byTask: Record<string, number> }[];
  categories: Category[];
  displayIds: string[];
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

function BarChart({ data, categories, displayIds }: ChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // For ≤7 bars, dynamically fill the screen width; otherwise use compact sizing
  const isSmall = data.length <= 7;
  // We'll compute dynamic bar width in the render below based on container width
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Measure container width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width - 32); // subtract padding
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth - 32);
    return () => ro.disconnect();
  }, []);

  // Dynamic bar sizing: for small sets, fill the container width
  let BAR_W: number;
  let BAR_GAP: number;
  if (isSmall && containerWidth > 0) {
    // Fill available width
    BAR_GAP = 8;
    BAR_W = Math.floor((containerWidth - BAR_GAP * (data.length + 1)) / data.length);
    BAR_W = Math.max(BAR_W, 20);
  } else {
    BAR_W = 28;
    BAR_GAP = 8;
  }

  const CHART_H     = 160;
  const LABEL_H     = 28;
  const TOP_LABEL_H = 20;
  const TOTAL_H = CHART_H + LABEL_H + TOP_LABEL_H;

  const maxMs = Math.max(...data.map((d) => d.totalMs), 1);
  const chartWidth = data.length * (BAR_W + BAR_GAP) + BAR_GAP;

  // Scroll to right on mount/data change for large charts
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [data.length, BAR_W]);

  const getCatForId = (id: string) => categories.find((c) => c.id === id);

  // Tooltip from pointer position relative to wrapRef
  const showTooltip = (e: React.MouseEvent, text: string) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text,
    });
  };

  return (
    <div className={styles.chartWrap} ref={wrapRef} style={{ position: 'relative' }}>
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <div className={styles.chartInner} ref={innerRef}>
        <svg
          width={chartWidth}
          height={TOTAL_H}
          className={styles.chartSvg}
          onMouseLeave={() => setTooltip(null)}
        >
          {data.map((day, i) => {
            const x = BAR_GAP + i * (BAR_W + BAR_GAP);
            const totalH = (day.totalMs / maxMs) * CHART_H;
            const barY = TOP_LABEL_H + CHART_H - totalH;
            const label = day.date.slice(5); // MM-DD

            // Stack segments
            let offsetY = 0;
            const segments = displayIds
              .map((tid) => ({ tid, ms: day.byTask[tid] ?? 0 }))
              .filter((s) => s.ms > 0)
              .sort((a, b) => b.ms - a.ms);

            return (
              <g key={day.date}>
                {/* Total label above bar */}
                {day.totalMs > 0 && (
                  <text
                    x={x + BAR_W / 2}
                    y={barY - 2}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--text-3)"
                    fontFamily="var(--font-mono)"
                  >
                    {fmtDuration(day.totalMs, true)}
                  </text>
                )}

                {/* Bar segments */}
                {segments.map(({ tid, ms }) => {
                  const segH = (ms / maxMs) * CHART_H;
                  const segY = TOP_LABEL_H + CHART_H - totalH + offsetY;
                  const cat = getCatForId(tid);
                  const color = cat?.color ?? '#888';
                  const isTop = offsetY === 0;
                  offsetY += segH;

                  return (
                    <rect
                      key={tid}
                      x={x}
                      y={segY}
                      width={BAR_W}
                      height={segH}
                      fill={color}
                      rx={isTop ? 3 : 0}
                      onMouseMove={(e) => showTooltip(e, `${cat?.name ?? 'Unknown'}: ${fmtDuration(ms)}`)}
                      onClick={(e) => showTooltip(e, `${cat?.name ?? 'Unknown'}: ${fmtDuration(ms)}`)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}

                {/* Background for empty bars */}
                {day.totalMs === 0 && (
                  <rect
                    x={x}
                    y={TOP_LABEL_H}
                    width={BAR_W}
                    height={CHART_H}
                    fill="var(--border)"
                    rx={3}
                    opacity={0.5}
                  />
                )}

                {/* Date label */}
                <text
                  x={x + BAR_W / 2}
                  y={TOP_LABEL_H + CHART_H + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-3)"
                  fontFamily="var(--font-sans)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { state, updateSettings } = useApp();
  const { categories, sessions, settings } = state;

  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const end = settings.analyticsCustomDefaultEnd ?? today();
    const start = settings.analyticsCustomDefaultStart ?? addDays(end, -6);
    return { start, end };
  });

  const [showFilter, setShowFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(categories.map((c) => c.id))
  );
  const [showDow, setShowDow] = useState(false);

  const range = getPeriodRange(period, customRange, settings);

  const effectiveMap = useMemo(
    () => computeEffectiveDisplay(categories, selectedIds),
    [categories, selectedIds]
  );

  const displayIds = useMemo(() => {
    const ids = new Set<string>();
    effectiveMap.forEach((v) => ids.add(v));
    return [...ids];
  }, [effectiveMap]);

  const rawDays = useMemo(
    () => aggregateToDays(sessions, range.start, range.end),
    [sessions, range.start, range.end]
  );

  const days = useMemo(
    () => mergeDayDataWithDisplay(rawDays, effectiveMap),
    [rawDays, effectiveMap]
  );

  const totalMs = useMemo(() => days.reduce((a, d) => a + d.totalMs, 0), [days]);

  const activeDays = useMemo(
    () => (settings.analyticsExcludeZeroDays ? days.filter((d) => d.totalMs > 0) : days),
    [days, settings.analyticsExcludeZeroDays]
  );

  const avgPerDayMs = activeDays.length > 0 ? totalMs / activeDays.length : 0;

  // Per-task average
  const taskAvg = useMemo(() => {
    const result: Record<string, number> = {};
    for (const id of displayIds) {
      const total = days.reduce((a, d) => a + (d.byTask[id] ?? 0), 0);
      result[id] = activeDays.length > 0 ? total / activeDays.length : 0;
    }
    return result;
  }, [days, activeDays, displayIds]);

  // Day-of-week breakdown
  const dowData = useMemo(() => {
    const totals: { totalMs: number; byTask: Record<string, number>; count: number }[] = Array.from(
      { length: 7 },
      () => ({ totalMs: 0, byTask: {}, count: 0 })
    );
    for (const day of days) {
      // If excludeZeroDays is set, skip days with no recorded time
      if (settings.analyticsExcludeZeroDays && day.totalMs === 0) continue;
      const dow = new Date(day.date + 'T00:00:00').getDay();
      totals[dow].count++;
      totals[dow].totalMs += day.totalMs;
      for (const [tid, ms] of Object.entries(day.byTask)) {
        totals[dow].byTask[tid] = (totals[dow].byTask[tid] ?? 0) + ms;
      }
    }
    return totals.map((t) => ({
      totalAvg: t.count > 0 ? t.totalMs / t.count : 0,
      byTaskAvg: Object.fromEntries(
        Object.entries(t.byTask).map(([k, v]) => [k, t.count > 0 ? v / t.count : 0])
      ),
    }));
  }, [days, settings.analyticsExcludeZeroDays]);

  const showDowSection = ['28d', '6m', 'custom'].includes(period);

  const getCat = (id: string) => categories.find((c) => c.id === id);
  const maxTaskAvg = Math.max(...Object.values(taskAvg), 1);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Analytics</h1>
        <div className={styles.periodRow}>
          {(['7d', '28d', '6m', 'custom'] as AnalyticsPeriod[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.active : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? 'Last 7d' : p === '28d' ? 'Last 28d' : p === '6m' ? 'Last 6m' : 'Custom'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className={styles.customRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={customRange.start}
              max={customRange.end}
              onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
            />
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>→</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customRange.end}
              min={customRange.start}
              max={today()}
              onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* Summary */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total time</div>
            <div className={styles.summaryValue}>{fmtDuration(totalMs)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Avg / day</div>
            <div className={styles.summaryValue}>{fmtDuration(avgPerDayMs)}</div>
          </div>
        </div>
        {/* Zero-days checkbox */}
        <label className={styles.zeroDaysRow}>
          <input
            type="checkbox"
            className={styles.zeroDaysCheckbox}
            checked={settings.analyticsExcludeZeroDays}
            onChange={(e) => updateSettings({ analyticsExcludeZeroDays: e.target.checked })}
          />
          <span className={styles.zeroDaysLabel}>Exclude days with no recorded time from average</span>
        </label>

        {/* Chart */}
        <div>
          <div className={styles.filterRow}>
            <span className={styles.sectionTitle}>Daily breakdown</span>
            <button
              className={styles.filterBtn}
              onClick={() => setShowFilter((v) => !v)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
            </button>
          </div>

          {showFilter && (
            <div className={styles.filterPanel} style={{ marginTop: 'var(--s3)' }}>
              <div className={styles.filterPanelHeader}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                  Visible categories
                </span>
                <div style={{ display: 'flex', gap: 'var(--s2)' }}>
                  <button
                    style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}
                    onClick={() => setSelectedIds(new Set(categories.map((c) => c.id)))}
                  >
                    All
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    None
                  </button>
                </div>
              </div>
              {categories.map((cat) => {
                const checked = selectedIds.has(cat.id);
                return (
                  <label key={cat.id} className={styles.filterCheckRow}>
                    <div
                      className={`${styles.filterCheckbox} ${checked ? styles.checked : ''}`}
                      onClick={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) next.delete(cat.id);
                          else next.add(cat.id);
                          return next;
                        });
                      }}
                    >
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className={styles.filterColorDot} style={{ background: cat.color }} />
                    <span className={styles.filterName}>{cat.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 'var(--s3)' }}>
            {totalMs === 0 ? (
              <div className={styles.emptyChart}>No data for this period</div>
            ) : (
              <BarChart data={days} categories={categories} displayIds={displayIds} />
            )}
          </div>
        </div>

        {/* Per-task breakdown */}
        <div>
          <div className={styles.breakdownTitle}>Average per day by task</div>
          {displayIds.length === 0 || totalMs === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', padding: 'var(--s3) 0' }}>No data</div>
          ) : (
            displayIds
              .filter((id) => taskAvg[id] > 0)
              .sort((a, b) => (taskAvg[b] ?? 0) - (taskAvg[a] ?? 0))
              .map((id) => {
                const cat = getCat(id);
                const avg = taskAvg[id] ?? 0;
                return (
                  <div key={id} className={styles.breakdownRow}>
                    <span className={styles.breakdownColor} style={{ background: cat?.color ?? '#888' }} />
                    <span className={styles.breakdownName}>{cat?.name ?? 'Unknown'}</span>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownBarFill}
                        style={{
                          width: `${(avg / maxTaskAvg) * 100}%`,
                          background: cat?.color ?? '#888',
                        }}
                      />
                    </div>
                    <span className={styles.breakdownTime}>{fmtDuration(avg)}</span>
                  </div>
                );
              })
          )}
        </div>

        {/* Day-of-week breakdown */}
        {showDowSection && (
          <div>
            <div className={styles.breakdownTitle}>By day of week</div>
            {/* Collapsed view: horizontal tiles */}
            {!showDow ? (
              <div className={styles.dowTileRow}>
                {DOW.map((dayName, i) => {
                  const d = dowData[i];
                  const topTasks = Object.entries(d.byTaskAvg)
                    .filter(([, ms]) => ms > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3);
                  return (
                    <div key={dayName} className={styles.dowTile}>
                      <div className={styles.dowTileDay}>{dayName}</div>
                      <div className={styles.dowTileDots}>
                        {topTasks.map(([tid]) => {
                          const cat = getCat(tid);
                          return cat?.type === 'folder' ? (
                            <svg key={tid} width="10" height="9" viewBox="0 0 24 22" fill={cat?.color ?? '#888'} style={{ flexShrink: 0 }}>
                              <path d="M2 4a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z" />
                            </svg>
                          ) : (
                            <span
                              key={tid}
                              style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: cat?.color ?? '#888',
                                flexShrink: 0, display: 'inline-block',
                              }}
                            />
                          );
                        })}
                        {topTasks.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>}
                      </div>
                      <div className={styles.dowTileTotal}>
                        {d.totalAvg > 0 ? fmtDuration(d.totalAvg, true) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Expanded view: vertical list */
              <div className={styles.dowTable}>
                {DOW.map((dayName, i) => {
                  const d = dowData[i];
                  return (
                    <div key={dayName} className={styles.dowRow}>
                      <div className={styles.dowDay}>{dayName}</div>
                      <div className={styles.dowTasks}>
                        {Object.entries(d.byTaskAvg)
                          .filter(([, ms]) => ms > 0)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 4)
                          .map(([tid, ms]) => {
                            const cat = getCat(tid);
                            return (
                              <div key={tid} className={styles.dowTaskRow}>
                                {cat?.type === 'folder' ? (
                                  <svg width="10" height="9" viewBox="0 0 24 22" fill={cat?.color ?? '#888'} style={{ flexShrink: 0 }}>
                                    <path d="M2 4a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z" />
                                  </svg>
                                ) : (
                                  <span
                                    style={{
                                      width: 8, height: 8, borderRadius: '50%',
                                      background: cat?.color ?? '#888',
                                      flexShrink: 0, display: 'inline-block',
                                    }}
                                  />
                                )}
                                <span className={styles.dowTaskName}>{cat?.name ?? '?'}</span>
                                <span className={styles.dowTaskTime}>{fmtDuration(ms, true)}</span>
                              </div>
                            );
                          })}
                        {d.totalAvg === 0 && (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                        )}
                      </div>
                      <div className={styles.dowTotal}>
                        {d.totalAvg > 0 ? fmtDuration(d.totalAvg, true) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              className={styles.dowExpandBtn}
              onClick={() => setShowDow((v) => !v)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: showDow ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {showDow ? 'Hide task breakdown' : 'Show task breakdown'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
