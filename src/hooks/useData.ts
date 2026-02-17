import { useState, useEffect, useCallback } from 'react';
import { Item, TimingSession } from '../types';
import * as db from '../utils/db';

export function useData() {
  const [items, setItems] = useState<Item[]>([]);
  const [sessions, setSessions] = useState<TimingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [loadedItems, loadedSessions] = await Promise.all([
        db.getAllItems(),
        db.getAllSessions(),
      ]);
      setItems(loadedItems);
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addItem = useCallback(async (item: Item) => {
    await db.saveItem(item);
    setItems(prev => [...prev, item]);
  }, []);

  const updateItem = useCallback(async (item: Item) => {
    await db.saveItem(item);
    setItems(prev => prev.map(i => i.id === item.id ? item : i));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await db.deleteItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addSession = useCallback(async (session: TimingSession) => {
    await db.saveSession(session);
    setSessions(prev => [...prev, session]);
  }, []);

  const updateSession = useCallback(async (session: TimingSession) => {
    await db.saveSession(session);
    setSessions(prev => prev.map(s => s.id === session.id ? session : s));
  }, []);

  const removeSession = useCallback(async (id: string) => {
    await db.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  return {
    items,
    sessions,
    loading,
    addItem,
    updateItem,
    removeItem,
    addSession,
    updateSession,
    removeSession,
    reload: loadData,
  };
}
