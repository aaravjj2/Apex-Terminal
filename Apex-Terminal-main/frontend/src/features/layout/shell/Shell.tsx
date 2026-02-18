import { useState, useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TopAppBarEnhanced } from './TopAppBarEnhanced';
import { LeftNavEnhanced, type ViewId } from './LeftNavEnhanced';
import { CommandPalette } from './CommandPalette';
import { ChartCanvas } from '../../chart/ChartCanvas';
import { ChartHeaderStrip } from '../../chart/ChartHeaderStrip';
import { BottomPanel } from '../BottomPanel';
import { RightPanel } from '../RightPanel';
import { ReplayView } from '../views/ReplayView';
import { StrategiesView } from '../views/StrategiesView';
import { AlertsView } from '../views/AlertsView';
import { EnhancedPortfolioView } from '../../portfolio/EnhancedPortfolioView';
import { ReportsView } from '../views/ReportsView';
import { SettingsView } from '../views/SettingsView';
import { EnhancedCommandCenterView } from '../views/EnhancedCommandCenterView';
import { AutomationView } from '../views/AutomationView';
import { IncidentsView } from '../views/IncidentsView';
import { OptionsView } from '../views/OptionsView';
import { AutopilotView } from '../views/AutopilotView';
import { BacktestPanel } from '../../backtest';
import { OrdersView } from '../views/OrdersView';
import { RunsAuditView } from '../views/RunsAuditView';
import { CacheViewerPanel } from '../../cache/CacheViewerPanel';
import { WatchlistPanel } from '../../watchlist/WatchlistPanel';
import { CorrelationPanel } from '../../correlation/CorrelationPanel';
import { JournalPanel } from '../../journal/JournalPanel';
import { NotificationsPanel } from '../../notifications/NotificationsPanel';
import { AuditLogPanel } from '../../audit/AuditLogPanel';
import { AttributionPanel } from '../../attribution/AttributionPanel';
import { RiskScenariosPanel } from '../../risk-scenarios/RiskScenariosPanel';
import { DataQualityPanel } from '../../data-quality/DataQualityPanel';
import { StrategyComparePanel } from '../../strategy-compare/StrategyComparePanel';
import { PlatformHealthPanel } from '../../platform-health/PlatformHealthPanel';
import { SearchPanel } from '../../search/SearchPanel';
import { AgentsPanel } from '../../agents/AgentsPanel';
import { ToastProvider } from '../../../ui/Toast';
import { useAppStore } from '../../../state/appStore';
import { useStore } from '../../../state/store';
import { useWorkspaceStore } from '../../../state/workspaceStore';
import { TrustUX } from './TrustUX';
import { ModeBanner } from '../../shared/ProviderPill';

