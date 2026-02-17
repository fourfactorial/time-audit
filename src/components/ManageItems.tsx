import { AnalyticsDefaults } from '../hooks/useSettings';
import React, { useState } from 'react';
import { Item, ThemeMode } from '../types';
import { generateId, DEFAULT_COLORS } from '../utils/helpers';
import * as db from '../utils/db';
import { downloadJSON } from '../utils/helpers';

interface ManageItemsProps {
  items: Item[];
  onAdd: (item: Item) => void;
  onUpdate: (item: Item) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onImport: () => void;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  analyticsDefaults: AnalyticsDefaults;
  onAnalyticsDefaultsChange: (d: AnalyticsDefaults) => void;
}

export const ManageItems: React.FC<ManageItemsProps> = ({
  items,
  onAdd,
  onUpdate,
  onDelete,
  onBack,
  onImport,
  themeMode,
  onThemeChange,
  analyticsDefaults,
  onAnalyticsDefaultsChange,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [deleteSessionCount, setDeleteSessionCount] = useState(0);
  const [showClearData, setShowClearData] = useState(false);
  const [clearStartDate, setClearStartDate] = useState('');
  const [clearEndDate, setClearEndDate] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    color: DEFAULT_COLORS[0],
    type: 'task' as 'category' | 'task',
    parentId: null as string | null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    if (editingId) {
      const existingItem = items.find(i => i.id === editingId);
      if (existingItem) {
        const updatedItem: Item = {
          ...existingItem,
          name: formData.name.trim(),
          color: formData.color,
          parentId: formData.parentId,
        };
        onUpdate(updatedItem);
      }
    } else {
      const newItem: Item = {
        id: generateId(),
        name: formData.name.trim(),
        color: formData.color,
        parentId: formData.parentId,
        type: formData.type,
      };
      onAdd(newItem);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: DEFAULT_COLORS[0],
      type: 'task',
      parentId: null,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: Item) => {
    setFormData({
      name: item.name,
      color: item.color,
      type: item.type,
      parentId: item.parentId,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleParentChange = (parentId: string | null) => {
    setFormData(prev => ({
      ...prev,
      parentId,
    }));
  };

  const handleDeleteItem = async (item: Item) => {
    if (item.type === 'task') {
      // Check if there are sessions for this task
      const sessions = await db.getSessionsByTask(item.id);
      
      if (sessions.length > 0) {
        // Show custom dialog with options
        setItemToDelete(item);
        setDeleteSessionCount(sessions.length);
        setShowDeleteDialog(true);
      } else {
        // No sessions, just confirm deletion
        if (confirm(`Delete "${item.name}"?`)) {
          onDelete(item.id);
        }
      }
    } else {
      // For categories, just confirm deletion
      if (confirm(`Delete category "${item.name}"?`)) {
        onDelete(item.id);
      }
    }
  };

  const handleDeleteTaskOnly = () => {
    if (itemToDelete) {
      onDelete(itemToDelete.id);
      setShowDeleteDialog(false);
      setItemToDelete(null);
      setDeleteSessionCount(0);
    }
  };

  const handleDeleteTaskAndSessions = async () => {
    if (itemToDelete) {
      await db.deleteSessionsByTask(itemToDelete.id);
      onDelete(itemToDelete.id);
      setShowDeleteDialog(false);
      setItemToDelete(null);
      setDeleteSessionCount(0);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setItemToDelete(null);
    setDeleteSessionCount(0);
  };

  const handleClearAllData = async () => {
    const confirmed = confirm(
      'Clear ALL data?\n\nThis will delete ALL categories, tasks, and recorded sessions.\n\nThis action cannot be undone!'
    );
    
    if (confirmed) {
      const doubleConfirm = confirm('Are you absolutely sure? All data will be permanently deleted.');
      if (doubleConfirm) {
        await db.clearAllData();
        onImport(); // Reload to show empty state
      }
    }
  };

  const handleClearDataRange = async () => {
    if (!clearStartDate || !clearEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    const start = new Date(clearStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(clearEndDate);
    end.setHours(23, 59, 59, 999);

    const confirmed = confirm(
      `Clear all sessions from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}?\n\nThis will delete all recorded sessions in this date range.\n\nThis action cannot be undone!`
    );

    if (confirmed) {
      const count = await db.clearSessionsInRange(start.getTime(), end.getTime());
      alert(`Deleted ${count} session(s).`);
      onImport(); // Reload data
      setShowClearData(false);
      setClearStartDate('');
      setClearEndDate('');
    }
  };

  const handleExport = async () => {
    const data = await db.exportData();
    downloadJSON(data, `time-tracker-export-${Date.now()}.json`);
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await db.importData(data);
          onImport();
          alert('Data imported successfully!');
        } catch (error) {
          alert('Error importing data. Please check the file format.');
          console.error(error);
        }
      }
    };
    input.click();
  };

  const categories = items.filter(i => i.type === 'category');

  // Build tree structure for display
  const buildItemTree = () => {
    const rootItems = items.filter(i => i.parentId === null);
    const tree: Array<{ item: Item; depth: number }> = [];

    const addItemAndChildren = (item: Item, depth: number) => {
      tree.push({ item, depth });
      const children = items.filter(i => i.parentId === item.id);
      children.forEach(child => addItemAndChildren(child, depth + 1));
    };

    rootItems.forEach(item => addItemAndChildren(item, 0));
    return tree;
  };

  const itemTree = buildItemTree();

  return (
    <div className="manage-screen">
      <div className="manage-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h2>Manage Items</h2>
      </div>

      <div className="theme-selector-section">
        <h3>Theme</h3>
        <div className="theme-options">
          <button
            className={`theme-option ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => onThemeChange('light')}
          >
            ☀️ Light
          </button>
          <button
            className={`theme-option ${themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => onThemeChange('dark')}
          >
            🌙 Dark
          </button>
          <button
            className={`theme-option ${themeMode === 'system' ? 'active' : ''}`}
            onClick={() => onThemeChange('system')}
          >
            💻 System
          </button>
        </div>
      </div>

      <div className="analytics-defaults-section">
        <h3>Analytics Default View</h3>
        <div className="analytics-defaults-controls">
          <div className="form-group">
            <label>Default Time Range</label>
            <div className="radio-group">
              {(['7days', '28days', '6months', 'custom'] as const).map(range => (
                <label key={range}>
                  <input
                    type="radio"
                    name="defaultTimeRange"
                    value={range}
                    checked={analyticsDefaults.timeRange === range}
                    onChange={() => onAnalyticsDefaultsChange({ ...analyticsDefaults, timeRange: range })}
                  />
                  {range === '7days' ? 'Last 7 Days'
                    : range === '28days' ? 'Last 28 Days'
                    : range === '6months' ? 'Last 6 Months'
                    : 'Custom Range'}
                </label>
              ))}
            </div>
          </div>

          {analyticsDefaults.timeRange === 'custom' && (
            <div className="analytics-defaults-custom-range">
              <div className="form-group">
                <label>Default Start Date <span className="optional-hint">(optional)</span></label>
                <input
                  type="date"
                  value={analyticsDefaults.customStart}
                  onChange={e => onAnalyticsDefaultsChange({ ...analyticsDefaults, customStart: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Default End Date <span className="optional-hint">(leave blank for today)</span></label>
                <input
                  type="date"
                  value={analyticsDefaults.customEnd}
                  onChange={e => onAnalyticsDefaultsChange({ ...analyticsDefaults, customEnd: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="manage-actions">
        <button onClick={() => setShowForm(true)} className="action-button primary">
          + Add New
        </button>
        <button onClick={handleExport} className="action-button">
          Export Data
        </button>
        <button onClick={handleImportClick} className="action-button">
          Import Data
        </button>
        <button onClick={() => setShowClearData(true)} className="action-button warning">
          Clear Data...
        </button>
      </div>

      {showForm && (
        <div className="form-overlay">
          <div className="form-container">
            <h3>{editingId ? 'Edit Item' : 'Create New Item'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  maxLength={80}
                  placeholder="Enter name..."
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Type</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="task"
                      checked={formData.type === 'task'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'task' })}
                      disabled={!!editingId}
                    />
                    Task
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="category"
                      checked={formData.type === 'category'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'category' })}
                      disabled={!!editingId}
                    />
                    Category
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="color-input"
                />
              </div>

              <div className="form-group">
                <label>Parent Category (optional)</label>
                <div className="parent-selector">
                  <label className="parent-radio">
                    <input
                      type="radio"
                      checked={formData.parentId === null}
                      onChange={() => handleParentChange(null)}
                    />
                    <span className="parent-radio-label">None (Root Level)</span>
                  </label>
                  {categories.length === 0 ? (
                    <p className="no-categories">No categories available</p>
                  ) : (
                    categories.map(cat => (
                      <label key={cat.id} className="parent-radio">
                        <input
                          type="radio"
                          checked={formData.parentId === cat.id}
                          onChange={() => handleParentChange(cat.id)}
                        />
                        <span style={{ backgroundColor: cat.color }} className="parent-color-badge"></span>
                        <span className="parent-radio-label">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="form-buttons">
                <button type="submit" className="submit-button">
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={resetForm} className="cancel-button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteDialog && itemToDelete && (
        <div className="form-overlay">
          <div className="form-container">
            <h3>Delete "{itemToDelete.name}"?</h3>
            
            <p className="delete-warning">
              This task has <strong>{deleteSessionCount}</strong> recorded session{deleteSessionCount !== 1 ? 's' : ''}.
            </p>

            <div className="delete-options">
              <button 
                onClick={handleDeleteTaskAndSessions}
                className="delete-option-button danger"
              >
                Delete Task & Sessions
              </button>
              <p className="delete-option-description">
                Permanently delete the task and all {deleteSessionCount} recorded session{deleteSessionCount !== 1 ? 's' : ''}
              </p>

              <button 
                onClick={handleDeleteTaskOnly}
                className="delete-option-button warning"
              >
                Delete Task Only
              </button>
              <p className="delete-option-description">
                Keep the {deleteSessionCount} session{deleteSessionCount !== 1 ? 's' : ''}, but remove the task
              </p>
            </div>

            <div className="form-buttons">
              <button 
                type="button" 
                onClick={handleCancelDelete}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearData && (
        <div className="form-overlay">
          <div className="form-container">
            <h3>Clear Data</h3>
            
            <div className="clear-data-options">
              <button 
                onClick={handleClearAllData}
                className="clear-option-button danger"
              >
                Clear All Data
              </button>
              <p className="clear-option-description">
                Delete all categories, tasks, and recorded sessions
              </p>

              <div className="clear-range-section">
                <h4>Clear Sessions by Date Range</h4>
                <div className="date-range-inputs">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={clearStartDate}
                      onChange={(e) => setClearStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={clearEndDate}
                      onChange={(e) => setClearEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleClearDataRange}
                  className="clear-option-button"
                  disabled={!clearStartDate || !clearEndDate}
                >
                  Clear Sessions in Range
                </button>
                <p className="clear-option-description">
                  Delete all recorded sessions between these dates
                </p>
              </div>
            </div>

            <div className="form-buttons">
              <button 
                type="button" 
                onClick={() => {
                  setShowClearData(false);
                  setClearStartDate('');
                  setClearEndDate('');
                }}
                className="cancel-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="items-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <p>No items yet. Click "Add New" to create one.</p>
          </div>
        ) : (
          itemTree.map(({ item, depth }) => (
            <div key={item.id} className="item-row-container">
              {depth > 0 && (
                <div className="tree-structure" style={{ '--tree-depth': depth } as React.CSSProperties}>
                  {Array.from({ length: depth }).map((_, i) => (
                    <span key={i} className="tree-line">│</span>
                  ))}
                  <span className="tree-branch">└─</span>
                </div>
              )}
              <div className="item-row">
                <div className="item-info">
                  <div
                    className="item-color-badge"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="item-row-name">{item.name}</span>
                  <span className="item-row-type">{item.type}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(item)} className="edit-button">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
