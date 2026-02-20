import { useState } from 'react';
import type { Category, ItemType } from '../types';
import { useApp } from '../store/AppContext';

import Button from '../components/Button';
import Modal from '../components/Modal';
import ColorPicker from '../components/ColorPicker';
import styles from './CategoriesScreen.module.css';

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSortedChildren(cats: Category[], parentId: string | null): Category[] {
  return cats.filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order);
}

function getAllDescendants(cats: Category[], id: string): string[] {
  const direct = cats.filter((c) => c.parentId === id).map((c) => c.id);
  return [...direct, ...direct.flatMap((cid) => getAllDescendants(cats, cid))];
}

// ── Edit/Create modal ────────────────────────────────────────────────────────

interface EditModalProps {
  initial?: Category;
  categories: Category[];
  defaultColor: string;
  onSave: (cat: Category) => void;
  onClose: () => void;
}

function EditModal({ initial, categories, defaultColor, onSave, onClose }: EditModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ItemType>(initial?.type ?? 'task');
  const [color, setColor] = useState(initial?.color ?? defaultColor);
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);

  const folders = categories.filter((c) => {
    if (c.type !== 'folder') return false;
    if (initial && (c.id === initial.id || getAllDescendants(categories, initial.id).includes(c.id))) return false;
    return true;
  });

  const handleSave = () => {
    if (!name.trim()) return;
    const siblings = categories.filter((c) => c.parentId === parentId && c.id !== initial?.id);
    const cat: Category = {
      id: initial?.id ?? genId(),
      type,
      name: name.trim().slice(0, 80),
      color,
      parentId,
      order: initial?.order ?? siblings.length,
    };
    onSave(cat);
    onClose();
  };

  return (
    <Modal
      title={initial ? 'Edit item' : 'New item'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
            {initial ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className={styles.formField}>
        <label className={styles.formLabel}>Type</label>
        <div className={styles.typeToggle}>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'folder' ? styles.selected : ''}`}
            onClick={() => setType('folder')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Folder
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${type === 'task' ? styles.selected : ''}`}
            onClick={() => setType('task')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="8" />
            </svg>
            Task
          </button>
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Name</label>
        <input
          className={styles.formInput}
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'folder' ? 'e.g. Work, Personal...' : 'e.g. Deep work, Exercise...'}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Parent folder</label>
        <select
          className={styles.formSelect}
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value || null)}
        >
          <option value="">— Root —</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>
    </Modal>
  );
}

// ── Delete confirmation modal ────────────────────────────────────────────────

interface DeleteModalProps {
  item: Category;
  categories: Category[];
  onDelete: (strategy: 'delete-all' | 'reparent' | 'keep-sessions' | 'delete-sessions') => void;
  onClose: () => void;
}

