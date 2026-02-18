import { Command } from 'cmdk';
import { useState, useEffect } from 'react';
import { Search, LayoutDashboard, History, Layers, Bell, FileText, Settings, Play, Pause, ChevronRight } from 'lucide-react';

import { useAppStore } from '../../../state/appStore';
import { disambiguate } from '../../ticker/disambiguator';
import { TickerDisambiguationDialog } from '../../ticker/TickerDisambiguationDialog';
import type { AmbiguousEntry } from '../../ticker/disambiguator';

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const { setSymbol } = useAppStore();
    const [disambigDialog, setDisambigDialog] = useState<{
        open: boolean; symbol: string; entry: AmbiguousEntry;
    }>({ open: false, symbol: '', entry: { company: '', confusion: '' } });

    const handleSymbolSelect = () => {
        const result = disambiguate(search);
        if (result.isAmbiguous && result.entry) {
            setDisambigDialog({ open: true, symbol: result.symbol, entry: result.entry });
        } else if (result.symbol) {
            setSymbol(result.symbol);
            onOpenChange(false);
            setSearch('');
        }
    };

    // Close on Escape
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onOpenChange(false);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [onOpenChange]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[20vh]" onClick={() => onOpenChange(false)} data-testid="command-palette-backdrop">
            <div className="w-[560px] bg-panel-bg border border-border rounded-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} data-testid="command-palette">
                <Command className="flex flex-col">
                    <div className="flex items-center border-b border-border px-3">
                        <Search size={16} className="text-text-secondary mr-2" />
                        <Command.Input
                            value={search}
                            onValueChange={setSearch}
                            placeholder="Type a command or search..."
                            className="flex-1 h-12 bg-transparent text-text text-sm outline-none placeholder:text-text-secondary/50"
                            data-testid="command-palette-input"
                        />
                        <kbd className="text-[10px] text-text-secondary bg-element-bg px-1.5 py-0.5 rounded border border-border">esc</kbd>
                    </div>

                    <Command.List className="max-h-[300px] overflow-y-auto p-2">
                        <Command.Empty className="py-6 text-center text-sm text-text-secondary">
                            No results found.
                        </Command.Empty>

                        {search.length > 0 && /^[A-Z]{1,5}$/i.test(search) && (
                            <Command.Group heading="Symbols" className="text-[10px] text-text-secondary uppercase tracking-wider px-2 py-1">
                                <Command.Item
                                    className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer text-text hover:bg-element-bg data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand"
                                    onSelect={handleSymbolSelect}
                                >
                                    <Search size={14} />
                                    <span className="flex-1 text-sm text-left">Switch to <strong>{search.toUpperCase()}</strong></span>
                                    <kbd className="text-[10px] text-text-secondary bg-element-bg px-1.5 py-0.5 rounded border border-border">↵</kbd>
                                </Command.Item>
                            </Command.Group>
                        )}

                        <Command.Group heading="Navigation" className="text-[10px] text-text-secondary uppercase tracking-wider px-2 py-1">
                            <CommandItem icon={<LayoutDashboard size={14} />} label="Go to Monitor" shortcut="⌘1" />
                            <CommandItem icon={<History size={14} />} label="Go to Replay" shortcut="⌘2" />
                            <CommandItem icon={<Layers size={14} />} label="Go to Strategies" shortcut="⌘3" />
                            <CommandItem icon={<Bell size={14} />} label="Go to Alerts" shortcut="⌘4" />
                            <CommandItem icon={<FileText size={14} />} label="Go to Reports" shortcut="⌘5" />
                            <CommandItem icon={<Settings size={14} />} label="Go to Settings" shortcut="⌘," />
                        </Command.Group>

                        <Command.Group heading="Actions" className="text-[10px] text-text-secondary uppercase tracking-wider px-2 py-1 mt-2">
                            <CommandItem icon={<Play size={14} />} label="Start Strategy" />
                            <CommandItem icon={<Pause size={14} />} label="Stop All Strategies" />
                        </Command.Group>
                    </Command.List>
                </Command>
            </div>
            <TickerDisambiguationDialog
                {...disambigDialog}
                onConfirm={(sym) => {
                    setDisambigDialog(d => ({ ...d, open: false }));
                    setSymbol(sym);
                    onOpenChange(false);
                    setSearch('');
                }}
                onCancel={() => setDisambigDialog(d => ({ ...d, open: false }))}
            />
        </div>
    );
}

function CommandItem({ icon, label, shortcut }: { icon: React.ReactNode; label: string; shortcut?: string }) {
    return (
        <Command.Item
            className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer text-text hover:bg-element-bg data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand"
        >
            <span className="text-text-secondary">{icon}</span>
            <span className="flex-1 text-sm">{label}</span>
            {shortcut && (
                <kbd className="text-[10px] text-text-secondary bg-element-bg px-1.5 py-0.5 rounded border border-border">{shortcut}</kbd>
            )}
            <ChevronRight size={12} className="text-text-secondary opacity-0 group-hover:opacity-100" />
        </Command.Item>
    );
}
