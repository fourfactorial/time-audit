import { useApp } from '../store/AppContext';
import Button from './Button';
import styles from './InterruptedBanner.module.css';
import type { Session } from '../types';

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function sessionElapsed(session: Session): number {
  // Sum all closed intervals; treat the open one as ending now
  return session.intervals.reduce((acc, iv) => {
    return acc + ((iv.end ?? Date.now()) - iv.start);
  }, 0);
}

export default function InterruptedBanner() {
  const { state, resumeInterrupted, closeInterrupted, dismissInterrupted } = useApp();
  const { interruptedSession, categories } = state;

  if (!interruptedSession) return null;

  const task = categories.find((c) => c.id === interruptedSession.taskId);
  const elapsed = sessionElapsed(interruptedSession);

  // Format when the session was interrupted
  const openInterval = interruptedSession.intervals.find((iv) => iv.end === null);
  const interruptedAt = openInterval
    ? new Date(openInterval.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.iconWrap} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className={styles.text}>
            <div className={styles.title}>Session interrupted</div>
            <div className={styles.subtitle}>
              A timer was running when the app closed
              {interruptedAt ? ` (started at ${interruptedAt})` : ''}.
              What would you like to do?
            </div>
          </div>
          <button
            className={styles.dismissBtn}
            onClick={dismissInterrupted}
            aria-label="Dismiss"
            title="Dismiss without changes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {task && (
          <div className={styles.taskRow}>
            <span className={styles.colorDot} style={{ background: task.color }} />
            <span>{task.name}</span>
            <span className={styles.duration}>{fmtDuration(elapsed)} recorded</span>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => resumeInterrupted(interruptedSession)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Resume timing
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => closeInterrupted(interruptedSession)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Save &amp; close session
          </Button>
        </div>
      </div>
    </div>
  );
}
