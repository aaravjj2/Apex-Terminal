// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface WorkerTask<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  data: TInput;
  priority: TaskPriority;
  timeout?: number;
  transferables?: Transferable[];
  onProgress?: (progress: number) => void;
  resolve: (result: TOutput) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

export interface WorkerMessage {
  type: 'result' | 'error' | 'progress' | 'ready';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgTaskDuration: number;
}

interface ManagedWorker {
  worker: Worker;
  busy: boolean;
  currentTaskId: string | null;
  currentTask: WorkerTask | null;
  startedAt: number;
  completedCount: number;
  errorCount: number;
}

// ============================================================================
// Worker Pool
// ============================================================================

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class WorkerPool {
  private workers: ManagedWorker[] = [];
  private taskQueue: WorkerTask[] = [];
  private taskDurations: number[] = [];
  private completedTasks = 0;
  private failedTasks = 0;
  private timeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();
  private maxPoolSize: number;
  private workerFactory: () => Worker;

  constructor(workerFactory: () => Worker, poolSize?: number) {
    this.maxPoolSize = poolSize ?? Math.min(navigator.hardwareConcurrency ?? 4, 8);
    this.workerFactory = workerFactory;
    this.initWorkers();
  }

  private initWorkers(): void {
    for (let i = 0; i < this.maxPoolSize; i++) {
      this.addWorker();
    }
  }

  private addWorker(): ManagedWorker {
    const worker = this.workerFactory();
    const managed: ManagedWorker = {
      worker,
      busy: false,
      currentTaskId: null,
      currentTask: null,
      startedAt: 0,
      completedCount: 0,
      errorCount: 0,
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(managed, event.data);
    };

    worker.onerror = (event: ErrorEvent) => {
      this.handleWorkerError(managed, event);
    };

    this.workers.push(managed);
    return managed;
  }

  submit<TInput, TOutput>(
    type: string,
    data: TInput,
    options: {
      priority?: TaskPriority;
      timeout?: number;
      transferables?: Transferable[];
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<TOutput> {
    return new Promise<TOutput>((resolve, reject) => {
      const task: WorkerTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        type,
        data,
        priority: options.priority ?? 'normal',
        timeout: options.timeout,
        transferables: options.transferables,
        onProgress: options.onProgress,
        resolve: resolve as (result: unknown) => void,
        reject,
        createdAt: Date.now(),
      };

      this.enqueue(task);
      this.dispatch();
    });
  }

  private enqueue(task: WorkerTask): void {
    let insertIdx = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (PRIORITY_ORDER[task.priority] < PRIORITY_ORDER[this.taskQueue[i].priority]) {
        insertIdx = i;
        break;
      }
    }
    this.taskQueue.splice(insertIdx, 0, task);
  }

  private dispatch(): void {
    for (const managed of this.workers) {
      if (!managed.busy && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        this.assignTask(managed, task);
      }
    }
  }

  private assignTask(managed: ManagedWorker, task: WorkerTask): void {
    managed.busy = true;
    managed.currentTaskId = task.id;
    managed.currentTask = task;
    managed.startedAt = Date.now();

    const message = {
      type: 'execute',
      taskId: task.id,
      taskType: task.type,
      data: task.data,
    };

    try {
      if (task.transferables?.length) {
        managed.worker.postMessage(message, task.transferables);
      } else {
        managed.worker.postMessage(message);
      }
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
      this.releaseWorker(managed);
      return;
    }

    if (task.timeout) {
      this.timeoutHandles.set(
        task.id,
        setTimeout(() => {
          task.reject(new Error('Task ' + task.id + ' timed out after ' + task.timeout + 'ms'));
          this.failedTasks++;
          this.restartWorker(managed);
        }, task.timeout)
      );
    }
  }

  private handleMessage(managed: ManagedWorker, message: WorkerMessage): void {
    const task = managed.currentTask;
    if (!task) return;

    clearTimeout(this.timeoutHandles.get(task.id));
    this.timeoutHandles.delete(task.id);

    switch (message.type) {
      case 'result': {
        const duration = Date.now() - managed.startedAt;
        this.taskDurations.push(duration);
        if (this.taskDurations.length > 1000) this.taskDurations.shift();
        this.completedTasks++;
        managed.completedCount++;
        task.resolve(message.data);
        this.releaseWorker(managed);
        break;
      }
      case 'error':
        this.failedTasks++;
        managed.errorCount++;
        task.reject(new Error(message.error ?? 'Unknown worker error'));
        this.releaseWorker(managed);
        break;
      case 'progress':
        task.onProgress?.(message.progress ?? 0);
        break;
    }
  }

  private handleWorkerError(managed: ManagedWorker, event: ErrorEvent): void {
    const task = managed.currentTask;
    if (task) {
      clearTimeout(this.timeoutHandles.get(task.id));
      this.timeoutHandles.delete(task.id);
      task.reject(new Error(event.message));
      this.failedTasks++;
    }
    this.restartWorker(managed);
  }

  private releaseWorker(managed: ManagedWorker): void {
    managed.busy = false;
    managed.currentTaskId = null;
    managed.currentTask = null;
    this.dispatch();
  }

  private restartWorker(managed: ManagedWorker): void {
    managed.worker.terminate();
    const idx = this.workers.indexOf(managed);
    if (idx !== -1) this.workers.splice(idx, 1);
    const newManaged = this.addWorker();
    newManaged.completedCount = managed.completedCount;
    newManaged.errorCount = managed.errorCount;
    this.dispatch();
  }

  getStats(): WorkerPoolStats {
    const active = this.workers.filter(w => w.busy).length;
    const avgDuration =
      this.taskDurations.length > 0
        ? this.taskDurations.reduce((s, v) => s + v, 0) / this.taskDurations.length
        : 0;

    return {
      totalWorkers: this.workers.length,
      activeWorkers: active,
      idleWorkers: this.workers.length - active,
      pendingTasks: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      avgTaskDuration: Math.round(avgDuration),
    };
  }

  resize(newSize: number): void {
    while (this.workers.length < newSize) this.addWorker();
    while (this.workers.length > newSize) {
      const idle = this.workers.find(w => !w.busy);
      if (idle) {
        idle.worker.terminate();
        this.workers.splice(this.workers.indexOf(idle), 1);
      } else {
        break;
      }
    }
    this.dispatch();
  }

  terminate(): void {
    for (const handle of this.timeoutHandles.values()) clearTimeout(handle);
    this.timeoutHandles.clear();

    for (const task of this.taskQueue) {
      task.reject(new Error('Worker pool terminated'));
    }
    this.taskQueue = [];

    for (const managed of this.workers) {
      managed.worker.terminate();
    }
    this.workers = [];
  }
}

