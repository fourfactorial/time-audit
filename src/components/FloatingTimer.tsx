import React, { useEffect, useState } from 'react';
import { ActiveTimerState } from '../types';
import { formatTime } from '../utils/helpers';

interface FloatingTimerProps {
  timerState: ActiveTimerState;
  onReturnToTimer: () => void;
}

export const FloatingTimer: React.FC<FloatingTimerProps> = ({ timerState, onReturnToTimer }) => {
  const [displayTime, setDisplayTime] = useState(timerState.elapsedMs);

  useEffect(() => {
    if (timerState.isRunning && !timerState.isPaused) {
      const interval = setInterval(() => {
        const now = Date.now();
        const currentInterval = now - timerState.startTimeRef;
        const previousTime = timerState.intervals.slice(0, -1).reduce((sum, int) => {
          return sum + ((int.end || 0) - int.start);
        }, 0);
        setDisplayTime(previousTime + currentInterval);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setDisplayTime(timerState.elapsedMs);
    }
  }, [timerState]);

  return (
    <div 
      className="floating-timer"
      onClick={onReturnToTimer}
      style={{ '--task-color': timerState.taskColor } as React.CSSProperties}
    >
      <div className="floating-timer-content">
        {timerState.isPaused ? (
          <span className="floating-timer-icon">⏸</span>
        ) : (
          <span className="floating-timer-time">{formatTime(displayTime)}</span>
        )}
        <span className="floating-timer-task">{timerState.taskName}</span>
      </div>
      <div className="floating-timer-pulse" />
    </div>
  );
};
