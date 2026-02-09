import { create } from 'zustand';

// App Mode Types
export type AppMode = 'LIVE' | 'REPLAY' | 'BACKTEST' | 'PAPER';

// Provider Types
export type ProviderName = 'finnhub' | 'alpaca' | 'yahoo';
export type ProviderStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'rate_limited';

interface ProviderState {
    status: ProviderStatus;
    lastUpdate?: number;
    error?: string;
    rateLimit?: {
        remaining: number;
        reset: number;
    };
}

// App State
interface AppState {
    // Mode
    mode: AppMode;
    setMode: (mode: AppMode) => void;

    // Symbol & Timeframe
    symbol: string;
    timeframe: string;
    setSymbol: (symbol: string) => void;
    setTimeframe: (timeframe: string) => void;

    // Providers
    providers: Record<ProviderName, ProviderState>;
    setProviderStatus: (name: ProviderName, state: Partial<ProviderState>) => void;

    // Clock
    marketTime: number;
    replayTime: number | null;
    setMarketTime: (time: number) => void;
    setReplayTime: (time: number | null) => void;

    // Replay state
    isReplayPlaying: boolean;
    replaySpeed: number;
    replayBarIndex: number;
    replayTotalBars: number;
    parityMismatch: boolean;
    setReplayPlaying: (playing: boolean) => void;
    setReplaySpeed: (speed: number) => void;
    setReplayProgress: (current: number, total: number) => void;
    setParityMismatch: (mismatch: boolean) => void;

    // Backend sync
    syncBackendHealth: () => Promise<void>;
    syncParityStatus: () => Promise<void>;

    // UI State
    leftNavExpanded: boolean;
    rightDockOpen: boolean;
    bottomDockOpen: boolean;
    toggleLeftNav: () => void;
    toggleRightDock: () => void;
    toggleBottomDock: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    // Mode
    mode: 'PAPER',
    setMode: (mode) => set({ mode }),

    // Symbol & Timeframe
    symbol: 'AAPL',
    timeframe: '1D',
    setSymbol: (symbol) => set({ symbol }),
    setTimeframe: (timeframe) => set({ timeframe }),

    // Providers
    providers: {
        finnhub: { status: 'connected' },
        alpaca: { status: 'disconnected' },
        yahoo: { status: 'disconnected' },
    },
    setProviderStatus: (name, state) => set((s) => ({
        providers: {
            ...s.providers,
            [name]: { ...s.providers[name], ...state },
        },
    })),

    // Clock
    marketTime: Date.now(),
    replayTime: null,
    setMarketTime: (time) => set({ marketTime: time }),
    setReplayTime: (time) => set({ replayTime: time }),

    // Replay
    isReplayPlaying: false,
    replaySpeed: 1,
    replayBarIndex: 0,
    replayTotalBars: 0,
    parityMismatch: false,
    setReplayPlaying: (playing) => set({ isReplayPlaying: playing }),
    setReplaySpeed: (speed) => set({ replaySpeed: speed }),
    setReplayProgress: (current, total) => set({ replayBarIndex: current, replayTotalBars: total }),
    setParityMismatch: (mismatch) => set({ parityMismatch: mismatch }),

    // Backend sync
    syncBackendHealth: async () => {
        try {
            const res = await fetch('http://127.0.0.1:8000/health');
            if (res.ok) {
                set((s) => ({
                    providers: {
                        ...s.providers,
                        finnhub: { ...s.providers.finnhub, status: 'connected' },
                    },
                }));
            } else {
                set((s) => ({
                    providers: {
                        ...s.providers,
                        finnhub: { ...s.providers.finnhub, status: 'error' },
                    },
                }));
            }
        } catch {
            set((s) => ({
                providers: {
                    ...s.providers,
                    finnhub: { ...s.providers.finnhub, status: 'disconnected' },
                },
            }));
        }

        // Also fetch ingestion provider status (Alpaca/Finnhub)
        try {
            const status = await (await import('../data/ApiClient')).ApiClient.getProviderStatus();
            if (status.provider === 'alpaca' || status.provider === 'alpaca-ws') {
                set((s) => ({ providers: { ...s.providers, alpaca: { ...s.providers.alpaca, status: status.running ? 'connected' : 'disconnected' } } }));
            } else if (status.provider === 'finnhub') {
                set((s) => ({ providers: { ...s.providers, finnhub: { ...s.providers.finnhub, status: status.running ? 'connected' : 'disconnected' } } }));
            }
        } catch (e) {
            // Ignore provider status errors
        }
    },

    syncParityStatus: async () => {
        const { symbol, timeframe } = get();
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/v1/parity/hash/${symbol}/${timeframe}`);
            if (!res.ok) {
                set({ parityMismatch: true });
                return;
            }
            // Parity check succeeded, no mismatch
            set({ parityMismatch: false });
        } catch {
            // Unable to verify parity
            set({ parityMismatch: true });
        }
    },

    // UI State
    leftNavExpanded: false,
    rightDockOpen: true,
    bottomDockOpen: true,
    toggleLeftNav: () => set((s) => ({ leftNavExpanded: !s.leftNavExpanded })),
    toggleRightDock: () => set((s) => ({ rightDockOpen: !s.rightDockOpen })),
    toggleBottomDock: () => set((s) => ({ bottomDockOpen: !s.bottomDockOpen })),
}));

// Selectors
export const useAppMode = () => useAppStore((s) => s.mode);
export const useSymbol = () => useAppStore((s) => s.symbol);
export const useTimeframe = () => useAppStore((s) => s.timeframe);
export const useProviders = () => useAppStore((s) => s.providers);
export const useReplayState = () => useAppStore((s) => ({
    isPlaying: s.isReplayPlaying,
    speed: s.replaySpeed,
    time: s.replayTime,
}));
