import React, { useState, useEffect, useRef } from 'react';
import { Task, TimingSession, TimeInterval, ActiveTimerState } from '../types';
import { formatTime, generateId } from '../utils/helpers';

interface TimerProps {
  task: Task;
  onSave: (session: TimingSession) => void;
  onBack: () => void;
  activeTimer: ActiveTimerState | null;
  onTimerStateChange: (state: ActiveTimerState | null) => void;
}

export const Timer: React.FC<TimerProps> = ({ task, onSave, onBack, activeTimer, onTimerStateChange }) => {
  // Initialize from activeTimer if it exists and matches this task
  const initialState = activeTimer && activeTimer.taskId === task.id ? activeTimer : null;
  
  const [isRunning, setIsRunning] = useState(initialState?.isRunning || false);
  const [isPaused, setIsPaused] = useState(initialState?.isPaused || false);
  const [elapsedMs, setElapsedMs] = useState(initialState?.elapsedMs || 0);
  const [intervals, setIntervals] = useState<TimeInterval[]>(initialState?.intervals || []);
  
  const startTimeRef = useRef<number>(initialState?.startTimeRef || 0);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalIdRef.current = setInterval(() => {
        const now = Date.now();
        const currentInterval = now - startTimeRef.current;
        const previousTime = intervals.slice(0, -1).reduce((sum, int) => {
          return sum + ((int.end || 0) - int.start);
        }, 0);
        setElapsedMs(previousTime + currentInterval);
      }, 100);
    } else {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isRunning, isPaused, intervals]);

  // Sync timer state with parent component
  useEffect(() => {
    if (stoppedRef.current) return;
    if (isRunning) {
      onTimerStateChange({
        taskId: task.id,
        taskName: task.name,
        taskColor: task.color,
        isRunning,
        isPaused,
        elapsedMs,
        intervals,
        startTimeRef: startTimeRef.current,
      });
    } else {
      onTimerStateChange(null);
    }
  }, [isRunning, isPaused, intervals]);

  const handleStart = () => {
    const now = Date.now();
    startTimeRef.current = now;
    setIntervals([{ start: now, end: null }]);
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (!isPaused) {
      const now = Date.now();
      setIntervals(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          end: now,
        };
        return updated;
      });
      setIsPaused(true);
    } else {
      const now = Date.now();
      startTimeRef.current = now;
      setIntervals(prev => [...prev, { start: now, end: null }]);
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    // Explicitly clear the interval immediately so timing stops right away
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Mark as stopped so the sync effect doesn't overwrite the cleared timer state
    stoppedRef.current = true;
    onTimerStateChange(null);

    const now = Date.now();
    const finalIntervals = intervals.map((int, idx) => {
      if (idx === intervals.length - 1 && int.end === null) {
        return { ...int, end: now };
      }
      return int;
    });

    const totalMs = finalIntervals.reduce((sum, int) => {
      return sum + ((int.end || now) - int.start);
    }, 0);

    const session: TimingSession = {
      id: generateId(),
      taskId: task.id,
      intervals: finalIntervals,
      totalMs,
      createdAt: finalIntervals[0].start,
      updatedAt: now,
    };

    onSave(session);
    setIsRunning(false);
    setIsPaused(false);
    setElapsedMs(0);
    setIntervals([]);
    onBack();
  };

  const handleCancel = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }
    stoppedRef.current = true;
    onTimerStateChange(null); // Clear timer state
    setIsRunning(false);
    setIsPaused(false);
    setElapsedMs(0);
    setIntervals([]);
    onBack();
  };

  return (
    <div className="timer-screen">
      <div className="timer-header">
        <button onClick={handleCancel} className="back-button">
          ← Cancel
        </button>
        <h2 className="timer-task-name" style={{ color: task.color }}>
          {task.name}
        </h2>
      </div>

      <div className="timer-display-container">
        <div className="timer-display" style={{ '--task-color': task.color } as React.CSSProperties}>
          <div className="time-text">{formatTime(elapsedMs)}</div>
        </div>
      </div>

      <div className="timer-controls">
        {!isRunning ? (
          <button onClick={handleStart} className="control-button start-button">
            Start
          </button>
        ) : (
          <>
            <button
              onClick={handlePause}
              className={`control-button ${isPaused ? 'resume-button' : 'pause-button'}`}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={handleStop} className="control-button stop-button">
              Stop & Save
            </button>
          </>
        )}
      </div>

      {isPaused && (
        <div className="paused-indicator">
          <span>⏸ Paused</span>
        </div>
      )}
    </div>
  );
};
