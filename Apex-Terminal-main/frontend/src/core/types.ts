export interface Size {
    width: number;
    height: number;
}

export interface ChartOptions {
    width: number;
    height: number;
    pixelRatio?: number;
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    state?: 'FORMING' | 'CONFIRMED' | 'HISTORICAL';
}

export type MessageType = 'BAR_FORMING' | 'BAR_CONFIRMED';

export interface WSMessage {
    type: MessageType;
    symbol: string;
    timeframe: string;
    payload: Candle;
    hash?: string; // Parity hash
}

// ============================================================================
// WORKSPACE SYSTEM
// ============================================================================

export type WorkspaceType = 'chart' | 'dashboard';

export interface WorkspaceLayout {
    id: string;
    name: string;
    type: WorkspaceType;
    tiles?: TilePosition[];
}

export interface TilePosition {
    tileId: string;
    tileType: string; // Reference to TileDefinition.id
    x: number;
    y: number;
    w: number;
    h: number;
}

// ============================================================================
// INDICATOR SYSTEM (Expanded)
// ============================================================================

// All supported indicator types
export type IndicatorType =
    // Existing
    | 'SMA' | 'EMA' | 'VWAP' | 'RSI' | 'MACD' | 'BOLLINGER' | 'ATR'
    // Trend
    | 'ICHIMOKU' | 'SUPERTREND' | 'SAR' | 'ADX' | 'AROON' | 'MA_RIBBON'
    // Momentum
    | 'STOCH' | 'STOCH_RSI' | 'CCI' | 'ROC' | 'WILLIAMS_R' | 'TRIX' | 'MOMENTUM'
    // Volatility
    | 'KELTNER' | 'DONCHIAN' | 'BB_WIDTH' | 'HV' | 'ATR_BANDS'
    // Volume
    | 'OBV' | 'MFI' | 'CMF' | 'ADL' | 'VWMA' | 'VOLUME_PROFILE'
    // Profile
    | 'VRVP' | 'ANCHORED_VWAP' | 'VWAP_BANDS';

export type IndicatorCategory = 'trend' | 'momentum' | 'volatility' | 'volume' | 'profile';
export type IndicatorPaneType = 'overlay' | 'separate';
export type IndicatorRenderType = 'line' | 'histogram' | 'area' | 'cloud' | 'profile' | 'bands';

export interface IndicatorParamDef {
    name: string;
    label: string;
    type: 'number' | 'color' | 'boolean' | 'select';
    default: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: string | number; label: string }[];
}

export interface IndicatorDefinition {
    id: IndicatorType;
    name: string;
    shortName: string;
    category: IndicatorCategory;
    paneType: IndicatorPaneType;
    renderType: IndicatorRenderType;
    params: IndicatorParamDef[];
    outputs: string[]; // Names of output series
    description: string;
}

export interface Indicator {
    id: string;
    type: IndicatorType;
    period: number;
    color: string;
    params: Record<string, number | string | boolean>;
    visible: boolean;
    data: { time: number; value: number }[];
    // Multi-line outputs
    signalData?: { time: number; value: number }[];
    histogramData?: { time: number; value: number }[];
    upperData?: { time: number; value: number }[];
    lowerData?: { time: number; value: number }[];
    // Cloud data (Ichimoku)
    cloudData?: { time: number; spanA: number; spanB: number }[];
    // Additional series for complex indicators
    extraSeries?: Record<string, { time: number; value: number }[]>;
}

// ============================================================================
// DRAWING TOOLS (Expanded)
// ============================================================================

export type ToolType =
    | 'cursor'
    // Lines
    | 'line' | 'ray' | 'extended_line' | 'arrow'
    // Channels
    | 'parallel_channel' | 'regression_channel'
    // Shapes
    | 'rect' | 'ellipse' | 'triangle' | 'polygon'
    // Fibonacci
    | 'fib' | 'fib_channel' | 'fib_time' | 'fib_circle'
    // Pitchforks
    | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff'
    // Horizontal/Vertical
    | 'hline' | 'vline' | 'price_range' | 'date_range'
    // Measurements
    | 'risk_reward' | 'long_position' | 'short_position' | 'price_note'
    // Annotations
    | 'text' | 'callout' | 'note' | 'brush' | 'highlighter';