// ============================================================================
// Shared ArrayBuffer Utilities
// ============================================================================

export function createSharedFloat64Array(length: number): {
  buffer: SharedArrayBuffer;
  array: Float64Array;
} {
  const buffer = new SharedArrayBuffer(length * Float64Array.BYTES_PER_ELEMENT);
  return { buffer, array: new Float64Array(buffer) };
}

export function createSharedInt32Array(length: number): {
  buffer: SharedArrayBuffer;
  array: Int32Array;
} {
  const buffer = new SharedArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT);
  return { buffer, array: new Int32Array(buffer) };
}

export function createSharedUint8Array(length: number): {
  buffer: SharedArrayBuffer;
  array: Uint8Array;
} {
  const buffer = new SharedArrayBuffer(length);
  return { buffer, array: new Uint8Array(buffer) };
}

export function atomicIncrement(array: Int32Array, index: number): number {
  return Atomics.add(array, index, 1) + 1;
}

export function atomicWait(
  array: Int32Array,
  index: number,
  value: number,
  timeout?: number
): 'ok' | 'not-equal' | 'timed-out' {
  return Atomics.wait(array, index, value, timeout);
}

export function atomicNotify(
  array: Int32Array,
  index: number,
  count?: number
): number {
  return Atomics.notify(array, index, count);
}

// ============================================================================
// Transferable Object Helpers
// ============================================================================

export function toTransferable(
  data: Float64Array | Float32Array | Int32Array | Uint8Array | ArrayBuffer
): { data: ArrayBuffer; transferables: Transferable[] } {
  const buffer = data instanceof ArrayBuffer ? data : data.buffer;
  return { data: buffer, transferables: [buffer] };
}

export function cloneArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const clone = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(clone).set(new Uint8Array(buffer));
  return clone;
}

// ============================================================================
// Inline Worker Creation
// ============================================================================

export function createInlineWorker(workerFn: () => void): Worker {
  const blob = new Blob(
    ['(' + workerFn.toString() + ')()'],
    { type: 'application/javascript' }
  );
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  const origTerminate = worker.terminate.bind(worker);
  worker.terminate = () => {
    URL.revokeObjectURL(url);
    origTerminate();
  };

  return worker;
}

// ============================================================================
// Offscreen Canvas Worker Support
// ============================================================================

export interface OffscreenRenderMessage {
  type: 'init' | 'render' | 'resize' | 'destroy';
  canvas?: OffscreenCanvas;
  width?: number;
  height?: number;
  data?: unknown;
}

export function transferCanvasToWorker(
  canvas: HTMLCanvasElement,
  worker: Worker,
  initData?: unknown
): void {
  const offscreen = canvas.transferControlToOffscreen();
  const message: OffscreenRenderMessage = {
    type: 'init',
    canvas: offscreen,
    width: canvas.width,
    height: canvas.height,
    data: initData,
  };
  worker.postMessage(message, [offscreen]);
}

export function requestWorkerRender(worker: Worker, data: unknown): void {
  worker.postMessage({ type: 'render', data } as OffscreenRenderMessage);
}

export function resizeWorkerCanvas(
  worker: Worker,
  width: number,
  height: number
): void {
  worker.postMessage({ type: 'resize', width, height } as OffscreenRenderMessage);
}

// ============================================================================
// Worker-based Computation Helpers
// ============================================================================

export function createComputeWorker(): Worker {
  return createInlineWorker(() => {
    const ctx = self as unknown as {
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: (message: unknown) => void;
    };

    ctx.onmessage = (event: MessageEvent) => {
      const { taskId, taskType, data } = event.data;
      try {
        let result: unknown;
        switch (taskType) {
          case 'sort':
            result = (data as number[]).sort((a: number, b: number) => a - b);
            break;
          case 'stats': {
            const arr = data as number[];
            const n = arr.length;
            const sum = arr.reduce((s: number, v: number) => s + v, 0);
            const mn = sum / n;
            const vr = arr.reduce((s: number, v: number) => s + (v - mn) ** 2, 0) / (n - 1);
            const sorted = [...arr].sort((a: number, b: number) => a - b);
            result = {
              mean: mn,
              variance: vr,
              stdDev: Math.sqrt(vr),
              min: sorted[0],
              max: sorted[n - 1],
              median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
            };
            break;
          }
          default:
            throw new Error('Unknown task type: ' + taskType);
        }
        ctx.postMessage({ type: 'result', taskId, data: result });
      } catch (err) {
        ctx.postMessage({ type: 'error', taskId, error: (err as Error).message });
      }
    };
  });
}
