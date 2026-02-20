import { useEffect, useState } from 'react';
import type { Category, Session } from '../types';
import { useApp } from '../store/AppContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import styles from './TimingScreen.module.css';

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Format a Date as YYYY-MM-DDTHH:MM in local time for datetime-local inputs */
function toLocalDatetimeString(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}`;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) return `${h}h ${rm}m`;
  return `${m}m`;
}

function getAncestors(categories: Category[], id: string | null): Category[] {
  const result: Category[] = [];
  let cur = id;
  while (cur) {
    const found = categories.find((c) => c.id === cur);
    if (!found) break;
    result.unshift(found);
    cur = found.parentId;
  }
  return result;
}

function getChildren(categories: Category[], parentId: string | null): Category[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

function getTaskSessions(sessions: Session[], taskId: string): Session[] {
  return sessions.filter((s) => s.taskId === taskId);
}

function sessionTotalMs(s: Session): number {
  return s.intervals.reduce((acc, iv) => {
    const end = iv.end ?? Date.now();
    return acc + (end - iv.start);
  }, 0);
}

// ── Confirm switch modal ────────────────────────────────────────────────────

interface ConfirmSwitchProps {
  newTask: Category;
  onSwitch: () => void;
  onCancel: () => void;
}

function ConfirmSwitchModal({ newTask, onSwitch, onCancel }: ConfirmSwitchProps) {
  return (
    <Modal
      title="Timer already running"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Keep current</Button>
          <Button variant="primary" onClick={onSwitch}>Stop & switch</Button>
        </>
      }
    >
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
        You have a timer running. To start a timer for <strong>{newTask.name}</strong>, the current session will be saved and stopped.
      </p>
    </Modal>
  );
}

// ── Manual session modal ────────────────────────────────────────────────────

interface ManualSessionProps {
  categories: Category[];
  onSave: (session: Session) => void;
  onClose: () => void;
}

function ManualSessionModal({ categories, onSave, onClose }: ManualSessionProps) {
  const tasks = categories.filter((c) => c.type === 'task');
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '');
  const [duration, setDuration] = useState('');
  const [anchorTime, setAnchorTime] = useState('end');
  const [datetime, setDatetime] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return toLocalDatetimeString(now);
  });

  const handleSave = () => {
    if (!taskId || !duration) return;
    const mins = parseFloat(duration);
    if (isNaN(mins) || mins <= 0) return;
    const ms = mins * 60 * 1000;
    // Parse datetime-local string as local time explicitly
    // (avoids browser inconsistencies with new Date("YYYY-MM-DDTHH:MM"))
    const [datePart, timePart] = datetime.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const anchor = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
    const start = anchorTime === 'start' ? anchor : anchor - ms;
    const end = start + ms;
    const session: Session = {
      id: genId(),
      taskId,
      intervals: [{ start, end }],
    };
    onSave(session);
    onClose();
  };

  return (
    <Modal
      title="Add session manually"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save session</Button>
        </>
      }
    >
      {tasks.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          No tasks yet. Create tasks in the Categories tab first.
        </p>
      ) : (
        <>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Task</label>
            <select
              className={styles.formSelect}
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Duration (minutes)</label>
            <input
              className={styles.formInput}
              type="number"
              min="1"
              step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Anchor time</label>
            <select
              className={styles.formSelect}
              value={anchorTime}
              onChange={(e) => setAnchorTime(e.target.value)}
            >
              <option value="start">Start time</option>
              <option value="end">End time</option>
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Date & time</label>
            <input
              className={styles.formInput}
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Timer view ──────────────────────────────────────────────────────────────

interface TimerViewProps {
  task: Category;
  ancestors: Category[];
  onBack: () => void;
}

function TimerView({ task, ancestors, onBack }: TimerViewProps) {
  const { state, startTimer, pauseTimer, resumeTimer, stopTimer, getElapsedMs } = useApp();
  const { timer } = state;
  const [, forceUpdate] = useState(0);
  const [pendingNewTaskId, setPendingNewTaskId] = useState<string | null>(null);

  const isThisTask = timer?.taskId === task.id;
  const isRunning = isThisTask && timer?.status === 'running';
  const isPaused = isThisTask && timer?.status === 'paused';
  const elapsed = isThisTask ? getElapsedMs() : 0;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [isRunning]);

  const handleStart = async () => {
    if (timer && timer.taskId !== task.id) {
      // Another timer running
      setPendingNewTaskId(task.id);
      return;
    }
    await startTimer(task.id);
  };

  const handleSwitchConfirm = async () => {
    await stopTimer(true);
    await startTimer(pendingNewTaskId!);
    setPendingNewTaskId(null);
  };

  const breadcrumbPath = ancestors.length > 0
    ? ancestors.map((a) => a.name).join(' › ')
    : null;

  return (
    <div className={styles.timerView}>
      {pendingNewTaskId && (
        <ConfirmSwitchModal
          newTask={task}
          onSwitch={handleSwitchConfirm}
          onCancel={() => setPendingNewTaskId(null)}
        />
      )}

      <div className={styles.timerTaskInfo}>
        {breadcrumbPath && (
          <div className={styles.timerBreadcrumb}>{breadcrumbPath}</div>
        )}
        <div className={styles.timerTaskName}>
          <span
            className={styles.timerColorDot}
            style={{ background: task.color }}
          />
          {task.name}
        </div>
      </div>

      <div className={styles.timerDisplay}>
        <div className={`${styles.timerTime} ${isPaused ? styles.paused : ''}`}>
          {formatTime(elapsed)}
        </div>
        <div className={styles.timerStatusLabel}>
          {isRunning ? 'recording' : isPaused ? 'paused' : 'ready'}
        </div>
      </div>

      <div className={styles.timerControls}>
        <div className={styles.mainControls}>
          {!isThisTask || (!isRunning && !isPaused) ? (
            <button className={styles.bigBtn} onClick={handleStart} aria-label="Start timer">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          ) : (
            <>
              {isRunning ? (
                <button className={styles.bigBtn} onClick={pauseTimer} aria-label="Pause timer">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </button>
              ) : (
                <button className={styles.bigBtn} onClick={resumeTimer} aria-label="Resume timer">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {isThisTask && (isRunning || isPaused) && (
          <div className={styles.cancelRow}>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => { await stopTimer(true); onBack(); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Stop & Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { stopTimer(false); onBack(); }}
            >
              Cancel
            </Button>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
      </div>
    </div>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

interface TimingScreenProps {
  /** When set, immediately opens the timer view for this task id (e.g. from widget tap) */
  jumpToTaskId?: string | null;
  /** Called once the jump has been consumed so the parent can clear it */
  onJumpConsumed?: () => void;
  /** Notifies parent whether we're currently showing an active session */
  onActiveSessionChange?: (taskId: string | null) => void;
}

export default function TimingScreen({ jumpToTaskId, onJumpConsumed, onActiveSessionChange }: TimingScreenProps) {
  const { state, upsertSession } = useApp();
  const { categories, sessions } = state;
  const [folderId, setFolderId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const children = getChildren(categories, folderId);
  const ancestors = folderId ? getAncestors(categories, folderId) : [];
  const currentFolder = folderId ? categories.find((c) => c.id === folderId) : null;
  const activeTask = activeTaskId ? categories.find((c) => c.id === activeTaskId) : null;

  // React to jumpToTaskId from widget tap
  useEffect(() => {
    if (jumpToTaskId) {
      setActiveTaskId(jumpToTaskId);
      onJumpConsumed?.();
    }
  }, [jumpToTaskId, onJumpConsumed]);

  // Notify parent which session (if any) is active
  useEffect(() => {
    onActiveSessionChange?.(activeTaskId);
  }, [activeTaskId, onActiveSessionChange]);

  // If timer is for a task in this screen, show timer view
  const { timer } = state;

  if (activeTask) {
    const taskAncestors = getAncestors(categories, activeTask.parentId);
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>Timer</h1>
        </div>
        <TimerView
          task={activeTask}
          ancestors={taskAncestors}
          onBack={() => setActiveTaskId(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      {showManual && (
        <ManualSessionModal
          categories={categories}
          onSave={(s) => upsertSession(s)}
          onClose={() => setShowManual(false)}
        />
      )}

      <div className={styles.header}>
        <h1 className={styles.headerTitle}>
          {currentFolder ? currentFolder.name : 'Timer'}
        </h1>
      </div>

      <div className={styles.browse}>
        {/* Breadcrumb */}
        {(ancestors.length > 0 || folderId) && (
          <div className={styles.breadcrumb}>
            <button className={styles.breadcrumbItem} onClick={() => setFolderId(null)}>
              Root
            </button>
            {ancestors.map((a) => (
              <>
                <span className={styles.breadcrumbSep} key={`sep-${a.id}`}>›</span>
                <button
                  key={a.id}
                  className={styles.breadcrumbItem}
                  onClick={() => setFolderId(a.id)}
                >
                  {a.name}
                </button>
              </>
            ))}
            {currentFolder && (
              <>
                <span className={styles.breadcrumbSep}>›</span>
                <span className={styles.breadcrumbCurrent}>{currentFolder.name}</span>
              </>
            )}
          </div>
        )}

        {children.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
            <div className={styles.emptyTitle}>No items here</div>
            <div className={styles.emptyText}>
              Add folders and tasks in the Categories tab to start tracking time.
            </div>
          </div>
        ) : (
          <div className={styles.itemGrid}>
            {children.map((item) => {
              const childCount = categories.filter((c) => c.parentId === item.id).length;
              const taskSessions = item.type === 'task'
                ? getTaskSessions(sessions, item.id)
                : [];
              const totalMs = taskSessions.reduce((acc, s) => acc + sessionTotalMs(s), 0);
              const isActiveTimer = timer?.taskId === item.id;

              return (
                <button
                  key={item.id}
                  className={styles.itemCard}
                  onClick={() => {
                    if (item.type === 'folder') setFolderId(item.id);
                    else setActiveTaskId(item.id);
                  }}
                >
                  <div
                    className={`${styles.itemBadge} ${item.type === 'task' ? styles.task : ''}`}
                    style={{ background: item.color + '20', color: item.color }}
                    aria-hidden="true"
                  >
                    {item.type === 'folder' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="8" />
                        {isActiveTimer && <circle cx="12" cy="12" r="4" fill="currentColor" />}
                      </svg>
                    )}
                  </div>
                  <div className={styles.itemText}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemMeta}>
                      {item.type === 'folder'
                        ? `${childCount} item${childCount !== 1 ? 's' : ''}`
                        : totalMs > 0
                          ? formatDuration(totalMs) + ' total'
                          : 'No sessions'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.addManualBtn}>
          <Button variant="ghost" size="sm" onClick={() => setShowManual(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add session manually
          </Button>
        </div>
      </div>
    </div>
  );
}