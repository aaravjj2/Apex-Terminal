import { useState, useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TrendingUp, Shield, FlaskConical, History, BarChart3 } from 'lucide-react';
import { OptionsChain } from '../../options/OptionsChain';
import { IVSkewChart } from '../../options/IVSkewChart';
import { IVTermStructure } from '../../options/IVTermStructure';
import { StrategyBuilder } from '../../options/StrategyBuilder';
import { FundamentalsPanel } from '../../fundamentals/FundamentalsPanel';
import { RiskDeskPanel } from '../../options/riskDesk';
import { StrategyLabPanel } from '../../options/strategyLab';
import { RunsPanel } from '../../options/runs';
import { QuickActions } from '../../options/QuickActions';
import { IndicatorManager } from '../../indicators/IndicatorManager';
import { useAppStore } from '../../../state/appStore';
import { useOptionsStore } from '../../options/store';
import { PageHeader } from '../../../ui/PageHeader';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { cn } from '../../../ui/utils';

type OptionsTab = 'chain' | 'iv-skew' | 'iv-term' | 'strategy' | 'fundamentals';
type MainTab = 'analytics' | 'risk-desk' | 'strategy-lab' | 'runs';

export function OptionsView() {
  const { symbol: appSymbol } = useAppStore();
  const {
    fetchAll,
    chain,
    selectedExpiration,
    setSelectedExpiration,
    chainLoading
  } = useOptionsStore();

  const [mainTab, setMainTab] = useState<MainTab>('analytics');
  const [activeTab, setActiveTab] = useState<OptionsTab>('chain');
  const [indicatorManagerOpen, setIndicatorManagerOpen] = useState(false);
  const [, setIndicators] = useState<unknown[]>([]);

  // Fetch all data when app-wide symbol changes
  useEffect(() => {
    if (appSymbol) {
      fetchAll(appSymbol);
    }
  }, [appSymbol, fetchAll]);

  const handleIndicatorUpdate = (newIndicators: any[]) => {
    setIndicators(newIndicators);
  };

  const handleStartDemo = () => {
    setMainTab('risk-desk');
    // Additional logic to trigger demo can be added here
  };

  const handleRunBacktest = () => {
    // Navigate to standalone Backtest view via custom event
    window.dispatchEvent(new CustomEvent('navigate-view', { detail: 'backtest' }));
  };

  const handleExportLastRun = async () => {
    // Logic to export last run bundle
    console.log('Export last run bundle');
  };

  const mainTabs = [
    { id: 'analytics' as const, label: 'Analytics' },
    { id: 'risk-desk' as const, label: 'Risk Desk' },
    { id: 'strategy-lab' as const, label: 'Strategy Lab' },
    { id: 'runs' as const, label: 'Runs' },
  ];

  const tabs = [
    { id: 'chain' as const, label: 'Options Chain' },
    { id: 'iv-skew' as const, label: 'IV Skew' },
    { id: 'iv-term' as const, label: 'IV Term Structure' },
    { id: 'strategy' as const, label: 'Strategy Builder' },
    { id: 'fundamentals' as const, label: 'Fundamentals' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header with main tabs */}
      <PageHeader
        title={`Options — ${appSymbol}`}
        icon={<TrendingUp size={20} />}
        badge={chainLoading ? <Badge variant="info" dot size="sm">Loading</Badge> : undefined}
        actions={
          <div className="flex items-center gap-2">
            <QuickActions
              onStartDemo={handleStartDemo}
              onRunBacktest={handleRunBacktest}
              onExportLastRun={handleExportLastRun}
            />
            {mainTab === 'analytics' && (
              <Button
                variant={indicatorManagerOpen ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setIndicatorManagerOpen(!indicatorManagerOpen)}
              >
                <BarChart3 size={14} />
                Indicators
              </Button>
            )}
          </div>
        }
        data-testid="options-header"
      />

      {/* Main tab switcher */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-panel-bg shrink-0" role="tablist" aria-label="Options main tabs">
        {mainTabs.map(tab => {
          const icons: Record<string, React.ReactNode> = {
            'analytics': <BarChart3 size={13} />,
            'risk-desk': <Shield size={13} />,
            'strategy-lab': <FlaskConical size={13} />,
            'runs': <History size={13} />,
          };
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              data-testid={`options-main-tab-${tab.id}`}
              role="tab"
              aria-selected={mainTab === tab.id}
              tabIndex={mainTab === tab.id ? 0 : -1}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                mainTab === tab.id
                  ? 'bg-brand/10 text-brand border border-brand/20 shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-element-bg'
              )}
            >
              {icons[tab.id]}
              {tab.label}
            </button>
          );
        })}

        {/* Expiration selector (only in Analytics mode) */}
        {mainTab === 'analytics' && chain && chain.expirations.length > 0 && (activeTab === 'chain' || activeTab === 'iv-skew' || activeTab === 'iv-term') && (
          <select
            value={selectedExpiration || ''}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            className="ml-3 px-3 py-1.5 bg-element-bg border border-border rounded-md text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {chain.expirations.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        )}
      </div>

      {/* Secondary tabs (only show in Analytics mode) */}
      {mainTab === 'analytics' && (
        <div className="flex items-center gap-0 border-b border-border px-4 bg-panel-bg/80 shrink-0" role="tablist" aria-label="Analytics tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`options-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 transition-all',
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-text-secondary hover:text-text hover:border-border-active'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {mainTab === 'analytics' ? (
          <PanelGroup orientation="horizontal">
            <Panel defaultSize={indicatorManagerOpen ? 75 : 100} minSize={50}>
              <div className="h-full overflow-auto" data-testid="analytics-panel">
                {activeTab === 'chain' && (
                  <OptionsChain
                    symbol={appSymbol}
                    expiration={selectedExpiration || ''}
                    underlyingPrice={chain?.underlyingPrice}
                  />
                )}

                {activeTab === 'iv-skew' && (
                  <IVSkewChart
                    symbol={appSymbol}
                    expiration={selectedExpiration || ''}
                    underlyingPrice={chain?.underlyingPrice}
                  />
                )}

                {activeTab === 'iv-term' && (
                  <IVTermStructure symbol={appSymbol} />
                )}

                {activeTab === 'strategy' && (
                  <StrategyBuilder
                    symbol={appSymbol}
                    underlyingPrice={chain?.underlyingPrice || 0}
                  />
                )}

                {activeTab === 'fundamentals' && (
                  <FundamentalsPanel symbol={appSymbol} />
                )}
              </div>
            </Panel>

            {indicatorManagerOpen && (
              <>
                <PanelResizeHandle className="w-1 bg-border hover:bg-brand transition-colors cursor-col-resize" />
                <Panel defaultSize={25} minSize={15} maxSize={40}>
                  <IndicatorManager
                    symbol={appSymbol}
                    onIndicatorUpdate={handleIndicatorUpdate}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : mainTab === 'risk-desk' ? (
          /* Risk Desk main tab */
          <RiskDeskPanel />
        ) : mainTab === 'strategy-lab' ? (
          /* Strategy Lab main tab */
          <StrategyLabPanel />
        ) : mainTab === 'runs' ? (
          /* Unified Run Ledger */
          <RunsPanel />
        ) : null}
      </div>
    </div>
  );
}