export interface Point {
    time: number;
    price: number;
}

export interface Drawing {
    id: string;
    type: ToolType;
    points: Point[];
    color: string;
    text?: string;
    // Drawing properties
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    fillColor?: string;
    fillOpacity?: number;
    locked?: boolean;
    hidden?: boolean;
    groupId?: string;
    // Risk/Reward specific
    takeProfitPrice?: number;
    stopLossPrice?: number;
    entryPrice?: number;
}

export interface DrawingGroup {
    id: string;
    name: string;
    drawingIds: string[];
    locked: boolean;
    visible: boolean;
}

export interface DrawingTemplate {
    id: string;
    name: string;
    type: ToolType;
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fillColor?: string;
    fillOpacity?: number;
}

// ============================================================================
// DASHBOARD TILES
// ============================================================================

export type TileCategory = 'analytics' | 'trading' | 'risk' | 'ai' | 'journal' | 'options' | 'market';

export interface TileDefinition {
    id: string;
    name: string;
    category: TileCategory;
    description: string;
    icon: string; // Emoji icon
    defaultSize: { w: number; h: number };
    minSize: { w: number; h: number };
    maxSize?: { w: number; h: number };
    dataEndpoint?: string;
    refreshRate?: number;
}

// ============================================================================
// OPTIONS ANALYTICS
// ============================================================================

export interface OptionContract {
    symbol: string;
    strike: number;
    expiration: string;
    type: 'call' | 'put';
    bid: number;
    ask: number;
    last: number;
    volume: number;
    openInterest: number;
    iv: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
}

export interface OptionsChain {
    underlying: string;
    underlyingPrice: number;
    expirations: string[];
    strikes: number[];
    calls: OptionContract[];
    puts: OptionContract[];
    lastUpdated: number;
}

export interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
}

// ============================================================================
// AI COPILOT
// ============================================================================

export type AIProposalType = 'strategy' | 'analysis' | 'research' | 'incident';
export type AIProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied';

export interface AIProposal {
    id: string;
    type: AIProposalType;
    title: string;
    description: string;
    reasoning: string[];
    confidence: number;
    status: AIProposalStatus;
    createdAt: number;
    appliedAt?: number;
    diff?: string;
    sourceLinks?: string[];
}

// ============================================================================
// BACKTEST & STRATEGY
// ============================================================================

export interface BacktestConfig {
    symbol: string;
    startDate: string;
    endDate: string;
    timeframe: string;
    initialCapital: number;
    strategyId: string;
    params: Record<string, number | string | boolean>;
}

export interface BacktestResult {
    id: string;
    config: BacktestConfig;
    metrics: BacktestMetrics;
    equityCurve: { time: number; equity: number; drawdown: number }[];
    trades: Trade[];
    configHash: string;
    tradeLogHash: string;
}

export interface BacktestMetrics {
    initialCapital: number;
    finalEquity: number;
    totalReturn: number;
    totalReturnPct: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
}

export interface Trade {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    entryTime: number;
    entryPrice: number;
    exitTime?: number;
    exitPrice?: number;
    quantity: number;
    pnl?: number;
    pnlPct?: number;
    status: 'open' | 'closed';
}

// ============================================================================
// INCIDENTS & GOVERNANCE
// ============================================================================

export interface Incident {
    id: string;
    runId: string;
    strategyId: string;
    capturedAt: string;
    durationSeconds: number;
    events: IncidentEvent[];
    metadata: Record<string, unknown>;
    contentHash: string;
}

export interface IncidentEvent {
    timestamp: string;
    type: 'bar' | 'signal' | 'order' | 'error';
    data: Record<string, unknown>;
}

export interface ReadinessScore {
    strategyId: string;
    overall: number;
    components: {
        backtestScore: number;
        robustnessScore: number;
        paperTradingScore: number;
        riskScore: number;
    };
    issues: string[];
    recommendations: string[];
}