export function Shell() {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [activeView, setActiveView] = useState<ViewId>('dashboard');
    const { rightDockOpen, bottomDockOpen, setMode } = useAppStore();
    const { setActiveWorkspace } = useWorkspaceStore();

    // Provider/mode info state
    const [modeInfo, setModeInfo] = useState({ 
        mode: 'DEMO' as const, 
        replayAvailable: false, 
        replayEnabled: false 
    });

    // Keyboard shortcuts
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Command palette
            if ((e.key === 'k' || e.key === '/') && (e.metaKey || e.ctrlKey || e.key === '/')) {
                e.preventDefault();
                setCommandPaletteOpen(open => !open);
            }

            // View shortcuts (Ctrl/Cmd + number)
            if (e.metaKey || e.ctrlKey) {
                if (e.key === '1') { e.preventDefault(); setActiveView('monitor'); setActiveWorkspace('chart'); }
                if (e.key === '2') { e.preventDefault(); setActiveView('dashboard'); setActiveWorkspace('dashboard'); }
                if (e.key === '3') { e.preventDefault(); setActiveView('options'); }
                if (e.key === '4') { e.preventDefault(); setActiveView('replay'); setMode('REPLAY'); }
                if (e.key === '5') { e.preventDefault(); setActiveView('strategies'); }
                if (e.key === '6') { e.preventDefault(); setActiveView('alerts'); }
                if (e.key === '7') { e.preventDefault(); setActiveView('portfolio'); }
                // Undo/Redo (placeholder - would connect to drawing store)
                if (e.key === 'z') {
                    e.preventDefault();
                    console.log('Undo triggered');
                }
                if (e.key === 'y' || (e.shiftKey && e.key === 'z')) {
                    e.preventDefault();
                    console.log('Redo triggered');
                }
            }

            // Timeframe quick switch (1/2/3 without modifier, only when not in input)
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.key === '1') { useAppStore.getState().setTimeframe('1m'); }
                if (e.key === '2') { useAppStore.getState().setTimeframe('5m'); }
                if (e.key === '3') { useAppStore.getState().setTimeframe('15m'); }
                if (e.key === '4') { useAppStore.getState().setTimeframe('1H'); }
                if (e.key === '5') { useAppStore.getState().setTimeframe('1D'); }

                // Replay controls when in replay mode
                if (activeView === 'replay') {
                    const appStore = useAppStore.getState();
                    if (e.key === ' ') {
                        e.preventDefault();
                        appStore.setReplayPlaying(!appStore.isReplayPlaying);
                    }
                    if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        // Step forward
                        appStore.setReplayProgress(appStore.replayBarIndex + (e.shiftKey ? 10 : 1), appStore.replayTotalBars);
                    }
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        // Step backward
                        appStore.setReplayProgress(Math.max(0, appStore.replayBarIndex - (e.shiftKey ? 10 : 1)), appStore.replayTotalBars);
                    }
                }
            }

            // Escape to close overlays
            if (e.key === 'Escape') {
                setCommandPaletteOpen(false);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [setMode, setActiveWorkspace, activeView]);

    // Listen for Risk Desk navigation event from Dashboard quick action
    useEffect(() => {
        const handleNavigateRiskDesk = () => {
            // Set a flag that OptionsView reads on mount to know it should show risk-desk tab
            (window as any).__navigateToRiskDesk = true;
            setActiveView('options');
        };

        const handleNavigateView = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && typeof detail === 'string') {
                setActiveView(detail as ViewId);
            }
        };

        // v1.31: Navigate to backtest with strategy artifact preselected
        const handleNavigateToBacktest = () => {
            setActiveView('backtest');
        };

        window.addEventListener('navigate-risk-desk', handleNavigateRiskDesk as EventListener);
        window.addEventListener('navigate-view', handleNavigateView as EventListener);
        window.addEventListener('navigate-to-backtest', handleNavigateToBacktest as EventListener);
        return () => {
            window.removeEventListener('navigate-risk-desk', handleNavigateRiskDesk as EventListener);
            window.removeEventListener('navigate-view', handleNavigateView as EventListener);
            window.removeEventListener('navigate-to-backtest', handleNavigateToBacktest as EventListener);
        };
    }, []);

    // Sync mode with view
    useEffect(() => {
        if (activeView === 'replay') {
            setMode('REPLAY');
        } else if (activeView === 'monitor') {
            setMode('PAPER'); // Default to PAPER for monitor
        }
    }, [activeView, setMode]);

    // On mount, sync backend health and provider status
    useEffect(() => {
        useAppStore.getState().syncBackendHealth();
        // Initialize WebSocket connection for market data
        useStore.getState().connect();
        
        // Fetch provider info
        fetch('/api/v1/market_data/providers')
            .then(r => r.json())
            .then(data => {
                const demo = data.find((p: any) => p.name === 'demo');
                if (demo) {
                    setModeInfo({
                        mode: demo.mode,
                        replayAvailable: demo.replay_available,
                        replayEnabled: demo.replay_enabled
                    });
                }
            })
            .catch(err => console.error('Failed to fetch provider info:', err));
    }, []);

    const renderMainView = () => {
        switch (activeView) {
            case 'monitor':
                return (
                    <PanelGroup orientation="horizontal" className="flex-1">
                        <Panel defaultSize={rightDockOpen ? 75 : 100} minSize={40}>
                            <PanelGroup orientation="vertical">
                                <Panel defaultSize={bottomDockOpen ? 70 : 100} minSize={30}>
                                    <div className="h-full w-full flex flex-col bg-background">
                                        <ChartHeaderStrip />
                                        <div className="flex-1 relative">
                                            <ChartCanvas className="absolute inset-0" />
                                        </div>
                                    </div>
                                </Panel>
                                {bottomDockOpen && (
                                    <>
                                        <PanelResizeHandle className="h-1 bg-border hover:bg-brand transition-colors cursor-row-resize" />
                                        <Panel defaultSize={30} minSize={10} maxSize={50}>
                                            <BottomPanel />
                                        </Panel>
                                    </>
                                )}
                            </PanelGroup>
                        </Panel>
                        {rightDockOpen && (
                            <>
                                <PanelResizeHandle className="w-1 bg-border hover:bg-brand transition-colors cursor-col-resize" />
                                <Panel defaultSize={25} minSize={15} maxSize={40}>
                                    <RightPanel />
                                </Panel>
                            </>
                        )}
                    </PanelGroup>
                );
            case 'dashboard':
                return <EnhancedCommandCenterView />;
            case 'options':
                return <OptionsView />;
            case 'backtest':
                return <BacktestPanel />;
            case 'autopilot':
                return <AutopilotView />;
            case 'replay':
                return <ReplayView />;
            case 'strategies':
                return <StrategiesView />;
            case 'alerts':
                return <AlertsView />;
            case 'portfolio':
                return <EnhancedPortfolioView />;
            case 'orders':
                return <OrdersView />;
            case 'runs':
                return <RunsAuditView />;
            case 'reports':
                return <ReportsView />;
            case 'automation':
                return <AutomationView />;
            case 'incidents':
                return <IncidentsView />;
            case 'cache':
                return <CacheViewerPanel />;
            case 'search':
                return <SearchPanel />;
            case 'agents':
                return <AgentsPanel />;
            case 'watchlist':
                return <WatchlistPanel />;
            case 'correlation':
                return <CorrelationPanel />;
            case 'journal':
                return <JournalPanel />;
            case 'notifications':
                return <NotificationsPanel />;
            case 'audit':
                return <AuditLogPanel />;
            case 'attribution':
                return <AttributionPanel />;
            case 'risk-scenarios':
                return <RiskScenariosPanel />;
            case 'data-quality':
                return <DataQualityPanel />;
            case 'strategy-compare':
                return <StrategyComparePanel />;
            case 'platform-health':
                return <PlatformHealthPanel />;
            case 'settings':
                return <SettingsView />;
            default:
                return null;
        }
    };

    const isE2E = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === '1';

    return (
        <ToastProvider>
            <div className={`h-screen w-screen flex flex-col bg-background text-text overflow-hidden font-sans selection:bg-brand/30${isE2E ? ' e2e-mode' : ''}`} data-testid="app-shell">
                <TopAppBarEnhanced />
                <ModeBanner {...modeInfo} />

                <div className="flex-1 flex overflow-hidden">
                    <LeftNavEnhanced activeView={activeView} onViewChange={setActiveView} />

                    <main className="flex-1 overflow-hidden" data-testid="main-content">
                        {renderMainView()}
                    </main>
                </div>

                <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

                {/* Trust UX - Always visible floating badge */}
                <TrustUX />
            </div>
        </ToastProvider>
    );
}
