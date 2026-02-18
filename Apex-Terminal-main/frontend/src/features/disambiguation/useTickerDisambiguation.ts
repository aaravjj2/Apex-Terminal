/**
 * useTickerDisambiguation Hook (Objective H, v1.12)
 * 
 * Manages ticker/word disambiguation using session storage for ephemeral choices.
 */

import { useState, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const SESSION_KEY_PREFIX = 'disambiguation_';

export interface TokenClassification {
  classification: 'TICKER' | 'WORD' | 'AMBIGUOUS' | 'INVALID';
  ticker: string | null;
  confidence: string;
  reason: string;
  company: string | null;
  disambiguation_needed: boolean;
}

interface DisambiguationState {
  isModalOpen: boolean;
  token: string;
  ticker: string;
  company: string | null;
}

export function useTickerDisambiguation() {
  const [state, setState] = useState<DisambiguationState>({
    isModalOpen: false,
    token: '',
    ticker: '',
    company: null,
  });

  const [pendingResolve, setPendingResolve] = useState<((result: TokenClassification | null) => void) | null>(null);

  /**
   * Get session storage key for a token
   */
  const getSessionKey = (token: string): string => {
    return SESSION_KEY_PREFIX + token.toUpperCase();
  };

  /**
   * Check if disambiguation choice exists in session storage
   */
  const getSessionChoice = (token: string): 'ticker' | 'word' | null => {
    try {
      const key = getSessionKey(token);
      const choice = sessionStorage.getItem(key);
      if (choice === 'ticker' || choice === 'word') {
        return choice;
      }
    } catch (err) {
      console.error('Failed to read session storage:', err);
    }
    return null;
  };

  /**
   * Store disambiguation choice in session storage
   */
  const setSessionChoice = (token: string, choice: 'ticker' | 'word') => {
    try {
      const key = getSessionKey(token);
      sessionStorage.setItem(key, choice);
    } catch (err) {
      console.error('Failed to write session storage:', err);
    }
  };

  /**
   * Classify a token and handle disambiguation if needed
   */
  const classifyToken = useCallback(async (token: string): Promise<TokenClassification | null> => {
    if (!token.trim()) {
      return {
        classification: 'INVALID',
        ticker: null,
        confidence: 'none',
        reason: 'Empty input',
        company: null,
        disambiguation_needed: false,
      };
    }

    // Check session storage first
    const sessionChoice = getSessionChoice(token);
    if (sessionChoice) {
      // User already chose for this token in this session
      if (sessionChoice === 'ticker') {
        // Return as unambiguous ticker
        // Call API to get full ticker info
        try {
          const response = await fetch(`${BACKEND_URL}/api/v1/ticker/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: token }),
          });
          
          if (response.ok) {
            const data = await response.json();
            return {
              classification: 'TICKER',
              ticker: data.ticker,
              confidence: 'high',
              reason: `User previously chose ticker interpretation for "${token}"`,
              company: data.company,
              disambiguation_needed: false,
            };
          }
        } catch (err) {
          console.error('Failed to resolve ticker:', err);
        }
      } else {
        // User chose word
        return {
          classification: 'WORD',
          ticker: null,
          confidence: 'none',
          reason: `User previously chose word interpretation for "${token}"`,
          company: null,
          disambiguation_needed: false,
        };
      }
    }

    // Call classification endpoint
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/ticker/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.status}`);
      }

      const classification: TokenClassification = await response.json();

      // If ambiguous, show modal and wait for user choice
      if (classification.disambiguation_needed && classification.ticker) {
        return new Promise((resolve) => {
          setState({
            isModalOpen: true,
            token,
            ticker: classification.ticker!,
            company: classification.company,
          });
          setPendingResolve(() => resolve);
        });
      }

      return classification;
    } catch (err) {
      console.error('Token classification failed:', err);
      // Fallback: treat as word
      return {
        classification: 'WORD',
        ticker: null,
        confidence: 'none',
        reason: 'Classification failed, treating as word',
        company: null,
        disambiguation_needed: false,
      };
    }
  }, []);

  /**
   * User chose ticker interpretation
   */
  const handleChooseTicker = useCallback(() => {
    setSessionChoice(state.token, 'ticker');
    
    const result: TokenClassification = {
      classification: 'TICKER',
      ticker: state.ticker,
      confidence: 'high',
      reason: `User chose ticker interpretation`,
      company: state.company,
      disambiguation_needed: false,
    };

    if (pendingResolve) {
      pendingResolve(result);
      setPendingResolve(null);
    }

    setState({ isModalOpen: false, token: '', ticker: '', company: null });
  }, [state, pendingResolve]);

  /**
   * User chose word interpretation
   */
  const handleChooseWord = useCallback(() => {
    setSessionChoice(state.token, 'word');
    
    const result: TokenClassification = {
      classification: 'WORD',
      ticker: null,
      confidence: 'none',
      reason: `User chose word interpretation`,
      company: null,
      disambiguation_needed: false,
    };

    if (pendingResolve) {
      pendingResolve(result);
      setPendingResolve(null);
    }

    setState({ isModalOpen: false, token: '', ticker: '', company: null });
  }, [state, pendingResolve]);

  /**
   * User cancelled
   */
  const handleCancel = useCallback(() => {
    if (pendingResolve) {
      pendingResolve(null);
      setPendingResolve(null);
    }

    setState({ isModalOpen: false, token: '', ticker: '', company: null });
  }, [pendingResolve]);

  return {
    classifyToken,
    disambiguationState: state,
    handleChooseTicker,
    handleChooseWord,
    handleCancel,
  };
}