function DeleteModal({ item, categories, onDelete, onClose }: DeleteModalProps) {
  const isFolder = item.type === 'folder';
  const hasChildren = categories.some((c) => c.parentId === item.id);

  return (
    <Modal title={`Delete "${item.name}"`} onClose={onClose}>
      <p className={styles.deleteWarning}>
        {isFolder
          ? hasChildren
            ? `This folder contains items. Choose what to do with them:`
            : `Delete this empty folder?`
          : `Delete this task? Choose what to do with its recorded sessions:`}
      </p>
      <div className={styles.deleteOptions}>
        {isFolder && hasChildren && (
          <>
            <button
              className={styles.deleteOption}
              onClick={() => onDelete('reparent')}
            >
              <div className={styles.deleteOptionTitle}>Move children up</div>
              <div className={styles.deleteOptionDesc}>
                Children become children of this folder's parent.
              </div>
            </button>
            <button
              className={`${styles.deleteOption} ${styles.dangerous}`}
              onClick={() => onDelete('delete-all')}
            >
              <div className={styles.deleteOptionTitle}>Delete all children too</div>
              <div className={styles.deleteOptionDesc}>
                All nested items and sessions will be permanently deleted.
              </div>
            </button>
          </>
        )}

        {!isFolder && (
          <>
            <button
              className={styles.deleteOption}
              onClick={() => onDelete('keep-sessions')}
            >
              <div className={styles.deleteOptionTitle}>Keep sessions</div>
              <div className={styles.deleteOptionDesc}>
                Sessions will remain in storage (orphaned).
              </div>
            </button>
            <button
              className={`${styles.deleteOption} ${styles.dangerous}`}
              onClick={() => onDelete('delete-sessions')}
            >
              <div className={styles.deleteOptionTitle}>Delete all sessions</div>
              <div className={styles.deleteOptionDesc}>
                All time records for this task will be permanently deleted.
              </div>
            </button>
          </>
        )}

        {isFolder && !hasChildren && (
          <button
            className={`${styles.deleteOption} ${styles.dangerous}`}
            onClick={() => onDelete('delete-all')}
          >
            <div className={styles.deleteOptionTitle}>Yes, delete it</div>
            <div className={styles.deleteOptionDesc}>This cannot be undone.</div>
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Tree row ─────────────────────────────────────────────────────────────────

interface TreeRowProps {
  item: Category;
  depth: number;
  siblings: Category[];
  allCats: Category[];
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
  onMove: (item: Category, dir: 'up' | 'down') => void;
}

function TreeRow({ item, depth, siblings, allCats, onEdit, onDelete, onMove }: TreeRowProps) {
  const idx = siblings.indexOf(item);
  const children = getSortedChildren(allCats, item.id);

  return (
    <>
      <div className={styles.treeItem} style={{ paddingLeft: `calc(var(--s3) + ${depth * 24}px)` }}>
        <div
          className={`${styles.badge} ${item.type === 'task' ? styles.task : ''}`}
          style={{ background: item.color + '22', color: item.color }}
          aria-hidden="true"
        >
          {item.type === 'folder' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </div>
        <span className={styles.name}>{item.name}</span>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => onMove(item, 'up')}
            disabled={idx === 0}
            aria-label="Move up"
            title="Move up"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => onMove(item, 'down')}
            disabled={idx === siblings.length - 1}
            aria-label="Move down"
            title="Move down"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => onEdit(item)}
            aria-label="Edit"
            title="Edit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${styles.danger}`}
            onClick={() => onDelete(item)}
            aria-label="Delete"
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {children.map((child) => (
        <TreeRow
          key={child.id}
          item={child}
          depth={depth + 1}
          siblings={children}
          allCats={allCats}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CategoriesScreen() {
  const { state, upsertCategory, deleteCategory, deleteCategories, deleteSessionsByTaskIds } =
    useApp();
  const { settings } = state;
  const { categories } = state;

  const [editItem, setEditItem] = useState<Category | 'new' | null>(null);
  const [deleteItem, setDeleteItem] = useState<Category | null>(null);

  const rootItems = getSortedChildren(categories, null);

  const handleMove = async (item: Category, dir: 'up' | 'down') => {
    const siblings = getSortedChildren(categories, item.parentId);
    const idx = siblings.indexOf(item);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await upsertCategory({ ...item, order: other.order });
    await upsertCategory({ ...other, order: item.order });
  };

  const handleDelete = async (
    strategy: 'delete-all' | 'reparent' | 'keep-sessions' | 'delete-sessions'
  ) => {
    if (!deleteItem) return;

    if (deleteItem.type === 'folder') {
      const descendants = getAllDescendants(categories, deleteItem.id);
      if (strategy === 'delete-all') {
        await deleteSessionsByTaskIds(descendants);
        await deleteCategories([...descendants, deleteItem.id]);
      } else {
        // reparent: move direct children to parent
        const directChildren = categories.filter((c) => c.parentId === deleteItem.id);
        for (const child of directChildren) {
          await upsertCategory({ ...child, parentId: deleteItem.parentId });
        }
        await deleteCategory(deleteItem.id);
      }
    } else {
      if (strategy === 'delete-sessions') {
        await deleteSessionsByTaskIds([deleteItem.id]);
      }
      await deleteCategory(deleteItem.id);
    }

    setDeleteItem(null);
  };

  return (
    <div className={styles.screen}>
      {editItem !== null && (
        <EditModal
          initial={editItem === 'new' ? undefined : editItem}
          categories={categories}
          defaultColor={settings.defaultCategoryColor}
          onSave={(cat) => upsertCategory(cat)}
          onClose={() => setEditItem(null)}
        />
      )}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          categories={categories}
          onDelete={handleDelete}
          onClose={() => setDeleteItem(null)}
        />
      )}

      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Categories</h1>
        <Button variant="primary" size="sm" onClick={() => setEditItem('new')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </Button>
      </div>

      <div className={styles.list}>
        {rootItems.length === 0 ? (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <div className={styles.emptyTitle}>No folders or tasks yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Tap "New" to create your first folder or task.
            </p>
          </div>
        ) : (
          rootItems.map((item) => (
            <TreeRow
              key={item.id}
              item={item}
              depth={0}
              siblings={rootItems}
              allCats={categories}
              onEdit={setEditItem}
              onDelete={setDeleteItem}
              onMove={handleMove}
            />
          ))
        )}
      </div>
    </div>
  );
}
