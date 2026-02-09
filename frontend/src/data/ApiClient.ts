/**
 * Centralized API client for backend integration.
 */

import { API_BASE } from '../config/api';

const API_V1 = `${API_BASE}/api/v1`;

export interface ParityStatus {
    symbol: string;
    timeframe: string;
    count: number;
    hash: string;
    from_ms: number | null;
    to_ms: number | null;
}

export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
}

export interface StrategyResponse {
    id: string;
    name: string;
    strategy_type: string;
    symbol: string;
    status: string;
    params: Record<string, unknown>;
    created_at: string;
    started_at: string | null;
    metrics: Record<string, unknown>;
}

export interface Position {
    symbol: string;
    qty: number;
    avg_price: number;
    current_price: number;
    pnl?: number;
    unrealized_pnl?: number;
}

export interface Order {
    id: string;
    strategy_id?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP';
    qty: number;
    filled_qty: number;
    status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'OPEN';
    created_at: string;
}

export interface Alert {
    id: string;
    name?: string;
    symbol: string;
    condition: string;
    value: number;
    status: string;
    delivery: string[];
    throttle?: string;
    triggered?: number;
}

export const ApiClient = {
    // Health
    async checkHealth(): Promise<HealthResponse> {
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (!res.ok) return { status: 'unhealthy' };
            return { status: 'healthy' };
        } catch {
            return { status: 'unhealthy' };
        }
    },

    // Ingestion provider status
    async getProviderStatus(): Promise<{ provider: string | null; running: boolean }> {
        try {
            const res = await fetch(`${API_V1}/ingest/provider-status`);
            if (!res.ok) return { provider: null, running: false };
            return res.json();
        } catch {
            return { provider: null, running: false };
        }
    },

    // Parity
    async getParityHash(symbol: string, timeframe: string): Promise<ParityStatus> {
        const res = await fetch(`${API_V1}/parity/hash/${symbol}/${timeframe}`);
        if (!res.ok) throw new Error('Failed to fetch parity hash');
        return res.json();
    },

    async compareParity(symbol: string, timeframe: string, csvFile: File): Promise<{
        match: boolean;
        local_hash: string;
        reference_hash: string | null;
        local_count: number;
        reference_count: number;
        diffs: unknown[];
        message: string;
    }> {
        const formData = new FormData();
        formData.append('file', csvFile);

        const res = await fetch(`${API_V1}/parity/compare/${symbol}/${timeframe}`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to compare parity');
        return res.json();
    },

    // Strategies
    async listStrategies(): Promise<StrategyResponse[]> {
        const res = await fetch(`${API_V1}/strategies`);
        if (!res.ok) throw new Error('Failed to list strategies');
        return res.json();
    },

    async createStrategy(data: {
        name: string;
        strategy_type: string;
        symbol: string;
        params?: Record<string, unknown>;
    }): Promise<StrategyResponse> {
        const res = await fetch(`${API_V1}/strategies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create strategy');
        return res.json();
    },

    async startStrategy(id: string): Promise<void> {
        const res = await fetch(`${API_V1}/strategies/${id}/start`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to start strategy');
    },

    async stopStrategy(id: string): Promise<void> {
        const res = await fetch(`${API_V1}/strategies/${id}/stop`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to stop strategy');
    },

    async deleteStrategy(id: string): Promise<void> {
        const res = await fetch(`${API_V1}/strategies/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete strategy');
    },

    // Portfolio
    async getPositions(): Promise<Position[]> {
        const res = await fetch(`${API_V1}/portfolio/positions`);
        if (!res.ok) return [];
        return res.json();
    },

    async getOrders(): Promise<Order[]> {
        const res = await fetch(`${API_V1}/portfolio/orders`);
        if (!res.ok) return [];
        return res.json();
    },

    // Alerts
    async listAlerts(): Promise<Alert[]> {
        const res = await fetch(`${API_V1}/alerts`);
        if (!res.ok) return [];
        return res.json();
    },

    async createAlert(data: {
        name?: string;
        symbol: string;
        condition: string;
        value: number;
        delivery: string[];
    }): Promise<Alert> {
        const res = await fetch(`${API_V1}/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create alert');
        return res.json();
    },

    async deleteAlert(id: string): Promise<void> {
        const res = await fetch(`${API_V1}/alerts/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete alert');
    },

    // Automation (Autopilot)
    async getAutomationStatus(): Promise<AutopilotStatus> {
        try {
            const res = await fetch(`${API_V1}/automation/status`);
            if (!res.ok) return getDefaultAutopilotStatus();
            return res.json();
        } catch {
            return getDefaultAutopilotStatus();
        }
    },

    async armAutomation(mode: 'paper' | 'live', confirmLive: boolean = false): Promise<AutopilotStatus> {
        const res = await fetch(`${API_V1}/automation/arm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, confirm_live: confirmLive }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to arm automation');
        }
        return res.json();
    },

    async disarmAutomation(): Promise<AutopilotStatus> {
        const res = await fetch(`${API_V1}/automation/disarm`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to disarm automation');
        return res.json();
    },

    async killAutomation(): Promise<AutopilotStatus> {
        const res = await fetch(`${API_V1}/automation/kill`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to trigger kill switch');
        return res.json();
    },

    async resetAutomation(): Promise<AutopilotStatus> {
        const res = await fetch(`${API_V1}/automation/reset`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to reset automation');
        return res.json();
    },

    // Forecast (Uncertainty Cone)
    async getForecast(symbol: string, days: number = 30, confidence: string = '0.68,0.95'): Promise<ForecastResponse> {
        const res = await fetch(`${API_V1}/forecast/${symbol}?days=${days}&confidence=${encodeURIComponent(confidence)}`);
        if (!res.ok) throw new Error('Failed to fetch forecast');
        return res.json();
    },

    // Forecast Config (Unified Autopilot)
    async updateForecastConfig(config: ForecastConfig): Promise<AutopilotStatus> {
        const res = await fetch(`${API_V1}/automation/forecast-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to update forecast config');
        }
        return res.json();
    },

    async getForecastStatus(symbol: string = 'AAPL'): Promise<ForecastStatus> {
        const res = await fetch(`${API_V1}/automation/forecast-status?symbol=${symbol}`);
        if (!res.ok) return { symbol };
        return res.json();
    },
};

// Automation types
export interface ForecastConfig {
    enabled: boolean;
    confidence_level: number;
    use_for_filtering: boolean;
    use_for_sizing: boolean;
    max_volatility_threshold: number;
}

export interface ForecastStatus {
    symbol: string;
    bias?: 'bullish' | 'bearish' | 'neutral';
    historical_volatility?: number;
    upper_bound_30d?: number;
    lower_bound_30d?: number;
    size_multiplier?: number;
}

export interface AutopilotStatus {
    armed: boolean;
    mode: 'paper' | 'live';
    budget: BudgetConfig;
    current_spent_today: number;
    active_strategies: string[];
    kill_switch_triggered: boolean;
    forecast_config?: ForecastConfig;
    forecast_status?: ForecastStatus;
}

export interface BudgetConfig {
    max_total_notional: number;
    max_daily_spend: number;
    max_per_trade: number;
    max_concurrent_positions: number;
    max_leverage: number;
    hard_drawdown_stop: number;
}

export interface ForecastResponse {
    symbol: string;
    current_price: number;
    forecast_days: number;
    historical_volatility: number;
    daily_volatility: number;
    cones: Record<string, { upper: number[]; lower: number[]; median: number[] }>;
    generated_at: string;
}

function getDefaultAutopilotStatus(): AutopilotStatus {
    return {
        armed: false,
        mode: 'paper',
        budget: {
            max_total_notional: 10000,
            max_daily_spend: 1000,
            max_per_trade: 500,
            max_concurrent_positions: 5,
            max_leverage: 1,
            hard_drawdown_stop: 0.1,
        },
        current_spent_today: 0,
        active_strategies: [],
        kill_switch_triggered: false,
    };
}
