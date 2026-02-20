import { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import styles from './TimerWidget.module.css';

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

interface Props {
  /** Called when widget is clicked; receives the active task id */
  onGoToSession: (taskId: string) => void;
  /** Whether we're already on the timing screen showing this session */
  isOnActiveSession: boolean;
}

export default function TimerWidget({ onGoToSession, isOnActiveSession }: Props) {
  const { state, navigate, getElapsedMs } = useApp();
  const { timer, categories } = state;
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!timer || timer.status !== 'running') return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timer]);

  // Always hide if no timer
  if (!timer) return null;

  // Hide only if we're already on the active session view (no need for widget)
  if (isOnActiveSession) return null;

  const task = categories.find((c) => c.id === timer.taskId);
  const elapsed = getElapsedMs();

  const handleClick = () => {
    // Navigate to timing tab and jump straight to the active session
    navigate('timing');
    onGoToSession(timer.taskId);
  };

  return (
    <button
      className={styles.widget}
      style={{ background: task?.color ?? 'var(--surface-2)' }}
      onClick={handleClick}
      aria-label={`Timer running for ${task?.name ?? 'Unknown task'}. Tap to go to session.`}
    >
      <span className={styles.info}>
        <span className={styles.taskName}>{task?.name ?? 'Unknown'}</span>
        <span className={styles.time}>{formatTime(elapsed)}</span>
      </span>
      {timer.status === 'running' ? (
        <span className={styles.pulsingDot} />
      ) : (
        <span className={styles.pauseIndicator}>PAUSED</span>
      )}
    </button>
  );
}
