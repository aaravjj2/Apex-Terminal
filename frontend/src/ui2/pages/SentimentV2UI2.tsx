import { useSyncExternalStore, useEffect } from 'react';
import { sentimentV2Store } from '../stores/waves11_20Store';

function useSentimentV2() {
  return useSyncExternalStore(sentimentV2Store.subscribe, sentimentV2Store.getState);
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

export function SentimentV2UI2() {
  const { articles, dashboard, loading, error } = useSentimentV2();

  useEffect(() => {
    sentimentV2Store.fetchDashboard(DEFAULT_SYMBOLS);
    sentimentV2Store.fetchArticles();
  }, []);

  const sentimentColor = (label: string) => label === 'positive' ? '#22c55e' : label === 'negative' ? '#ef4444' : '#f59e0b';

  return (
    <div data-testid="sentiment-v2-ui2-page" style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Sentiment & FinBERT (v2)</h1>
      {loading && <p>Analyzing sentiment...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Dashboard */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Sentiment Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {dashboard.map((d, i) => (
          <div key={i} data-testid={`sent-${d.symbol}`} style={{ background: '#1e293b', padding: 16, borderRadius: 8, borderLeft: `4px solid ${sentimentColor(d.label)}` }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{d.symbol}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
              <div><span style={{ color: '#94a3b8' }}>Label: </span><span style={{ color: sentimentColor(d.label), fontWeight: 600 }}>{d.label}</span></div>
              <div><span style={{ color: '#94a3b8' }}>Score: </span>{d.weighted_composite.toFixed(3)}</div>
              <div><span style={{ color: '#94a3b8' }}>Articles: </span>{d.articles_count}</div>
              <div><span style={{ color: '#94a3b8' }}>Trend: </span><span style={{ color: d.trend === 'improving' ? '#22c55e' : d.trend === 'deteriorating' ? '#ef4444' : '#94a3b8' }}>{d.trend}</span></div>
            </div>
          </div>
        ))}
        {dashboard.length === 0 && <p style={{ color: '#94a3b8' }}>No sentiment data available</p>}
      </div>

      {/* Recent Articles */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Recent Articles ({articles.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {articles.slice(0, 20).map((a, i) => (
          <div key={i} data-testid={`article-${i}`} style={{ background: '#1e293b', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.headline}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{a.symbol} — {a.published_at}</div>
            </div>
          </div>
        ))}
        {articles.length === 0 && <p style={{ color: '#94a3b8' }}>No articles ingested</p>}
      </div>
    </div>
  );
}
