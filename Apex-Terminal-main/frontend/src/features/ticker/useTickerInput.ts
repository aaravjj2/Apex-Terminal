/**
 * useTickerInput Hook
 * ====================
 * Provides a controlled ticker input with built-in disambiguation.
 * Use this hook anywhere a user can type a ticker symbol.
 *
 * Usage:
 *   const { value, onChange, dialogProps, resolve } = useTickerInput({
 *     onResolved: (symbol) => setSymbol(symbol),
 *     watchlist: ['AAPL', 'SPY'],
 *   });
 */

import { useState, useCallback } from 'react';
import { disambiguate, type AmbiguousEntry, type DisambiguationResult } from './disambiguator';

export interface UseTickerInputOptions {
  /** Called when the symbol is confirmed (either directly or after disambiguation) */
  onResolved: (symbol: string) => void;
  /** Current watchlist for context-aware disambiguation */
  watchlist?: string[];
  /** Initial value */
  initialValue?: string;
}

export interface TickerDialogState {
  open: boolean;
  symbol: string;
  entry: AmbiguousEntry;
}

export interface UseTickerInputReturn {
  /** Current input value */
  value: string;
  /** onChange handler for the input */
  onChange: (val: string) => void;
  /** Submit the current value through disambiguation */
  submit: (val?: string) => void;
  /** Props to spread on TickerDisambiguationDialog */
  dialogProps: {
    open: boolean;
    symbol: string;
    entry: AmbiguousEntry;
    onConfirm: (symbol: string) => void;
    onCancel: () => void;
  };
  /** Last disambiguation result (for testing / UI feedback) */
  lastResult: DisambiguationResult | null;
}

const EMPTY_ENTRY: AmbiguousEntry = { company: '', confusion: '' };

export function useTickerInput(opts: UseTickerInputOptions): UseTickerInputReturn {
  const { onResolved, watchlist = [], initialValue = '' } = opts;

  const [value, setValue] = useState(initialValue);
  const [lastResult, setLastResult] = useState<DisambiguationResult | null>(null);
  const [dialog, setDialog] = useState<TickerDialogState>({
    open: false,
    symbol: '',
    entry: EMPTY_ENTRY,
  });

  const onChange = useCallback((val: string) => {
    setValue(val.toUpperCase());
  }, []);

  const submit = useCallback(
    (overrideVal?: string) => {
      const raw = overrideVal ?? value;
      const result = disambiguate(raw, watchlist);
      setLastResult(result);

      if (!result.symbol) return;

      if (result.isAmbiguous && result.entry) {
        // Show disambiguation dialog
        setDialog({
          open: true,
          symbol: result.symbol,
          entry: result.entry,
        });
      } else {
        // Resolved directly
        onResolved(result.symbol);
      }
    },
    [value, watchlist, onResolved],
  );

  const handleConfirm = useCallback(
    (symbol: string) => {
      setDialog((d) => ({ ...d, open: false }));
      onResolved(symbol);
    },
    [onResolved],
  );

  const handleCancel = useCallback(() => {
    setDialog((d) => ({ ...d, open: false }));
  }, []);

  return {
    value,
    onChange,
    submit,
    dialogProps: {
      open: dialog.open,
      symbol: dialog.symbol,
      entry: dialog.entry,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    lastResult,
  };
}
