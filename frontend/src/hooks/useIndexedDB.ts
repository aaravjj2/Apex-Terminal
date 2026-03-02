/**
 * useIndexedDB.ts
 * IndexedDB operations hook with typed CRUD, store management,
 * index queries, bulk operations, and migration support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StoreConfig {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: Array<{
    name: string;
    keyPath: string | string[];
    unique?: boolean;
    multiEntry?: boolean;
  }>;
}

export interface DBConfig {
  name: string;
  version: number;
  stores: StoreConfig[];
  onUpgrade?: (db: IDBDatabase, oldVersion: number, newVersion: number) => void;
}

export interface QueryOptions {
  index?: string;
  range?: IDBKeyRange;
  direction?: IDBCursorDirection;
  limit?: number;
  offset?: number;
}

export type DBStatus = 'closed' | 'opening' | 'open' | 'error' | 'upgrading';

export interface UseIndexedDBReturn<T = any> {
  status: DBStatus;
  error: string | null;
  get: (store: string, key: IDBValidKey) => Promise<T | undefined>;
  getAll: (store: string, options?: QueryOptions) => Promise<T[]>;
  put: (store: string, value: T, key?: IDBValidKey) => Promise<IDBValidKey>;
  add: (store: string, value: T, key?: IDBValidKey) => Promise<IDBValidKey>;
  delete: (store: string, key: IDBValidKey) => Promise<void>;
  clear: (store: string) => Promise<void>;
  count: (store: string, query?: IDBValidKey | IDBKeyRange) => Promise<number>;
  bulkPut: (store: string, items: T[]) => Promise<IDBValidKey[]>;
  bulkAdd: (store: string, items: T[]) => Promise<IDBValidKey[]>;
  bulkDelete: (store: string, keys: IDBValidKey[]) => Promise<void>;
  query: (store: string, options: QueryOptions) => Promise<T[]>;
  getByIndex: (store: string, indexName: string, key: IDBValidKey) => Promise<T[]>;
  updateWhere: (store: string, predicate: (item: T) => boolean, updater: (item: T) => T) => Promise<number>;
  deleteWhere: (store: string, predicate: (item: T) => boolean) => Promise<number>;
  transaction: <R>(stores: string[], mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<R>) => Promise<R>;
  close: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useIndexedDB<T = any>(config: DBConfig): UseIndexedDBReturn<T> {
  const [status, setStatus] = useState<DBStatus>('closed');
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<IDBDatabase | null>(null);
  const configRef = useRef(config);

  useEffect(() => { configRef.current = config; }, [config]);

  // ── Open Database ──

  const openDB = useCallback((): Promise<IDBDatabase> => {
    if (dbRef.current) return Promise.resolve(dbRef.current);

    return new Promise((resolve, reject) => {
      setStatus('opening');
      const request = indexedDB.open(configRef.current.name, configRef.current.version);

      request.onupgradeneeded = (event) => {
        setStatus('upgrading');
        const db = request.result;
        const oldVersion = event.oldVersion;

        for (const storeConfig of configRef.current.stores) {
          let store: IDBObjectStore;

          if (!db.objectStoreNames.contains(storeConfig.name)) {
            store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement,
            });
          } else {
            store = request.transaction!.objectStore(storeConfig.name);
          }

          storeConfig.indexes?.forEach(idx => {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, {
                unique: idx.unique ?? false,
                multiEntry: idx.multiEntry ?? false,
              });
            }
          });
        }

        configRef.current.onUpgrade?.(db, oldVersion, configRef.current.version);
      };

      request.onsuccess = () => {
        dbRef.current = request.result;
        setStatus('open');
        setError(null);

        request.result.onclose = () => {
          dbRef.current = null;
          setStatus('closed');
        };

        resolve(request.result);
      };

      request.onerror = () => {
        const msg = `Failed to open database: ${request.error?.message}`;
        setError(msg);
        setStatus('error');
        reject(new Error(msg));
      };
    });
  }, []);

  useEffect(() => {
    openDB().catch(() => {});
    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [config.name, config.version]);

  // ── Transaction Helper ──

  const withStore = useCallback(async <R>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest | IDBRequest[]
  ): Promise<R> => {
    const db = await openDB();
    return new Promise<R>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);
      const requests = Array.isArray(result) ? result : [result];

      tx.oncomplete = () => {
        if (requests.length === 1) {
          resolve(requests[0].result as R);
        } else {
          resolve(requests.map(r => r.result) as unknown as R);
        }
      };
      tx.onerror = () => reject(new Error(`Transaction error: ${tx.error?.message}`));
      tx.onabort = () => reject(new Error(`Transaction aborted: ${tx.error?.message}`));
    });
  }, [openDB]);

  // ── CRUD Operations ──

  const get = useCallback(async (store: string, key: IDBValidKey): Promise<T | undefined> => {
    return withStore<T | undefined>(store, 'readonly', s => s.get(key));
  }, [withStore]);

  const getAll = useCallback(async (store: string, options?: QueryOptions): Promise<T[]> => {
    if (options?.limit || options?.offset || options?.index) {
      return query(store, options);
    }
    return withStore<T[]>(store, 'readonly', s => s.getAll(options?.range));
  }, [withStore]);

  const put = useCallback(async (store: string, value: T, key?: IDBValidKey): Promise<IDBValidKey> => {
    return withStore<IDBValidKey>(store, 'readwrite', s => s.put(value, key));
  }, [withStore]);

  const add = useCallback(async (store: string, value: T, key?: IDBValidKey): Promise<IDBValidKey> => {
    return withStore<IDBValidKey>(store, 'readwrite', s => s.add(value, key));
  }, [withStore]);

  const del = useCallback(async (store: string, key: IDBValidKey): Promise<void> => {
    return withStore<void>(store, 'readwrite', s => s.delete(key));
  }, [withStore]);

  const clear = useCallback(async (store: string): Promise<void> => {
    return withStore<void>(store, 'readwrite', s => s.clear());
  }, [withStore]);

  const count = useCallback(async (store: string, queryKey?: IDBValidKey | IDBKeyRange): Promise<number> => {
    return withStore<number>(store, 'readonly', s => s.count(queryKey));
  }, [withStore]);

  // ── Bulk Operations ──

  const bulkPut = useCallback(async (store: string, items: T[]): Promise<IDBValidKey[]> => {
    return withStore<IDBValidKey[]>(store, 'readwrite', s => items.map(item => s.put(item)));
  }, [withStore]);

  const bulkAdd = useCallback(async (store: string, items: T[]): Promise<IDBValidKey[]> => {
    return withStore<IDBValidKey[]>(store, 'readwrite', s => items.map(item => s.add(item)));
  }, [withStore]);

  const bulkDelete = useCallback(async (store: string, keys: IDBValidKey[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      keys.forEach(key => s.delete(key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`Bulk delete error: ${tx.error?.message}`));
    });
  }, [openDB]);

  // ── Index Queries ──

  const query = useCallback(async (store: string, options: QueryOptions): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const s = tx.objectStore(store);
      const source = options.index ? s.index(options.index) : s;
      const results: T[] = [];
      let skipped = 0;

      const cursorReq = source.openCursor(options.range, options.direction);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(results); return; }

        if (options.offset && skipped < options.offset) {
          skipped++;
          cursor.continue();
          return;
        }

        if (options.limit && results.length >= options.limit) {
          resolve(results);
          return;
        }

        results.push(cursor.value);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(new Error(`Query error: ${cursorReq.error?.message}`));
    });
  }, [openDB]);

  const getByIndex = useCallback(async (store: string, indexName: string, key: IDBValidKey): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const index = tx.objectStore(store).index(indexName);
      const req = index.getAll(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`Index query error: ${req.error?.message}`));
    });
  }, [openDB]);

  // ── Conditional Operations ──

  const updateWhere = useCallback(async (store: string, predicate: (item: T) => boolean, updater: (item: T) => T): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      let updated = 0;

      const cursorReq = s.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(updated); return; }
        if (predicate(cursor.value)) {
          cursor.update(updater(cursor.value));
          updated++;
        }
        cursor.continue();
      };
      cursorReq.onerror = () => reject(new Error(`Update error: ${cursorReq.error?.message}`));
    });
  }, [openDB]);

  const deleteWhere = useCallback(async (store: string, predicate: (item: T) => boolean): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      let deleted = 0;

      const cursorReq = s.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(deleted); return; }
        if (predicate(cursor.value)) {
          cursor.delete();
          deleted++;
        }
        cursor.continue();
      };
      cursorReq.onerror = () => reject(new Error(`Delete error: ${cursorReq.error?.message}`));
    });
  }, [openDB]);

  // ── Custom Transaction ──

  const transactionFn = useCallback(async <R>(
    stores: string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<R>
  ): Promise<R> => {
    const db = await openDB();
    const tx = db.transaction(stores, mode);
    return callback(tx);
  }, [openDB]);

  const close = useCallback(() => {
    dbRef.current?.close();
    dbRef.current = null;
    setStatus('closed');
  }, []);

  return {
    status, error,
    get, getAll, put, add,
    delete: del, clear, count,
    bulkPut, bulkAdd, bulkDelete,
    query, getByIndex,
    updateWhere, deleteWhere,
    transaction: transactionFn,
    close,
  };
}

export default useIndexedDB;
