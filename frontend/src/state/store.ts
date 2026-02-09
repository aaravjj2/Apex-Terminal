import { create } from 'zustand';
import type { Candle, WSMessage, Indicator, Drawing, ToolType, IndicatorType } from '../core/types.ts';
import { WebSocketClient, type WSConnectionState } from '../data/WebSocketClient.ts';
import { ClockClient, type ClockState } from '../data/ClockClient.ts';
import { API_BASE } from '../config/api';
// Core indicator calculators
import {
    calculateSMA,
    calculateEMA,
    calculateVWAP,
    calculateRSI,
    calculateMACD,
    calculateBollinger,
    calculateATR,
    // Trend
    calculateIchimoku,
    calculateSupertrend,
    calculateSAR,
    calculateADX,
    calculateAroon,
    calculateMARibbon,
    // Momentum
    calculateStochastic,
    calculateStochRSI,
    calculateCCI,
    calculateROC,
    calculateWilliamsR,
    calculateTRIX,
    calculateMomentum,
    // Volatility
    calculateKeltner,
    calculateDonchian,
    calculateBBWidth,
    calculateHV,
    calculateATRBands,
    // Volume
    calculateOBV,
    calculateMFI,
    calculateCMF,
    calculateADL,
    calculateVWMA,
    // Profile
    calculateAnchoredVWAP,
    calculateVWAPBands,
} from '../features/indicators/calculators/index.ts';

interface AppState {
    symbol: string;
    timeframe: string;
    candles: Candle[];
    lastCandle: Candle | null;
    wsClient: WebSocketClient | null;
    // State
    wsState: WSConnectionState;
    reconnectAttempts: number;

    // Replay State
    replayState: ClockState | null;

    // Indicators
    activeIndicators: Indicator[];
    addIndicator: (type: IndicatorType, period: number, color: string) => void;
    removeIndicator: (id: string) => void;
    recalcIndicators: () => void;

    // Drawings
    drawings: Drawing[];
    activeTool: ToolType;
    setTool: (tool: ToolType) => void;
    addDrawing: (drawing: Drawing) => void;
    fetchDrawings: () => Promise<void>;
    removeDrawing: (id: string) => void;

    setSymbol: (symbol: string) => void;
    setTimeframe: (tf: string) => void;
    connect: () => void;
    disconnect: () => void;
    forceReconnect: () => void;
    getWsConnectionStats: () => { state: WSConnectionState; connected: boolean; reconnectAttempts: number; lastHeartbeat: number; timeSinceLastHeartbeat: number | null } | null;

    // Data helpers
    fetchLatestBar: (symbol?: string, timeframe?: string) => Promise<void>;

    // Replay Actions
    fetchClockState: () => Promise<void>;
    setReplayMode: (active: boolean) => Promise<void>;
    controlReplay: (action: 'freeze' | 'resume' | 'start' | 'stop') => Promise<void>;
    setReplaySpeed: (speed: number) => Promise<void>;
    stepReplay: () => Promise<void>;

    // Data ingestion
    processMessage: (msg: WSMessage) => void;
    setCandles: (candles: Candle[]) => void;
}

