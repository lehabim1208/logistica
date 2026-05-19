import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'logiruta_db';
const STORE_NAME = 'sync_queue';
const DB_VERSION = 1;

export interface SyncItem {
  id?: number;
  type: 'delivery_update' | 'fund_change' | 'notes_update';
  data: any;
  timestamp: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export const dbLocal = {
  async addToQueue(item: Omit<SyncItem, 'id' | 'timestamp'>) {
    const db = await getDB();
    const newItem: SyncItem = {
      ...item,
      timestamp: new Date().toISOString()
    };
    return db.add(STORE_NAME, newItem);
  },

  async getQueue(): Promise<SyncItem[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async clearQueue() {
    const db = await getDB();
    return db.clear(STORE_NAME);
  },

  async removeFromQueue(id: number) {
    const db = await getDB();
    return db.delete(STORE_NAME, id);
  }
};

// Background sync logic listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('App is online. Attempting to sync...');
    const queue = await dbLocal.getQueue();
    if (queue.length === 0) return;

    try {
      // In a real app, this would be a POST to /api/sync
      // For this app, we'll simulate the sync and then clear the queue
      console.log(`Syncing ${queue.length} items...`, queue);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await dbLocal.clearQueue();
      console.log('Sync completed successfully.');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  });
}
