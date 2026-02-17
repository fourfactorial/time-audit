import { useState, useCallback } from 'react';
import { ViewMode, Item, Task, TimingSession, ActiveTimerState } from './types';
import { useData } from './hooks/useData';
import { useTheme } from './hooks/useTheme';
import { useSettings } from './hooks/useSettings';
import { ItemList } from './components/ItemList';
import { Timer } from './components/Timer';
import { Analytics } from './components/Analytics';
import { ManageItems } from './components/ManageItems';
import { FloatingTimer } from './components/FloatingTimer';
import './App.css';

function App() {
  const {
    items,
    sessions,
    loading,
    addItem,
    updateItem,
    removeItem,
    addSession,
    reload,
  } = useData();

  const { themeMode, changeTheme } = useTheme();
  const { analyticsDefaults, setAnalyticsDefaults } = useSettings();

  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(null);

  const handleSelectItem = (item: Item) => {
    if (item.type === 'category') {
      setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name }]);
      setCurrentCategoryId(item.id);
    } else {
      setSelectedTask(item as Task);
      setViewMode('timer');
    }
  };

  const handleBack = () => {
    if (breadcrumbs.length > 0) {
      const newBreadcrumbs = [...breadcrumbs];
      newBreadcrumbs.pop();
      setBreadcrumbs(newBreadcrumbs);
      setCurrentCategoryId(newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : null);
    }
  };

  const handleBackToHome = () => {
    setViewMode('home');
    setCurrentCategoryId(null);
    if (!activeTimer) {
      setSelectedTask(null);
    }
    setBreadcrumbs([]);
  };

  const handleReturnToTimer = () => {
    if (activeTimer) {
      const task = items.find(item => item.id === activeTimer.taskId) as Task;
      if (task) {
        setSelectedTask(task);
        setViewMode('timer');
      }
    }
  };

  const handleSaveSession = (session: TimingSession) => {
    addSession(session);
    setActiveTimer(null);
  };

  const handleTimerStateChange = useCallback((state: ActiveTimerState | null) => {
    setActiveTimer(state);
  }, []);

  if (loading) {
    return (
      <div className="app loading">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="main-nav">
        <button
          className={viewMode === 'home' ? 'active' : ''}
          onClick={handleBackToHome}
        >
          <span className="nav-icon">⏱</span>
          <span className="nav-label">Track</span>
        </button>
        <button
          className={viewMode === 'analytics' ? 'active' : ''}
          onClick={() => setViewMode('analytics')}
        >
          <span className="nav-icon">▦</span>
          <span className="nav-label">Stats</span>
        </button>
        <button
          className={viewMode === 'manage' ? 'active' : ''}
          onClick={() => setViewMode('manage')}
        >
          <span className="nav-icon">⚙</span>
          <span className="nav-label">Manage</span>
        </button>
      </nav>

      <main className="main-content">
        {viewMode === 'home' && (
          <ItemList
            items={items}
            currentCategoryId={currentCategoryId}
            onSelectItem={handleSelectItem}
            onBack={handleBack}
          />
        )}

        {viewMode === 'timer' && selectedTask && (
          <Timer
            task={selectedTask}
            onSave={handleSaveSession}
            onBack={handleBackToHome}
            activeTimer={activeTimer}
            onTimerStateChange={handleTimerStateChange}
          />
        )}

        {viewMode === 'analytics' && (
          <Analytics
            items={items}
            sessions={sessions}
            onBack={handleBackToHome}
            defaultTimeRange={analyticsDefaults.timeRange}
            defaultCustomStart={analyticsDefaults.customStart}
            defaultCustomEnd={analyticsDefaults.customEnd}
          />
        )}

        {viewMode === 'manage' && (
          <ManageItems
            items={items}
            onAdd={addItem}
            onUpdate={updateItem}
            onDelete={removeItem}
            onBack={handleBackToHome}
            onImport={reload}
            themeMode={themeMode}
            onThemeChange={changeTheme}
            analyticsDefaults={analyticsDefaults}
            onAnalyticsDefaultsChange={setAnalyticsDefaults}
          />
        )}
      </main>

      {activeTimer && viewMode !== 'timer' && (
        <FloatingTimer
          timerState={activeTimer}
          onReturnToTimer={handleReturnToTimer}
        />
      )}
    </div>
  );
}

export default App;