export const useStore = create<AppState>((set, get) => ({
    symbol: 'AAPL',
    timeframe: '1m',
    candles: [],
    lastCandle: null,
    wsClient: null,
    wsState: 'DISCONNECTED' as WSConnectionState,
    reconnectAttempts: 0,
    replayState: null,
    activeIndicators: [],
    drawings: [],
    activeTool: 'cursor',

    fetchLatestBar: async (symbol?: string, timeframe?: string) => {
        try {
            const s = (symbol || get().symbol).toUpperCase();
            const tf = timeframe || get().timeframe;
            const res = await fetch(`${API_BASE}/api/v1/bars/${s}/${tf}/latest`);
            if (!res.ok) return;
            const latest = await res.json();

            const candle: Candle = {
                time: latest.ts_start_ms,
                open: latest.open || 0,
                high: latest.high || 0,
                low: latest.low || 0,
                close: latest.close || 0,
                volume: latest.volume || 0,
                state: 'HISTORICAL',
            };

            set({ candles: [candle], lastCandle: null });
        } catch (e) {
            console.error('Failed to fetch latest bar', e);
        }
    },

    setSymbol: (symbol) => {
        get().disconnect();
        set({ symbol, candles: [], lastCandle: null, drawings: [] });
        // Seed authoritative latest bar then connect
        get().fetchLatestBar(symbol).then(() => { get().connect(); get().fetchDrawings(); });
    },

    setTimeframe: (timeframe) => {
        get().disconnect();
        set({ timeframe, candles: [], lastCandle: null });
        // Seed authoritative latest bar for new timeframe and reconnect
        get().fetchLatestBar(undefined, timeframe).then(() => get().connect());
    },

    connect: () => {
        const { symbol, timeframe } = get();
        const url = `ws://127.0.0.1:8000/ws/bars/${symbol}/${timeframe}`;

        const onStateChange = (newState: WSConnectionState, _prev: WSConnectionState, details?: { reconnectAttempts: number }) => {
            set({
                wsState: newState,
                reconnectAttempts: details?.reconnectAttempts ?? 0
            });
        };

        const client = new WebSocketClient(url, get().processMessage, onStateChange);
        client.connect();
        set({ wsClient: client });

        // Also fetch recent history from backend to ensure we have the latest bars
        get().fetchLatestBar();
    },

    disconnect: () => {
        const { wsClient } = get();
        if (wsClient) {
            wsClient.disconnect();
        }
        set({ wsClient: null, wsState: 'DISCONNECTED' });
    },

    forceReconnect: () => {
        const { wsClient } = get();
        if (wsClient) {
            wsClient.forceReconnect();
        } else {
            // No client exists, create new connection
            get().connect();
        }
    },

    getWsConnectionStats: () => {
        const { wsClient } = get();
        if (wsClient) {
            return wsClient.getConnectionStats();
        }
        return null;
    },

    fetchClockState: async () => {
        try {
            const state = await ClockClient.getState();
            set({ replayState: state });
        } catch (e) {
            console.error("Failed to fetch clock state", e);
        }
    },

    setReplayMode: async (active) => {
        try {
            await ClockClient.setMode(active ? 'virtual' : 'live');
            await get().fetchClockState();
            // Clear data on mode switch?
            set({ candles: [], lastCandle: null });
        } catch (e) {
            console.error("Failed to set replay mode", e);
        }
    },

    controlReplay: async (action) => {
        try {
            await ClockClient.control(action);
            await get().fetchClockState();
        } catch (e) {
            console.error("Failed to control replay", e);
        }
    },

    setReplaySpeed: async (speed) => {
        try {
            await ClockClient.setSpeed(speed);
            await get().fetchClockState();
        } catch (e) {
            console.error("Failed to set replay speed", e);
        }
    },

    stepReplay: async () => {
        try {
            // Step 1 minute (or timeframe dependent)
            // For 1m TF, step 60000ms
            const step = 60000;
            await ClockClient.advance(step);
            await get().fetchClockState();
        } catch (e) {
            console.error("Failed to step replay", e);
        }
    },

    processMessage: (msg: any) => {
        // Backend sends flat message: { type, symbol, open, close, ... }
        const type = msg.type;

        // Map WS message to Candle
        const candle: Candle = {
            time: msg.ts_start_ms,
            open: msg.open,
            high: msg.high,
            low: msg.low,
            close: msg.close,
            volume: msg.volume
        };

        set((state) => {
            let newState: Partial<AppState> = {};

            if (type === 'BAR_FORMING') {
                newState = { lastCandle: candle };
            } else if (type === 'BAR_CONFIRMED' || type === 'BAR_HISTORICAL') {
                // Deduplicate based on time to avoid duplicates from re-subscriptions
                const exists = state.candles.some(c => c.time === candle.time);
                if (!exists) {
                    const newCandles = [...state.candles, candle].sort((a, b) => a.time - b.time);
                    newState = {
                        candles: newCandles,
                        lastCandle: null
                    };
                }
            } else if (type === 'SUBSCRIBED') {
                // Clear candles on new subscription (if symbol changed)
                if (msg.symbol !== state.symbol) {
                    // mismatch? usually handled by setSymbol
                }
            }

            return newState;
        });

        get().recalcIndicators();
    },

    setCandles: (candles) => {
        set({ candles });
        get().recalcIndicators();
    },

    addIndicator: (type, period, color) => {
        const id = Math.random().toString(36).substr(2, 9);
        const ind: Indicator = {
            id,
            type,
            period,
            color,
            params: {},
            visible: true,
            data: []
        };
        set((state) => ({ activeIndicators: [...state.activeIndicators, ind] }));
        get().recalcIndicators();
    },

    removeIndicator: (id) => {
        set((state) => ({ activeIndicators: state.activeIndicators.filter(i => i.id !== id) }));
    },

    recalcIndicators: () => {
        const { candles, lastCandle, activeIndicators } = get();
        const fullData = lastCandle ? [...candles, lastCandle] : candles;

        if (fullData.length === 0) return;

        const newIndicators = activeIndicators.map(ind => {
            let data: { time: number; value: number }[] = [];
            let signalData: { time: number; value: number }[] | undefined;
            let histogramData: { time: number; value: number }[] | undefined;
            let upperData: { time: number; value: number }[] | undefined;
            let lowerData: { time: number; value: number }[] | undefined;

            switch (ind.type) {
                case 'SMA':
                    data = calculateSMA(fullData, ind.period);
                    break;
                case 'EMA':
                    data = calculateEMA(fullData, ind.period);
                    break;
                case 'VWAP':
                    data = calculateVWAP(fullData);
                    break;
                case 'RSI':
                    data = calculateRSI(fullData, ind.period);
                    break;
                case 'MACD': {
                    const macdResult = calculateMACD(fullData, 12, 26, 9);
                    data = macdResult.macd;
                    signalData = macdResult.signal;
                    histogramData = macdResult.histogram;
                    break;
                }
                case 'BOLLINGER': {
                    const bollResult = calculateBollinger(fullData, ind.period, 2);
                    data = bollResult.middle;
                    upperData = bollResult.upper;
                    lowerData = bollResult.lower;
                    break;
                }
                case 'ATR':
                    data = calculateATR(fullData, ind.period);
                    break;
                // === TREND INDICATORS ===
                case 'ICHIMOKU': {
                    const ich = calculateIchimoku(fullData);
                    data = ich.tenkan;
                    signalData = ich.kijun;
                    upperData = ich.senkouA;
                    lowerData = ich.senkouB;
                    // chikou stored in extra
                    break;
                }
                case 'SUPERTREND': {
                    const st = calculateSupertrend(fullData, ind.period || 10, 3);
                    data = st.supertrend;
                    // direction array indicates trend (1=up, -1=down)
                    break;
                }
                case 'SAR': {
                    const sar = calculateSAR(fullData);
                    data = sar.sar;
                    break;
                }
                case 'ADX': {
                    const adx = calculateADX(fullData, ind.period || 14);
                    data = adx.adx;
                    signalData = adx.diPlus;
                    histogramData = adx.diMinus;
                    break;
                }
                case 'AROON': {
                    const ar = calculateAroon(fullData, ind.period || 25);
                    data = ar.aroonUp;
                    signalData = ar.aroonDown;
                    histogramData = ar.oscillator;
                    break;
                }
                case 'MA_RIBBON': {
                    const ribbon = calculateMARibbon(fullData);
                    // ribbon has multiple lines - store first 3 in available slots
                    if (ribbon.lines.length > 0) data = ribbon.lines[0];
                    if (ribbon.lines.length > 1) signalData = ribbon.lines[1];
                    if (ribbon.lines.length > 2) histogramData = ribbon.lines[2];
                    if (ribbon.lines.length > 2) upperData = ribbon.lines[2];
                    break;
                }
                // === MOMENTUM INDICATORS ===
                case 'STOCH': {
                    const stoch = calculateStochastic(fullData, 14, 3, 3);
                    data = stoch.k;
                    signalData = stoch.d;
                    break;
                }
                case 'STOCH_RSI': {
                    const srsi = calculateStochRSI(fullData, 14, 14, 3, 3);
                    data = srsi.k;
                    signalData = srsi.d;
                    break;
                }
                case 'CCI':
                    data = calculateCCI(fullData, ind.period || 20);
                    break;
                case 'ROC':
                    data = calculateROC(fullData, ind.period || 9);
                    break;
                case 'WILLIAMS_R':
                    data = calculateWilliamsR(fullData, ind.period || 14);
                    break;
                case 'TRIX': {
                    const trix = calculateTRIX(fullData, ind.period || 15);
                    data = trix.trix;
                    signalData = trix.signal;
                    break;
                }
                case 'MOMENTUM':
                    data = calculateMomentum(fullData, ind.period || 10);
                    break;
                // === VOLATILITY INDICATORS ===
                case 'KELTNER': {
                    const kelt = calculateKeltner(fullData, ind.period || 20, 2);
                    data = kelt.middle;
                    upperData = kelt.upper;
                    lowerData = kelt.lower;
                    break;
                }
                case 'DONCHIAN': {
                    const don = calculateDonchian(fullData, ind.period || 20);
                    data = don.middle;
                    upperData = don.upper;
                    lowerData = don.lower;
                    break;
                }
                case 'BB_WIDTH': {
                    const bbw = calculateBBWidth(fullData, ind.period || 20);
                    data = bbw.width;
                    signalData = bbw.percentB;
                    break;
                }
                case 'HV':
                    data = calculateHV(fullData, ind.period || 20);
                    break;
                case 'ATR_BANDS': {
                    const atrb = calculateATRBands(fullData, ind.period || 14, 2);
                    data = atrb.middle;
                    upperData = atrb.upper;
                    lowerData = atrb.lower;
                    break;
                }
                // === VOLUME INDICATORS ===
                case 'OBV': {
                    const obv = calculateOBV(fullData);
                    data = obv.obv;
                    signalData = obv.ma;
                    break;
                }
                case 'MFI':
                    data = calculateMFI(fullData, ind.period || 14);
                    break;
                case 'CMF':
                    data = calculateCMF(fullData, ind.period || 20);
                    break;
                case 'ADL':
                    data = calculateADL(fullData);
                    break;
                case 'VWMA':
                    data = calculateVWMA(fullData, ind.period || 20);
                    break;
                // === PROFILE INDICATORS ===
                case 'ANCHORED_VWAP': {
                    // Use first candle time as anchor by default
                    const anchorTime = fullData[0]?.time || 0;
                    const avwap = calculateAnchoredVWAP(fullData, anchorTime);
                    data = avwap.vwap;
                    upperData = avwap.upper1;
                    lowerData = avwap.lower1;
                    break;
                }
                case 'VWAP_BANDS': {
                    const vb = calculateVWAPBands(fullData, 'session');
                    data = vb.vwap;
                    upperData = vb.upper1;
                    lowerData = vb.lower1;
                    break;
                }
                default:
                    break;
            }

            return { ...ind, data, signalData, histogramData, upperData, lowerData };
        });

        set({ activeIndicators: newIndicators });
    },

    setTool: (tool) => set({ activeTool: tool }),

    addDrawing: (drawing) => {
        set((state) => ({ drawings: [...state.drawings, drawing], activeTool: 'cursor' }));
        // Save to backend
        const symbol = get().symbol;
        fetch(`${API_BASE}/api/v1/drawings/${symbol}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(drawing)
        }).catch(console.error);
    },

    fetchDrawings: async () => {
        const symbol = get().symbol;
        try {
            const response = await fetch(`${API_BASE}/api/v1/drawings/${symbol}`);
            if (response.ok) {
                const data = await response.json();
                set({ drawings: data.drawings || [] });
            }
        } catch (e) {
            console.error('Failed to fetch drawings:', e);
        }
    },

    removeDrawing: (id: string) => {
        const symbol = get().symbol;
        set((state) => ({ drawings: state.drawings.filter(d => d.id !== id) }));
        fetch(`${API_BASE}/api/v1/drawings/${symbol}/${id}`, {
            method: 'DELETE'
        }).catch(console.error);
    }
}));
