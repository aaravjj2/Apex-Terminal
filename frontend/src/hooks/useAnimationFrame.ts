/**
 * useAnimationFrame.ts
 * requestAnimationFrame loop hook with FPS tracking, pause/resume,
 * and multi-callback management for smooth animations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FrameCallback = (deltaMs: number, elapsedMs: number, fps: number) => void;

export interface UseAnimationFrameOptions {
  autoStart?: boolean;
  targetFps?: number;
  onFrame?: FrameCallback;
}

export interface UseAnimationFrameReturn {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  isRunning: boolean;
  isPaused: boolean;
  fps: number;
  elapsed: number;
  frameCount: number;
  addCallback: (id: string, cb: FrameCallback) => void;
  removeCallback: (id: string) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAnimationFrame(options: UseAnimationFrameOptions = {}): UseAnimationFrameReturn {
  const { autoStart = false, targetFps = 0, onFrame } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fps, setFps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsAccumulatorRef = useRef<number[]>([]);
  const callbacksRef = useRef<Map<string, FrameCallback>>(new Map());
  const onFrameRef = useRef(onFrame);
  const minFrameInterval = targetFps > 0 ? 1000 / targetFps : 0;

  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  const loop = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;

    const delta = timestamp - lastFrameTimeRef.current;

    if (minFrameInterval > 0 && delta < minFrameInterval) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    lastFrameTimeRef.current = timestamp;
    const elapsedMs = timestamp - startTimeRef.current;
    frameCountRef.current++;

    fpsAccumulatorRef.current.push(delta);
    if (fpsAccumulatorRef.current.length > 30) fpsAccumulatorRef.current.shift();
    const avgDelta = fpsAccumulatorRef.current.reduce((s, v) => s + v, 0) / fpsAccumulatorRef.current.length;
    const currentFps = avgDelta > 0 ? Math.round(1000 / avgDelta) : 0;

    setFps(currentFps);
    setElapsed(elapsedMs);
    setFrameCount(frameCountRef.current);

    onFrameRef.current?.(delta, elapsedMs, currentFps);
    callbacksRef.current.forEach(cb => cb(delta, elapsedMs, currentFps));

    rafRef.current = requestAnimationFrame(loop);
  }, [minFrameInterval]);

  const start = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startTimeRef.current = 0;
    lastFrameTimeRef.current = 0;
    frameCountRef.current = 0;
    fpsAccumulatorRef.current = [];
    setIsRunning(true);
    setIsPaused(false);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
    lastFrameTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [isPaused, loop]);

  const toggle = useCallback(() => {
    if (!isRunning) start();
    else if (isPaused) resume();
    else pause();
  }, [isRunning, isPaused, start, pause, resume]);

  const addCallback = useCallback((id: string, cb: FrameCallback) => {
    callbacksRef.current.set(id, cb);
  }, []);

  const removeCallback = useCallback((id: string) => {
    callbacksRef.current.delete(id);
  }, []);

  useEffect(() => {
    if (autoStart) start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    start, stop, pause, resume, toggle,
    isRunning, isPaused, fps, elapsed, frameCount,
    addCallback, removeCallback,
  };
}

export default useAnimationFrame;
