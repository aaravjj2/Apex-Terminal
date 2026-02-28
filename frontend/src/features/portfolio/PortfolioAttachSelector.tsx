import React from 'react';

// Bloomberg palette
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

const API_BASE = '/api/v1';

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  content_hash: string | null;
}

interface PortfolioAttachSelectorProps {
  onPortfolioChange: (portfolioId: string) => void;
  currentPortfolioId?: string;
}

export function PortfolioAttachSelector({
  onPortfolioChange,
  currentPortfolioId,
}: PortfolioAttachSelectorProps) {
  const [portfolios, setPortfolios] = React.useState<Portfolio[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => { loadPortfolios(); }, []);

  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolios?sort_by=portfolio_id`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: Portfolio[] = data.portfolios || [];
      setPortfolios(list);
      if (!currentPortfolioId && list.length > 0) {
        const def = list.find(p => p.portfolio_id === 'DEMO-PORT-001') || list[0];
        onPortfolioChange(def.portfolio_id);
      }
    } catch {
      const demo: Portfolio[] = [{ portfolio_id: 'DEMO-PORT-001', name: 'Demo Portfolio', currency: 'USD', cash_balance: '100000', content_hash: null }];
      setPortfolios(demo);
      if (!currentPortfolioId) onPortfolioChange('DEMO-PORT-001');
    } finally { setLoading(false); }
  };

  const currentPortfolio = portfolios.find(p => p.portfolio_id === currentPortfolioId);

  if (loading) return (
    <div data-testid="portfolio-attach-selector-loading" style={{ padding: 8, fontFamily: MONO }}>
      <div style={{ height: 36, background: '#181818', borderRadius: 4, width: 200, animation: 'pulse 1.5s infinite' }} />
    </div>
  );

  return (
    <div data-testid="portfolio-attach-selector" style={{ position: 'relative', fontFamily: MONO }}>
      {/* Trigger */}
      <button
        data-testid="portfolio-attach-current"
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
          background: isOpen ? '#1a1a1a' : '#141414', border: `1px solid ${isOpen ? AMBER + '66' : BORDER}`,
          borderRadius: 4, cursor: 'pointer', color: TEXT, fontSize: 11,
          fontFamily: MONO, minWidth: 200,
        }}
      >
        <span style={{ color: GREEN }}>â—«</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{currentPortfolio ? currentPortfolio.name : 'Select Portfolio'}</span>
        <span style={{ color: SUBTLE, fontSize: 9 }}>{isOpen ? 'â–²' : 'â–¼'}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 2,
          width: 300, background: PANEL, border: `1px solid ${BORDER}`,
          borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 50,
          maxHeight: 260, overflowY: 'auto',
        }}>
          {portfolios.map(portfolio => {
            const isActive = portfolio.portfolio_id === currentPortfolioId;
            const isHov = hovered === portfolio.portfolio_id;
            return (
              <button
                key={portfolio.portfolio_id}
                data-testid={`portfolio-attach-option-${portfolio.portfolio_id}`}
                onClick={() => { onPortfolioChange(portfolio.portfolio_id); setIsOpen(false); }}
                onMouseEnter={() => setHovered(portfolio.portfolio_id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: isActive ? '#1a1a1a' : isHov ? '#161616' : 'transparent',
                  border: 'none', borderBottom: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${isActive ? AMBER : 'transparent'}`,
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: isActive ? AMBER : TEXT, fontWeight: isActive ? 600 : 400 }}>{portfolio.name}</div>
                  <div style={{ fontSize: 9, color: SUBTLE, fontFamily: MONO }}>{portfolio.portfolio_id}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: GREEN }}>{portfolio.currency}</div>
                  <div style={{ fontSize: 9, color: SUBTLE }}>${parseFloat(portfolio.cash_balance).toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Attached summary */}
      {currentPortfolio && (
        <div data-testid="portfolio-attached-summary" style={{ marginTop: 6, fontSize: 9, color: SUBTLE, fontFamily: MONO }}>
          <span>Attached: </span>
          <span style={{ color: TEXT }}>{currentPortfolio.portfolio_id}</span>
          {currentPortfolio.content_hash && (
            <div data-testid="portfolio-attached-checksum" style={{ color: '#3a3a3a', marginTop: 2 }}>
              #{currentPortfolio.content_hash.substring(0, 16)}â€¦
            </div>
          )}
        </div>
      )}
    </div>
  );
}
