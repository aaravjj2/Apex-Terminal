/**
 * Portfolio CRUD Panel (v1.19 + v1.20)
 * Portfolio management UI with create, read, update, delete operations
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, FlaskConical, Upload } from 'lucide-react';
import { API_BASE } from '../../config/api';
import { EmptyState } from '../../components/shared/EmptyState';
import { SkeletonTable } from '../../components/shared/Skeleton';
import { SeverityBanner } from '../../components/shared/SeverityBanner';
import { PortfolioModal } from './PortfolioModal';
import { PositionModal } from './PositionModal';

interface Position {
  symbol: string;
  quantity: string;
  average_cost_basis: string;
  current_price: string | null;
  lots: any[];
}

interface Portfolio {
  portfolio_id: string;
  name: string;
  currency: string;
  cash_balance: string;
  positions: Position[];
  created_at: string;
  updated_at: string;
  schema_version: string;
  content_hash: string | null;
}

export function PortfolioCrudPanel() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios?sort_by=portfolio_id`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPortfolios(data.portfolios || []);
    } catch (e) {
      console.warn('Failed to load portfolios:', e);
      // Demo fallback portfolios when API unavailable
      setPortfolios([
        { portfolio_id: 'DEMO-001', name: 'Demo Growth Portfolio', currency: 'USD', cash_balance: '100000.00', content_hash: 'demo', positions: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), schema_version: '1.0' },
        { portfolio_id: 'DEMO-002', name: 'Demo Income Portfolio', currency: 'USD', cash_balance: '50000.00', content_hash: 'demo', positions: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), schema_version: '1.0' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/reset`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadPortfolios();
      setSuccess('Demo portfolios loaded successfully');
    } catch (e) {
      console.warn('Failed to load demo:', e);
      setError('Failed to load demo portfolios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = () => {
    setEditingPortfolio(null);
    setPortfolioModalOpen(true);
  };

  const handleEditPortfolio = (portfolio: Portfolio) => {
    setEditingPortfolio(portfolio);
    setPortfolioModalOpen(true);
  };

  const handlePortfolioSaved = () => {
    setPortfolioModalOpen(false);
    setEditingPortfolio(null);
    loadPortfolios();
    setSuccess('Portfolio saved successfully');
  };

  const handleAddPosition = (portfolio: Portfolio) => {
    setSelectedPortfolio(portfolio);
    setPositionModalOpen(true);
  };

  const handlePositionSaved = () => {
    setPositionModalOpen(false);
    setSelectedPortfolio(null);
    loadPortfolios();
    setSuccess('Position saved successfully');
  };

  /** v1.23: Export portfolio as canonical JSON */
  const handleExportPortfolio = async (portfolioId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolios/${portfolioId}/export`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-${portfolioId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(`Portfolio ${portfolioId} exported`);
    } catch (e) {
      console.error('Export failed:', e);
      setError('Failed to export portfolio');
    }
  };

  /** v1.23: Import portfolio from canonical JSON file */
  const handleImportPortfolio = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API_BASE}/api/v1/portfolios/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      await loadPortfolios();
      setSuccess('Portfolio imported successfully');
    } catch (e) {
      console.error('Import failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to import portfolio');
    }
    // Reset file input
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const computeMarketValue = (portfolio: Portfolio): string => {
    const positionsValue = portfolio.positions.reduce((sum, pos) => {
      if (pos.current_price) {
        return sum + parseFloat(pos.quantity) * parseFloat(pos.current_price);
      }
      return sum;
    }, 0);
    const totalValue = positionsValue + parseFloat(portfolio.cash_balance);
    return totalValue.toFixed(2);
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid="portfolio-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel-bg">
        <h2 className="text-lg font-semibold text-text">Portfolios</h2>
        <div className="flex gap-2">
          <button
            onClick={handleLoadDemo}
            disabled={loading}
            data-testid="portfolio-load-demo-btn"
            className="px-3 py-1.5 text-sm bg-element-bg hover:bg-element-bg/80 disabled:opacity-50 text-text rounded border border-border"
          >
            Load Demo
          </button>
          {/* v1.23: Import portfolio */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            className="hidden"
            data-testid="portfolio-import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportPortfolio(file);
            }}
          />
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={loading}
            data-testid="portfolio-import-btn"
            className="px-3 py-1.5 text-sm bg-element-bg hover:bg-element-bg/80 disabled:opacity-50 text-text rounded border border-border flex items-center gap-1"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleCreatePortfolio}
            disabled={loading}
            data-testid="portfolio-create-btn"
            className="px-3 py-1.5 text-sm bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Create Portfolio
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Error Banner */}
        {error && (
          <SeverityBanner
            severity="error"
            message={error}
            onDismiss={() => setError(null)}
            className="mb-4"
            testId="portfolio-error-banner"
          />
        )}

        {/* Success Banner */}
        {success && (
          <SeverityBanner
            severity="success"
            message={success}
            onDismiss={() => setSuccess(null)}
            className="mb-4"
            testId="portfolio-success-banner"
          />
        )}

        {loading ? (
          <SkeletonTable rows={3} cols={5} />
        ) : portfolios.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No portfolios yet"
            description="Create a new portfolio or load demo portfolios to get started."
            action={{
              label: 'Create Portfolio',
              onClick: handleCreatePortfolio,
              testId: 'portfolio-empty-action'
            }}
            testId="portfolio-empty"
          />
        ) : (
          <div className="bg-panel-bg border border-border

 rounded overflow-hidden" data-testid="portfolio-ready">
            <table className="w-full" data-testid="portfolio-table">
              <thead className="bg-element-bg border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Currency</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Cash Balance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Positions</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Market Value</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map((portfolio) => (
                  <tr
                    key={portfolio.portfolio_id}
                    className="border-b border-border hover:bg-element-bg/50"
                    data-testid={`portfolio-row-${portfolio.portfolio_id}`}
                  >
                    <td
                      className="px-4 py-3 text-sm text-text"
                      data-testid={`portfolio-name-cell-${portfolio.portfolio_id}`}
                    >
                      {portfolio.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">{portfolio.currency}</td>
                    <td className="px-4 py-3 text-sm text-text font-mono">
                      ${parseFloat(portfolio.cash_balance).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {portfolio.positions.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-text font-mono">
                      ${computeMarketValue(portfolio)}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button
                        onClick={() => handleEditPortfolio(portfolio)}
                        className="text-brand hover:underline"
                        data-testid={`portfolio-edit-btn-${portfolio.portfolio_id}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleAddPosition(portfolio)}
                        className="text-brand hover:underline"
                        data-testid={`portfolio-add-position-btn-${portfolio.portfolio_id}`}
                      >
                        Add Position
                      </button>
                      <button
                        onClick={() => handleExportPortfolio(portfolio.portfolio_id)}
                        className="text-brand hover:underline"
                        data-testid={`portfolio-export-btn-${portfolio.portfolio_id}`}
                      >
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {portfolioModalOpen && (
        <PortfolioModal
          portfolio={editingPortfolio}
          onClose={() => setPortfolioModalOpen(false)}
          onSaved={handlePortfolioSaved}
        />
      )}

      {positionModalOpen && selectedPortfolio && (
        <PositionModal
          portfolio={selectedPortfolio}
          onClose={() => setPositionModalOpen(false)}
          onSaved={handlePositionSaved}
        />
      )}
    </div>
  );
}
