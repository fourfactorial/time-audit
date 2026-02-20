import { useCallback, useState } from 'react';
import styles from './App.module.css';
import { useApp } from './store/AppContext';
import NavBar from './components/NavBar';
import TimerWidget from './components/TimerWidget';
import InterruptedBanner from './components/InterruptedBanner';
import TimingScreen from './screens/TimingScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import SettingsScreen from './screens/SettingsScreen';

function LoadingScreen() {
  return (
    <div className={styles.loading}>
      <div className={styles.loadingDot} />
    </div>
  );
}

function AppShell() {
  const { state, navigate } = useApp();
  const { screen, loaded } = state;

  // Track which task the timing screen is currently showing (null = browse view)
  const [activeSessionTaskId, setActiveSessionTaskId] = useState<string | null>(null);
  // Task id to jump to on next render of TimingScreen (set by widget tap)
  const [pendingJumpTaskId, setPendingJumpTaskId] = useState<string | null>(null);

  const handleWidgetClick = useCallback((taskId: string) => {
    navigate('timing');
    setPendingJumpTaskId(taskId);
  }, [navigate]);

  const handleJumpConsumed = useCallback(() => {
    setPendingJumpTaskId(null);
  }, []);

  // Widget is hidden only when we're already looking at the active session
  const isOnActiveSession =
    screen === 'timing' &&
    activeSessionTaskId !== null &&
    activeSessionTaskId === state.timer?.taskId;

  if (!loaded) return <LoadingScreen />;

  return (
    <div className={styles.outerShell}>
      {/* Content column — centred, max 768px */}
      <div className={styles.contentCol}>
        <InterruptedBanner />
        <main className={styles.main} role="main">
          {screen === 'timing' && (
            <TimingScreen
              jumpToTaskId={pendingJumpTaskId}
              onJumpConsumed={handleJumpConsumed}
              onActiveSessionChange={setActiveSessionTaskId}
            />
          )}
          {screen === 'analytics'  && <AnalyticsScreen />}
          {screen === 'categories' && <CategoriesScreen />}
          {screen === 'settings'   && <SettingsScreen />}
        </main>

        {/* Floating timer widget — lower-left, absolute within column */}
        <TimerWidget
          onGoToSession={handleWidgetClick}
          isOnActiveSession={isOnActiveSession}
        />
      </div>

      {/* Nav bar — full viewport width */}
      <div className={styles.navRow}>
        <NavBar current={screen} onNavigate={navigate} />
      </div>
    </div>
  );
}

export default AppShell;
