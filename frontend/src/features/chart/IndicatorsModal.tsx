import { useState, useMemo } from 'react';
import { Search, Star, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useStore } from '../../state/store';
import { INDICATOR_REGISTRY, getIndicatorsByCategory, CATEGORY_NAMES, INDICATOR_PRESETS } from '../indicators/IndicatorRegistry';
import type { IndicatorType } from '../../core/types';

interface IndicatorsModalProps {
    open: boolean;
    onClose: () => void;
}

type CategoryKey = 'trend' | 'momentum' | 'volatility' | 'volume' | 'profile';

export function IndicatorsModal({ open, onClose }: IndicatorsModalProps) {
    const { addIndicator } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set(['trend', 'momentum']));
    const [showPresets, setShowPresets] = useState(false);
    const [favorites, setFavorites] = useState<Set<IndicatorType>>(
        new Set(['SMA', 'EMA', 'RSI', 'MACD', 'BOLLINGER'] as IndicatorType[])
    );

    // Form state for selected indicator
    const [selectedType, setSelectedType] = useState<IndicatorType | null>(null);
    const [period, setPeriod] = useState(14);
    const [color, setColor] = useState('#2962ff');

    const selectedConfig = selectedType ? INDICATOR_REGISTRY[selectedType] : null;

    // Filter indicators by search
    const filteredIndicators = useMemo(() => {
        if (!searchQuery.trim()) return null;
        
        const query = searchQuery.toLowerCase();
        const results: Array<{ type: IndicatorType; config: typeof INDICATOR_REGISTRY[IndicatorType] }> = [];
        
        for (const [type, config] of Object.entries(INDICATOR_REGISTRY)) {
            if (
                config.name.toLowerCase().includes(query) ||
                config.shortName.toLowerCase().includes(query) ||
                config.description.toLowerCase().includes(query)
            ) {
                results.push({ type: type as IndicatorType, config });
            }
        }
        return results;
    }, [searchQuery]);

    const toggleCategory = (cat: CategoryKey) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) {
                next.delete(cat);
            } else {
                next.add(cat);
            }
            return next;
        });
    };

    const toggleFavorite = (type: IndicatorType) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    const selectIndicator = (type: IndicatorType) => {
        setSelectedType(type);
        const config = INDICATOR_REGISTRY[type];
        if (config) {
            // Find period and color from params array
            const periodParam = config.params.find(p => p.name === 'period');
            const colorParam = config.params.find(p => p.name === 'color');
            if (periodParam && typeof periodParam.default === 'number') {
                setPeriod(periodParam.default);
            }
            if (colorParam && typeof colorParam.default === 'string') {
                setColor(colorParam.default);
            }
        }
    };

    const handleAdd = () => {
        if (selectedType) {
            addIndicator(selectedType, period, color);
            setSelectedType(null);
            onClose();
        }
    };

    const applyPreset = (presetKey: string) => {
        const preset = INDICATOR_PRESETS[presetKey as keyof typeof INDICATOR_PRESETS];
        if (preset) {
            preset.indicators.forEach(ind => {
                addIndicator(ind.type, ind.period, ind.color);
            });
            onClose();
        }
    };

    const favoriteIndicators = Array.from(favorites).map(type => ({
        type,
        config: INDICATOR_REGISTRY[type]
    })).filter(x => x.config);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Indicators"
            size="lg"
        >
            <div className="flex h-[500px] border border-border rounded-md overflow-hidden bg-panel-bg">
                {/* Left Sidebar: Categories & Search */}
                <div className="w-1/3 border-r border-border flex flex-col bg-panel-header-bg">
                    <div className="p-2 border-b border-border">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                aria-label="Search indicators"
                                autoFocus
                                data-testid="indicator-search-input"
                                className="w-full bg-input-bg text-text text-xs rounded pl-8 pr-2 py-1.5 outline-none border border-input-border focus:border-accent-primary"
                            />
                        </div>
                    </div>

                    <div className="flex border-b border-border text-xs">
                        <button
                            className={`flex-1 py-2 font-medium ${!showPresets ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-muted hover:text-text'}`}
                            onClick={() => setShowPresets(false)}
                        >
                            Library
                        </button>
                        <button
                            className={`flex-1 py-2 font-medium ${showPresets ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-muted hover:text-text'}`}
                            onClick={() => setShowPresets(true)}
                        >
                            Presets
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                         {showPresets ? (
                            <div className="space-y-2">
                                {Object.entries(INDICATOR_PRESETS).map(([key, preset]) => (
                                    <button
                                        key={key}
                                        onClick={() => applyPreset(key)}
                                        className="w-full text-left p-2 rounded hover:bg-element-bg transition"
                                    >
                                        <div className="text-sm font-medium text-text">{preset.name}</div>
                                        <div className="text-xs text-text-muted mt-0.5">{preset.description}</div>
                                    </button>
                                ))}
                            </div>
                        ) : filteredIndicators ? (
                            <div className="space-y-1">
                                {filteredIndicators.length === 0 ? (
                                    <div className="text-sm text-text-muted text-center py-4">No results</div>
                                ) : (
                                    filteredIndicators.map(({ type, config }) => (
                                        <IndicatorListRow
                                            key={type}
                                            type={type}
                                            config={config}
                                            isSelected={selectedType === type}
                                            isFavorite={favorites.has(type)}
                                            onClick={() => selectIndicator(type)}
                                            onToggleFavorite={() => toggleFavorite(type)}
                                        />
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Favorites */}
                                {favoriteIndicators.length > 0 && (
                                    <div>
                                        <div className="text-xs text-text-warning font-medium mb-1 flex items-center px-1">
                                            <Star size={12} className="mr-1 fill-text-warning" />
                                            Favorites
                                        </div>
                                        <div className="space-y-1">
                                            {favoriteIndicators.map(({ type, config }) => (
                                                <IndicatorListRow
                                                    key={type}
                                                    type={type}
                                                    config={config}
                                                    isSelected={selectedType === type}
                                                    isFavorite={true}
                                                    onClick={() => selectIndicator(type)}
                                                    onToggleFavorite={() => toggleFavorite(type)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Categories */}
                                {(Object.keys(CATEGORY_NAMES) as CategoryKey[]).map(category => {
                                    const indicators = getIndicatorsByCategory(category);
                                    const isExpanded = expandedCategories.has(category);

                                    return (
                                        <div key={category}>
                                            <button
                                                onClick={() => toggleCategory(category)}
                                                className="w-full flex items-center justify-between py-1 px-1 text-xs font-medium text-text-muted hover:text-text"
                                            >
                                                <span>{CATEGORY_NAMES[category]}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-text-tertiary">{indicators.length}</span>
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="space-y-1 mt-1 pl-2">
                                                    {indicators.map((indicator) => (
                                                        <IndicatorListRow
                                                            key={indicator.id}
                                                            type={indicator.id as IndicatorType}
                                                            config={indicator}
                                                            isSelected={selectedType === indicator.id}
                                                            isFavorite={favorites.has(indicator.id as IndicatorType)}
                                                            onClick={() => selectIndicator(indicator.id as IndicatorType)}
                                                            onToggleFavorite={() => toggleFavorite(indicator.id as IndicatorType)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content: Description & Configuration */}
                <div className="flex-1 flex flex-col bg-panel-bg">
                    {selectedConfig ? (
                        <div className="p-4 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-medium text-text">{selectedConfig.name}</h3>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-element-bg text-text-secondary">
                                        {selectedConfig.shortName}
                                    </span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                                    <X size={16} />
                                </Button>
                            </div>
                            
                            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                                {selectedConfig.description}
                            </p>

                            <div className="border border-border rounded-md p-4 bg-element-bg/50 space-y-4 mb-6">
                                <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2">Parameters</h4>
                                
                                {selectedConfig.params.map(param => (
                                    <div key={param.name} className="flex items-center justify-between">
                                        <label className="text-sm text-text-secondary">{param.label}</label>
                                        {param.type === 'color' ? (
                                            <input
                                                type="color"
                                                value={param.name === 'color' ? color : (param.name === 'bandsColor' ? '#ff9800' : '#ffffff')}
                                                onChange={(e) => {
                                                    if (param.name === 'color') setColor(e.target.value);
                                                }}
                                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                            />
                                        ) : param.type === 'number' ? (
                                            <input
                                                type="number"
                                                value={param.name === 'period' ? period : (param.default as number)}
                                                onChange={(e) => {
                                                    if (param.name === 'period') setPeriod(Number(e.target.value));
                                                }}
                                                className="w-20 bg-input-bg text-text text-sm rounded px-2 py-1 outline-none border border-input-border text-right"
                                            />
                                        ) : (
                                            <div className="text-xs text-text-tertiary">Default</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto">
                                <Button 
                                    className="w-full justify-center" 
                                    size="lg"
                                    onClick={handleAdd}
                                    data-testid="add-to-chart-btn"
                                >
                                    Add to Chart
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-text-muted p-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-element-bg mb-4 flex items-center justify-center">
                                <Search size={24} className="opacity-50" />
                            </div>
                            <h3 className="text-base font-medium text-text mb-2">Select an Indicator</h3>
                            <p className="text-sm max-w-xs">
                                Choose an indicator from the library on the left to view details and configuration options.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

const IndicatorListRow = ({ type, config, isSelected, isFavorite, onClick, onToggleFavorite }: any) => (
    <div
        data-testid={`indicator-row-${type}`}
        className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition group ${
            isSelected ? 'bg-accent-primary/10 border border-accent-primary/30' : 'hover:bg-element-bg border border-transparent'
        }`}
        onClick={onClick}
    >
        <span className={`text-sm truncate ${isSelected ? 'text-accent-primary font-medium' : 'text-text-secondary group-hover:text-text'}`}>
            {config.name}
        </span>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
            }}
            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 ${isFavorite ? 'opacity-100 text-text-warning' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
            <Star size={12} className={isFavorite ? 'fill-text-warning' : ''} />
        </button>
    </div>
);
