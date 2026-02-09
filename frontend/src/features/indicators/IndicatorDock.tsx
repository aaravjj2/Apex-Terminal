import { Trash2, Eye } from 'lucide-react';
import { useStore } from '../../state/store';
import { INDICATOR_REGISTRY } from './IndicatorRegistry';

export function IndicatorDock() {
    const { activeIndicators, removeIndicator } = useStore();

    if (activeIndicators.length === 0) {
        return (
            <div className="p-4 text-center">
                <p className="text-sm text-text-muted">No indicators added</p>
                <p className="text-xs text-text-tertiary mt-1">
                    Use the Indicators button in the chart header
                </p>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-2">
            {activeIndicators.map(ind => {
                const config = INDICATOR_REGISTRY[ind.type];
                if (!config) return null;

                return (
                    <div
                        key={ind.id}
                        data-testid={`active-indicator-${ind.type}`}
                        className="bg-element-bg rounded-md p-2 border border-border hover:border-accent-primary/30 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: ind.color }}
                                />
                                <span className="text-sm font-medium text-text">
                                    {config.shortName}
                                </span>
                                {ind.period && (
                                    <span className="text-xs text-text-secondary">
                                        ({ind.period})
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        // TODO: Implement visibility toggle
                                        console.log('Toggle visibility for', ind.id);
                                    }}
                                    className="p-1 rounded hover:bg-panel-bg transition-colors text-text-secondary hover:text-text"
                                    title="Toggle visibility (coming soon)"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    onClick={() => removeIndicator(ind.id)}
                                    className="p-1 rounded hover:bg-panel-bg transition-colors text-text-secondary hover:text-error"
                                    title="Remove"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Parameter Summary */}
                        <div className="text-xs text-text-secondary space-y-1">
                            {Object.entries(ind.params).map(([key, value]) => {
                                if (key === 'color' || typeof value === 'boolean') return null;
                                return (
                                    <div key={key} className="flex justify-between">
                                        <span className="capitalize">{key}:</span>
                                        <span className="text-text font-mono">{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
