import { useSyncExternalStore, useEffect } from 'react';
import { sentimentStore } from '../stores/waveStores';
import type { SymbolSentiment } from '../stores/waveStores';

function useSentiment() {
  return useSyncExternalStore(sentimentStore.subscribe, sentimentStore.getState);
}

function sentimentColor(s: string): string {
  switch (s) {
    case 'bullish': return '#22c55e';
    case 'bearish': return '#ef4444';
    case 'strongly_bullish': return '#16a34a';
    case 'strongly_bearish': return '#dc2626';
    default: return '#94a3b8';
  }
}

export function SentimentUI2() {
  const { sentiments, mood, loading, error } = useSentiment();

  useEffect(() => {
    sentimentStore.fetchAll();
  }, []);

  return (
    <div data-testid="sentiment-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Market Sentiment</h1>
        {mood && (
          <div data-testid="market-mood" style={{ background: '#1e293b', padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', color: sentimentColor(mood) }}>
            {mood.replace('_', ' ')}
          </div>
        )}
      </div>
      {loading && <p>Loading sentiment data...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {sentiments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {sentiments.map((s: SymbolSentiment) => (
            <div key={s.symbol} data-testid={`sentiment-${s.symbol}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{s.symbol}</span>
                <span style={{ color: sentimentColor(s.overall_sentiment), fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>{s.overall_sentiment?.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#22c55e' }}>{s.bullish_count} bull</span>
                <span style={{ color: '#ef4444' }}>{s.bearish_count} bear</span>
                <span style={{ color: '#94a3b8' }}>{s.neutral_count} neutral</span>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Score: {s.score?.toFixed(2)} | {s.article_count} articles</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{s.top_headline}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
