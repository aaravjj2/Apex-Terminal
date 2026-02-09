import { useMemo, useEffect } from 'react';
import { cn } from '../../../ui/utils';
import { useOptionsStore } from '../../options/store';
import { useAppStore } from '../../../state/appStore';
import type { OptionContract } from '../../options/types';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

export function OptionChainTile({ }: TileProps) {
    const { symbol: appSymbol } = useAppStore();
    const {
        chain,
        chainLoading,
        selectedExpiration,
        setSelectedExpiration,
        fetchAll
    } = useOptionsStore();

    // Sync with app symbol
    useEffect(() => {
        if (appSymbol) {
            fetchAll(appSymbol);
        }
    }, [appSymbol, fetchAll]);

    const chainData = useMemo(() => {
        if (!chain || !chain.contracts) return [];

        // Group contracts by strike
        const strikesMap = new Map<number, { strike: number; call?: OptionContract; put?: OptionContract }>();
        const contracts = chain.contracts.filter(c => c.expiration === selectedExpiration);

        contracts.forEach(contract => {
            const strike = contract.strike;
            if (!strikesMap.has(strike)) {
                strikesMap.set(strike, { strike });
            }
            const entry = strikesMap.get(strike)!;
            if (contract.optionType === 'call') {
                entry.call = contract;
            } else {
                entry.put = contract;
            }
        });

        // Return ATM +/- 10 strikes for better visibility in tile
        const underlying = chain.underlyingPrice;
        return Array.from(strikesMap.values())
            .sort((a, b) => a.strike - b.strike)
            .filter(a => Math.abs(a.strike - underlying) < underlying * 0.15);
    }, [chain, selectedExpiration]);

    if (chainLoading && chainData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-text-muted text-xs">
                Loading options...
            </div>
        );
    }

    if (!appSymbol) {
        return (
            <div className="h-full flex items-center justify-center text-text-muted text-xs">
                Select a symbol to view options
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col text-xs bg-background overflow-hidden">
            {/* Expiry selector */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-panel-bg/50">
                <span className="text-xxs text-text-secondary uppercase font-bold">Expiry:</span>
                <select
                    value={selectedExpiration || ''}
                    onChange={(e) => setSelectedExpiration(e.target.value)}
                    className="bg-element-bg text-text rounded px-2 py-0.5 border border-border text-xs focus:outline-none"
                    disabled={!chain}
                >
                    {chain?.expirations.map(exp => (
                        <option key={exp} value={exp}>{exp}</option>
                    ))}
                </select>
                <div className="ml-auto text-xxs font-mono">
                    <span className="text-text-secondary">{appSymbol}</span>
                    <span className="text-text ml-1 px-1 bg-brand/10 rounded">${chain?.underlyingPrice?.toFixed(2) || '0.00'}</span>
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-9 gap-1 px-2 py-1 text-xxs text-text-secondary border-b border-border bg-element-bg/30 font-bold uppercase tracking-tighter">
                <div className="text-center">Bid</div>
                <div className="text-center">Ask</div>
                <div className="text-center">Vol</div>
                <div className="text-center">IV</div>
                <div className="text-center font-bold text-text bg-brand/5 border-x border-brand/10">Strike</div>
                <div className="text-center">IV</div>
                <div className="text-center">Vol</div>
                <div className="text-center">Bid</div>
                <div className="text-center">Ask</div>
            </div>

            {/* Chain */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {chainData.length === 0 ? (
                    <div className="py-8 text-center text-text-muted opacity-50">No data found</div>
                ) : (
                    chainData.map((row) => {
                        const call = row.call;
                        const put = row.put;
                        const underlying = chain?.underlyingPrice || 0;
                        const isITMCall = row.strike < underlying;
                        const isITMPut = row.strike > underlying;
                        const isATM = Math.abs(row.strike - underlying) < (underlying * 0.01);

                        return (
                            <div
                                key={row.strike}
                                className={cn(
                                    "grid grid-cols-9 gap-1 px-2 py-1.5 border-b border-border/30 hover:bg-element-bg/50 transition-colors",
                                    isATM && "bg-brand/5 shadow-inner"
                                )}
                            >
                                {/* Calls */}
                                <div className={cn("text-right font-mono", isITMCall ? "text-green-500 font-bold" : "text-text-secondary")}>
                                    {call?.bid?.toFixed(2) || '-'}
                                </div>
                                <div className={cn("text-right font-mono", isITMCall ? "text-green-400" : "text-text-secondary")}>
                                    {call?.ask?.toFixed(2) || '-'}
                                </div>
                                <div className="text-center text-xxs text-text-muted tabular-nums">{call?.volume || '0'}</div>
                                <div className="text-center text-xxs text-text-muted">
                                    {call?.impliedVolatility ? (call.impliedVolatility * 100).toFixed(0) + '%' : '-'}
                                </div>

                                {/* Strike */}
                                <div className={cn(
                                    "text-center font-bold border-x border-border/20 bg-brand/5 tabular-nums",
                                    isATM ? "text-brand" : "text-text"
                                )}>
                                    {row.strike.toFixed(1)}
                                </div>

                                {/* Puts */}
                                <div className="text-center text-xxs text-text-muted">
                                    {put?.impliedVolatility ? (put.impliedVolatility * 100).toFixed(0) + '%' : '-'}
                                </div>
                                <div className="text-center text-xxs text-text-muted tabular-nums">{put?.volume || '0'}</div>
                                <div className={cn("text-right font-mono", isITMPut ? "text-red-400" : "text-text-secondary")}>
                                    {put?.bid?.toFixed(2) || '-'}
                                </div>
                                <div className={cn("text-right font-mono", isITMPut ? "text-red-500 font-bold" : "text-text-secondary")}>
                                    {put?.ask?.toFixed(2) || '-'}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
