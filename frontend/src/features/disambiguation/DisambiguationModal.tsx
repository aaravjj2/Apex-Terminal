// Bloomberg Palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import React from 'react';

/**
 * Bloomberg-grade Finance Lexicon Disambiguation Modal
 * Shows when user enters an ambiguous token (e.g., A, I, ON, IT, ARE)
 * that could be either a ticker symbol or an English word.
 */

interface DisambiguationModalProps {
  token: string;
  ticker: string;
  company?: string | null;
  onChooseTicker: () => void;
  onChooseWord: () => void;
  onCancel: () => void;
}

export function DisambiguationModal({
  token,
  ticker,
  company,
  onChooseTicker,
  onChooseWord,
  onCancel,
}: DisambiguationModalProps) {
  return (
    <div
      data-testid="disambiguation-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, fontFamily: MONO }}
    >
      <div
        data-testid="disambiguation-dialog"
        onClick={e => e.stopPropagation()}
        style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '24px 28px', maxWidth: 480, width: '100%', margin: '0 16px', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: '0.1em' }}>DX</span>
            <span style={{ color: SUBTLE, fontSize: 10 }}>|</span>
            <h2
              data-testid="disambiguation-title"
              style={{ fontSize: 12, fontWeight: 700, color: TEXT, letterSpacing: '0.06em', margin: 0 }}
            >
              AMBIGUOUS INPUT: &quot;{token.toUpperCase()}&quot;
            </h2>
          </div>
          <button
            data-testid="disambiguation-close"
            onClick={onCancel}
            onMouseEnter={e => (e.currentTarget.style.color = RED)}
            onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)}
            style={{ background: 'none', border: 'none', color: SUBTLE, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
            aria-label="Close"
          >âœ•</button>
        </div>

        {/* Terminal separator */}
        <div style={{ height: 1, background: BORDER, margin: '12px 0 16px' }} />

        {/* Explanation */}
        <p
          data-testid="disambiguation-explanation"
          style={{ fontSize: 11, color: SUBTLE, marginBottom: 20, lineHeight: 1.6 }}
        >
          The token &quot;<span style={{ color: AMBER, fontWeight: 700 }}>{token}</span>&quot; matches both a stock ticker symbol and an English word.
          Select how you want to interpret this input:
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {/* Ticker Option */}
          <button
            data-testid="disambiguation-option-ticker"
            onClick={onChooseTicker}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = BLUE + '22'; (e.currentTarget as HTMLButtonElement).style.borderColor = BLUE; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = BG; (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}
            style={{ padding: '14px 16px', border: `1px solid ${BORDER}`, background: BG, borderRadius: 3, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: BLUE + '22', border: `1px solid ${BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, color: BLUE }}>â—ˆ</span>
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                TICKER SYMBOL: <span style={{ color: BLUE }}>{ticker}</span>
              </div>
              {company && (
                <div
                  data-testid="disambiguation-ticker-company"
                  style={{ fontFamily: MONO, fontSize: 10, color: SUBTLE, marginBottom: 3 }}
                >
                  {company}
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>
                Load market data, chart, and fundamentals for this symbol
              </div>
            </div>
            <div style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'center' }}>
              <span style={{ fontSize: 9, padding: '2px 8px', background: BLUE + '22', border: `1px solid ${BLUE}44`, color: BLUE, borderRadius: 2, fontFamily: MONO, fontWeight: 700 }}>MARKET</span>
            </div>
          </button>

          {/* Word Option */}
          <button
            data-testid="disambiguation-option-word"
            onClick={onChooseWord}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = AMBER + '22'; (e.currentTarget as HTMLButtonElement).style.borderColor = AMBER; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = BG; (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}
            style={{ padding: '14px 16px', border: `1px solid ${BORDER}`, background: BG, borderRadius: 3, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: AMBER + '22', border: `1px solid ${AMBER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, color: AMBER }}>âœ¦</span>
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                ENGLISH WORD: <span style={{ color: AMBER }}>&quot;{token}&quot;</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: SUBTLE }}>
                Treat as plain text, ignore as a ticker symbol
              </div>
            </div>
            <div style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'center' }}>
              <span style={{ fontSize: 9, padding: '2px 8px', background: AMBER + '22', border: `1px solid ${AMBER}44`, color: AMBER, borderRadius: 2, fontFamily: MONO, fontWeight: 700 }}>TEXT</span>
            </div>
          </button>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: BORDER, marginBottom: 16 }} />

        {/* Cancel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: SUBTLE }}>ESC to dismiss</span>
          <button
            data-testid="disambiguation-cancel"
            onClick={onCancel}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = RED; (e.currentTarget as HTMLButtonElement).style.color = RED; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = SUBTLE; }}
            style={{ padding: '6px 20px', border: `1px solid ${BORDER}`, background: 'transparent', color: SUBTLE, borderRadius: 3, cursor: 'pointer', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

