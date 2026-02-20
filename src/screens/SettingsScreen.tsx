import { useRef, useState } from 'react';
import type { Theme } from '../types';
import { useApp } from '../store/AppContext';
import { exportAllData, importAllData, deleteAllData } from '../db/db';
import Button from '../components/Button';
import ColorPicker from '../components/ColorPicker';
import styles from './SettingsScreen.module.css';

export default function SettingsScreen() {
  const { state, updateSettings, reloadAll } = useApp();
  const { settings } = state;
  const [deleteStep, setDeleteStep] = useState(0); // 0 = hidden, 1 = first confirm, 2 = second confirm
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportSuccess(false);
    try {
      const text = await file.text();
      await importAllData(text);
      await reloadAll();
      setImportSuccess(true);
    } catch (err) {
      setImportError('Failed to import. Make sure the file is a valid TimeTracker backup.');
    }
    e.target.value = '';
  };

  const handleDeleteAll = async () => {
    await deleteAllData();
    await reloadAll();
    setDeleteStep(0);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Settings</h1>
      </div>

      <div className={styles.body}>
        {/* Theme */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 'var(--s3)' }}>Theme</div>
            <div className={styles.themeOptions}>
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <button
                  key={t}
                  className={`${styles.themeBtn} ${settings.theme === t ? styles.active : ''}`}
                  onClick={() => updateSettings({ theme: t })}
                >
                  {t === 'light' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : t === 'dark' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  )}
                  {t === 'system' ? 'System' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Default category color */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Categories</div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 'var(--s3)' }}>
              Default color for new folders &amp; tasks
            </div>
            <ColorPicker
              value={settings.defaultCategoryColor}
              onChange={(color) => updateSettings({ defaultCategoryColor: color })}
            />
          </div>
        </div>

        {/* Analytics */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Analytics</div>

          <div className={styles.optionRow}>
            <div className={styles.optionLabel}>
              <div className={styles.optionTitle}>Exclude zero days from average</div>
              <div className={styles.optionDesc}>
                Days with no recorded time won't count toward the daily average
              </div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={settings.analyticsExcludeZeroDays}
                onChange={(e) => updateSettings({ analyticsExcludeZeroDays: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          <div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 'var(--s3)' }}>
              Custom range defaults (leave blank to use today's date)
            </div>
            <div className={styles.dateRow} style={{ marginBottom: 'var(--s2)' }}>
              <span className={styles.dateLabel}>Start</span>
              <input
                type="date"
                className={styles.dateInput}
                value={settings.analyticsCustomDefaultStart ?? ''}
                onChange={(e) => updateSettings({ analyticsCustomDefaultStart: e.target.value || null })}
              />
            </div>
            <div className={styles.dateRow}>
              <span className={styles.dateLabel}>End</span>
              <input
                type="date"
                className={styles.dateInput}
                value={settings.analyticsCustomDefaultEnd ?? ''}
                onChange={(e) => updateSettings({ analyticsCustomDefaultEnd: e.target.value || null })}
              />
            </div>
          </div>
        </div>

        {/* Import / Export */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Data</div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />

          <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={handleExport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export backup
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import backup
            </Button>
          </div>

          {importSuccess && (
            <div style={{ fontSize: 13, color: 'var(--success)', padding: 'var(--s2) 0' }}>
              ✓ Import successful
            </div>
          )}
          {importError && (
            <div style={{ fontSize: 13, color: 'var(--danger)', padding: 'var(--s2) 0' }}>
              {importError}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Backups are stored as JSON files. Importing merges data — existing entries with the same ID are updated, and new entries are added. Your current data is not deleted.
          </div>
        </div>

        {/* Danger zone */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Danger zone</div>
          <div className={styles.dangerSection}>
            <div className={styles.dangerTitle}>Delete all data</div>
            <div className={styles.dangerDesc}>
              Permanently deletes all categories, sessions, and settings. This cannot be undone.
            </div>

            {deleteStep === 0 && (
              <Button variant="danger" size="sm" onClick={() => setDeleteStep(1)}>
                Delete all data…
              </Button>
            )}

            {deleteStep === 1 && (
              <div className={styles.confirmBox}>
                <div className={styles.confirmText}>
                  Are you sure? All your time tracking data will be permanently erased.
                </div>
                <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                  <Button variant="secondary" size="sm" onClick={() => setDeleteStep(0)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteStep(2)}>
                    Yes, continue
                  </Button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className={styles.confirmBox}>
                <div className={styles.confirmText}>
                  <strong>Final confirmation.</strong> There is no undo. Click below to permanently delete everything.
                </div>
                <div style={{ display: 'flex', gap: 'var(--s3)' }}>
                  <Button variant="secondary" size="sm" onClick={() => setDeleteStep(0)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteAll}>
                    Delete everything
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', paddingTop: 'var(--s4)' }}>
          TimeTracker — all data stored locally on your device
        </div>
      </div>
    </div>
  );
}
