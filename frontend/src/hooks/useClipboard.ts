/**
 * useClipboard.ts
 * Clipboard operations hook with copy/read support, success/error state
 * tracking, and automatic reset after configurable timeout.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClipboardStatus = 'idle' | 'copied' | 'error';

export interface UseClipboardOptions {
  resetTimeoutMs?: number;
  onCopy?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  read: () => Promise<string | null>;
  status: ClipboardStatus;
  error: string | null;
  hasCopied: boolean;
  reset: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { resetTimeoutMs = 2000, onCopy, onError } = options;

  const [status, setStatus] = useState<ClipboardStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus('idle');
      setError(null);
    }, resetTimeoutMs);
  }, [resetTimeoutMs]);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setStatus('copied');
      setError(null);
      onCopy?.(text);
      scheduleReset();
      return true;
    } catch (err) {
      const msg = `Copy failed: ${err}`;
      setStatus('error');
      setError(msg);
      onError?.(msg);
      scheduleReset();
      return false;
    }
  }, [onCopy, onError, scheduleReset]);

  const read = useCallback(async (): Promise<string | null> => {
    try {
      if (!navigator.clipboard?.readText) {
        setError('Clipboard read not supported');
        return null;
      }
      return await navigator.clipboard.readText();
    } catch (err) {
      const msg = `Read failed: ${err}`;
      setError(msg);
      onError?.(msg);
      return null;
    }
  }, [onError]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    copy,
    read,
    status,
    error,
    hasCopied: status === 'copied',
    reset,
  };
}

export default useClipboard;
