/**
 * Greeks Tile - Options Greeks display
 */

import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
}

interface PositionGreeks {
    symbol: string;
    position: string;
    quantity: number;
    greeks: Greeks;
}

const MOCK_GREEKS: PositionGreeks[] = [
    { symbol: 'AAPL', position: 'Jan 180 Call', quantity: 10, greeks: { delta: 0.45, gamma: 0.035, theta: -0.12, vega: 0.28, rho: 0.15 } },
    { symbol: 'AAPL', position: 'Jan 175 Put', quantity: -5, greeks: { delta: -0.35, gamma: 0.028, theta: -0.08, vega: 0.22, rho: -0.12 } },
    { symbol: 'MSFT', position: 'Feb 380 Call', quantity: 5, greeks: { delta: 0.52, gamma: 0.022, theta: -0.15, vega: 0.45, rho: 0.28 } },
];

export function GreeksTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    // Calculate portfolio totals
    const totals = MOCK_GREEKS.reduce((acc, pos) => ({
        delta: acc.delta + pos.greeks.delta * pos.quantity * 100,
        gamma: acc.gamma + pos.greeks.gamma * pos.quantity * 100,
        theta: acc.theta + pos.greeks.theta * pos.quantity * 100,
        vega: acc.vega + pos.greeks.vega * pos.quantity * 100,
        rho: acc.rho + pos.greeks.rho * pos.quantity * 100,
    }), { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });

    return (
        <div className="h-full flex flex-col">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-5 gap-2 p-3 border-b border-border bg-element-bg/50">
                <div className="text-center">
                    <div className="text-xs text-text-muted">Delta</div>
                    <div className={cn(
                        "text-lg font-semibold",
                        totals.delta >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        {totals.delta.toFixed(0)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-text-muted">Gamma</div>
                    <div className="text-lg font-semibold text-text">{totals.gamma.toFixed(1)}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-text-muted">Theta</div>
                    <div className={cn(
                        "text-lg font-semibold",
                        totals.theta >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        ${totals.theta.toFixed(0)}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-text-muted">Vega</div>
                    <div className="text-lg font-semibold text-text">{totals.vega.toFixed(0)}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-text-muted">Rho</div>
                    <div className="text-lg font-semibold text-text">{totals.rho.toFixed(0)}</div>
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-7 gap-1 px-3 py-2 text-xs text-text-muted border-b border-border">
                <div className="col-span-2">Position</div>
                <div className="text-right">Δ</div>
                <div className="text-right">Γ</div>
                <div className="text-right">Θ</div>
                <div className="text-right">V</div>
                <div className="text-right">ρ</div>
            </div>

            {/* Positions */}
            <div className="flex-1 overflow-y-auto">
                {MOCK_GREEKS.map((pos, idx) => (
                    <div
                        key={idx}
                        className="grid grid-cols-7 gap-1 px-3 py-2 text-sm border-b border-border/50 hover:bg-element-bg"
                    >
                        <div className="col-span-2">
                            <div className="font-medium text-text">{pos.symbol}</div>
                            <div className="text-xs text-text-muted">
                                {pos.quantity > 0 ? '+' : ''}{pos.quantity} {pos.position}
                            </div>
                        </div>
                        <div className={cn(
                            "text-right font-mono",
                            pos.greeks.delta >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {(pos.greeks.delta * pos.quantity * 100).toFixed(0)}
                        </div>
                        <div className="text-right font-mono text-text-secondary">
                            {(pos.greeks.gamma * pos.quantity * 100).toFixed(1)}
                        </div>
                        <div className={cn(
                            "text-right font-mono",
                            pos.greeks.theta * pos.quantity >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {(pos.greeks.theta * pos.quantity * 100).toFixed(0)}
                        </div>
                        <div className="text-right font-mono text-text-secondary">
                            {(pos.greeks.vega * pos.quantity * 100).toFixed(0)}
                        </div>
                        <div className="text-right font-mono text-text-secondary">
                            {(pos.greeks.rho * pos.quantity * 100).toFixed(0)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
