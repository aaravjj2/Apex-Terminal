import { useState } from 'react';
import { ChevronDown, TrendingUp, Grid3X3, Maximize2 } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { IconButton } from '../../ui/IconButton';
import { useAppStore } from '../../state/appStore';
import { useStore } from '../../state/store';
import { SymbolSearchModal } from './SymbolSearchModal';
import { IndicatorsModal } from './IndicatorsModal';

export function ChartHeaderStrip() {
    const { symbol, setSymbol, timeframe, setTimeframe, mode } = useAppStore();
    const { activeIndicators, setSymbol: setStoreSymbol } = useStore();
    const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState(false);
    const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);

    const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

    return (
        <div className="h-10 bg-panel-bg border-b border-border flex items-center px-2 gap-2 shrink-0">
            {/* Symbol */}
            <button
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-element-bg transition-colors"
                onClick={() => setIsSymbolSearchOpen(true)}
            >
                <span className="text-sm font-semibold text-text">{symbol}</span>
                <span className="text-xxs text-text-secondary">NASDAQ</span>
                <ChevronDown size={12} className="text-text-secondary" />
            </button>

            <div className="w-px h-5 bg-border" />

            {/* Timeframes */}
            <div className="flex items-center gap-0.5">
                {timeframes.map(tf => (
                    <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${tf === timeframe
                            ? 'bg-element-bg text-text font-medium'
                            : 'text-text-secondary hover:text-text hover:bg-element-bg'
                            }`}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            <div className="w-px h-5 bg-border" />

            {/* Indicators dropdown */}
            <button
                className="flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:text-text hover:bg-element-bg transition-colors"
                onClick={() => setIsIndicatorsOpen(true)}
                data-testid="indicators-btn"
            >
                <TrendingUp size={14} />
                <span className="text-xs">Indicators</span>
                {activeIndicators.length > 0 && (
                    <Badge size="sm">{activeIndicators.length}</Badge>
                )}
            </button>

            <div className="flex-1" />

            {/* Chart controls */}
            <div className="flex items-center gap-1">
                <IconButton
                    icon={<Grid3X3 size={14} />}
                    tooltip="Chart layout"
                    variant="ghost"
                    size="sm"
                />
                <IconButton
                    icon={<Maximize2 size={14} />}
                    tooltip="Fullscreen"
                    variant="ghost"
                    size="sm"
                />
            </div>

            {/* Mode indicator in chart header */}
            {mode === 'REPLAY' && (
                <>
                    <div className="w-px h-5 bg-border" />
                    <Badge variant="replay" size="sm">REPLAY</Badge>
                </>
            )}

            <SymbolSearchModal
                open={isSymbolSearchOpen}
                onClose={() => setIsSymbolSearchOpen(false)}
                onSelect={(newSymbol) => {
                    setSymbol(newSymbol);
                    setStoreSymbol(newSymbol);
                }}
            />

            <IndicatorsModal
                open={isIndicatorsOpen}
                onClose={() => setIsIndicatorsOpen(false)}
            />
        </div>
    );
}
