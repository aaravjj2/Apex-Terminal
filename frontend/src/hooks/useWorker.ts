/**
 * useWorker.ts
 * Web Worker management hook with create/terminate, promise-based messaging,
 * error handling, and worker pool management for parallel computation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerMessage<T = any> {
  id: string;
  type: string;
  payload: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  type: string;
  payload: T;
  error?: string;
}

export type WorkerStatus = 'idle' | 'busy' | 'terminated' | 'error';

export interface UseWorkerOptions {
  maxPoolSize?: number;
  timeout?: number;
  onMessage?: (response: WorkerResponse) => void;
  onError?: (error: string) => void;
}

export interface UseWorkerReturn<TReq = any, TRes = any> {
  postMessage: (type: string, payload: TReq) => Promise<TRes>;
  terminate: () => void;
  restart: () => void;
  status: WorkerStatus;
  error: string | null;
  isReady: boolean;
  pendingCount: number;
}

// ─── Single Worker Hook ────────────────────────────────────────────────────────

export function useWorker<TReq = any, TRes = any>(
  workerFactory: () => Worker,
  options: UseWorkerOptions = {}
): UseWorkerReturn<TReq, TRes> {
  const { timeout = 30000, onMessage, onError } = options;

  const [status, setStatus] = useState<WorkerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, {
    resolve: (value: TRes) => void;
    reject: (reason: any) => void;
    timer: ReturnType<typeof setTimeout>;
  }>>(new Map());
  const factoryRef = useRef(workerFactory);

  useEffect(() => { factoryRef.current = workerFactory; }, [workerFactory]);

  const createWorker = useCallback(() => {
    if (workerRef.current) workerRef.current.terminate();

    try {
      const worker = factoryRef.current();

      worker.onmessage = (e: MessageEvent<WorkerResponse<TRes>>) => {
        const response = e.data;
        onMessage?.(response);

        const pending = pendingRef.current.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRef.current.delete(response.id);
          setPendingCount(pendingRef.current.size);

          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve(response.payload);
          }
        }

        if (pendingRef.current.size === 0) setStatus('idle');
      };

      worker.onerror = (e) => {
        const msg = e.message || 'Worker error';
        setError(msg);
        setStatus('error');
        onError?.(msg);

        pendingRef.current.forEach((p) => {
          clearTimeout(p.timer);
          p.reject(new Error(msg));
        });
        pendingRef.current.clear();
        setPendingCount(0);
      };

      workerRef.current = worker;
      setStatus('idle');
      setError(null);
    } catch (err) {
      const msg = `Failed to create worker: ${err}`;
      setError(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [onMessage, onError]);

  useEffect(() => {
    createWorker();
    return () => {
      pendingRef.current.forEach(p => {
        clearTimeout(p.timer);
        p.reject(new Error('Worker terminated'));
      });
      pendingRef.current.clear();
      workerRef.current?.terminate();
    };
  }, []);

  const postMessage = useCallback((type: string, payload: TReq): Promise<TRes> => {
    return new Promise<TRes>((resolve, reject) => {
      if (!workerRef.current || status === 'terminated') {
        reject(new Error('Worker not available'));
        return;
      }

      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const timer = setTimeout(() => {
        pendingRef.current.delete(id);
        setPendingCount(pendingRef.current.size);
        reject(new Error(`Worker timeout after ${timeout}ms`));
      }, timeout);

      pendingRef.current.set(id, { resolve, reject, timer });
      setPendingCount(pendingRef.current.size);
      setStatus('busy');

      const message: WorkerMessage<TReq> = { id, type, payload };
      workerRef.current.postMessage(message);
    });
  }, [status, timeout]);

  const terminate = useCallback(() => {
    pendingRef.current.forEach(p => {
      clearTimeout(p.timer);
      p.reject(new Error('Worker terminated'));
    });
    pendingRef.current.clear();
    setPendingCount(0);
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus('terminated');
  }, []);

  const restart = useCallback(() => {
    terminate();
    setTimeout(createWorker, 0);
  }, [terminate, createWorker]);

  return {
    postMessage, terminate, restart,
    status, error,
    isReady: status === 'idle' || status === 'busy',
    pendingCount,
  };
}

// ─── Worker Pool ───────────────────────────────────────────────────────────────

export interface WorkerPoolReturn<TReq = any, TRes = any> {
  execute: (type: string, payload: TReq) => Promise<TRes>;
  executeAll: (tasks: Array<{ type: string; payload: TReq }>) => Promise<TRes[]>;
  terminateAll: () => void;
  restartAll: () => void;
  poolSize: number;
  busyCount: number;
  isReady: boolean;
}

export function useWorkerPool<TReq = any, TRes = any>(
  workerFactory: () => Worker,
  options: UseWorkerOptions & { poolSize?: number } = {}
): WorkerPoolReturn<TReq, TRes> {
  const { poolSize = navigator.hardwareConcurrency ?? 4, timeout = 30000, onError } = options;

  const workersRef = useRef<Array<{ worker: Worker; busy: boolean; pending: Map<string, any> }>>([]);
  const [busyCount, setBusyCount] = useState(0);

  const initPool = useCallback(() => {
    workersRef.current.forEach(w => w.worker.terminate());
    workersRef.current = [];

    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = workerFactory();
        workersRef.current.push({ worker, busy: false, pending: new Map() });
      } catch (err) {
        onError?.(`Failed to create pool worker ${i}: ${err}`);
      }
    }
  }, [poolSize, workerFactory, onError]);

  useEffect(() => {
    initPool();
    return () => { workersRef.current.forEach(w => w.worker.terminate()); };
  }, []);

  const getIdleWorker = useCallback((): typeof workersRef.current[0] | null => {
    return workersRef.current.find(w => !w.busy) ?? null;
  }, []);

  const execute = useCallback((type: string, payload: TReq): Promise<TRes> => {
    return new Promise<TRes>((resolve, reject) => {
      const entry = getIdleWorker();
      if (!entry) {
        reject(new Error('No idle workers available'));
        return;
      }

      const id = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      entry.busy = true;
      setBusyCount(workersRef.current.filter(w => w.busy).length);

      const timer = setTimeout(() => {
        entry.pending.delete(id);
        entry.busy = false;
        setBusyCount(workersRef.current.filter(w => w.busy).length);
        reject(new Error(`Pool worker timeout after ${timeout}ms`));
      }, timeout);

      entry.pending.set(id, { resolve, reject, timer });

      const origHandler = entry.worker.onmessage;
      entry.worker.onmessage = (e: MessageEvent) => {
        const response = e.data as WorkerResponse<TRes>;
        const p = entry.pending.get(response.id);
        if (p) {
          clearTimeout(p.timer);
          entry.pending.delete(response.id);
          entry.busy = entry.pending.size > 0;
          setBusyCount(workersRef.current.filter(w => w.busy).length);
          response.error ? p.reject(new Error(response.error)) : p.resolve(response.payload);
        }
      };

      entry.worker.postMessage({ id, type, payload });
    });
  }, [getIdleWorker, timeout]);

  const executeAll = useCallback(async (tasks: Array<{ type: string; payload: TReq }>): Promise<TRes[]> => {
    return Promise.all(tasks.map(t => execute(t.type, t.payload)));
  }, [execute]);

  const terminateAll = useCallback(() => {
    workersRef.current.forEach(w => {
      w.pending.forEach(p => { clearTimeout(p.timer); p.reject(new Error('Pool terminated')); });
      w.pending.clear();
      w.worker.terminate();
    });
    workersRef.current = [];
    setBusyCount(0);
  }, []);

  const restartAll = useCallback(() => {
    terminateAll();
    setTimeout(initPool, 0);
  }, [terminateAll, initPool]);

  return {
    execute, executeAll, terminateAll, restartAll,
    poolSize: workersRef.current.length,
    busyCount,
    isReady: workersRef.current.length > 0,
  };
}

export default useWorker;
