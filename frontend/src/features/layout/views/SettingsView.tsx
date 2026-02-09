import { useState } from 'react';
import {
    Key, RefreshCw, Eye, EyeOff,
    Palette, Keyboard
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { StatusIndicator, type ConnectionStatus } from '../../../ui/StatusIndicator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';

function ApiKeysSection() {
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

    const providers = [
        { id: 'finnhub', name: 'Finnhub', status: 'connected' as ConnectionStatus, hasKey: true },
        { id: 'alpaca', name: 'Alpaca', status: 'disconnected' as ConnectionStatus, hasKey: false },
        { id: 'yahoo', name: 'Yahoo Finance', status: 'connected' as ConnectionStatus, hasKey: true },
        { id: 'tiingo', name: 'Tiingo', status: 'disconnected' as ConnectionStatus, hasKey: false },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">API Keys</h2>
                <Button size="sm" variant="secondary" className="gap-1">
                    <Key size={14} /> Add Key
                </Button>
            </div>

            <div className="space-y-3">
                {providers.map(provider => (
                    <div
                        key={provider.id}
                        className="p-4 bg-element-bg rounded border border-border"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-text">{provider.name}</span>
                                <StatusIndicator status={provider.status} size="sm" />
                            </div>
                            <Button size="sm" variant="ghost" className="gap-1">
                                <RefreshCw size={12} /> Test
                            </Button>
                        </div>

                        {provider.hasKey ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type={showKeys[provider.id] ? 'text' : 'password'}
                                    value="sk_live_xxxxxxxxxxxxxxxxxxxx"
                                    readOnly
                                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono text-text-secondary"
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                >
                                    {showKeys[provider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </Button>
                            </div>
                        ) : (
                            <div className="text-xs text-text-secondary">
                                No API key configured. <button className="text-brand hover:underline">Add key</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function UiPreferencesSection() {
    const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');
    const [animations, setAnimations] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    return (
        <div className="space-y-6">
            <h2 className="text-sm font-semibold text-text">UI Preferences</h2>

            <div className="space-y-4">
                {/* Theme */}
                <div>
                    <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">Theme</label>
                    <div className="flex gap-2">
                        {(['dark', 'light'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                className={`px-4 py-2 text-sm rounded border transition-colors ${theme === t
                                    ? 'bg-brand/10 border-brand text-brand'
                                    : 'bg-element-bg border-border text-text-secondary hover:text-text'
                                    }`}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Density */}
                <div>
                    <label className="text-xs text-text-secondary uppercase tracking-wider block mb-2">Density</label>
                    <div className="flex gap-2">
                        {(['compact', 'normal', 'comfortable'] as const).map(d => (
                            <button
                                key={d}
                                onClick={() => setDensity(d)}
                                className={`px-4 py-2 text-sm rounded border transition-colors ${density === d
                                    ? 'bg-brand/10 border-brand text-brand'
                                    : 'bg-element-bg border-border text-text-secondary hover:text-text'
                                    }`}
                            >
                                {d.charAt(0).toUpperCase() + d.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Animations */}
                <div className="flex items-center justify-between p-4 bg-element-bg rounded">
                    <div>
                        <div className="text-sm text-text">Animations</div>
                        <div className="text-xs text-text-secondary">Enable UI animations and transitions</div>
                    </div>
                    <button
                        onClick={() => setAnimations(!animations)}
                        className={`w-12 h-6 rounded-full transition-colors ${animations ? 'bg-brand' : 'bg-border'
                            }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${animations ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function ShortcutsSection() {
    const shortcuts = [
        { key: '⌘ K', action: 'Command Palette' },
        { key: '⌘ 1-5', action: 'Switch Views' },
        { key: 'Space', action: 'Play/Pause Replay' },
        { key: '← / →', action: 'Step Bar' },
        { key: 'Esc', action: 'Close Overlays' },
        { key: '⌘ Z', action: 'Undo Drawing' },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-text">Keyboard Shortcuts</h2>

            <div className="space-y-2">
                {shortcuts.map((s, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-element-bg rounded"
                    >
                        <span className="text-sm text-text">{s.action}</span>
                        <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono text-text-secondary">
                            {s.key}
                        </kbd>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SettingsView() {
    return (
        <div className="h-full bg-background overflow-auto">
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-xl font-semibold text-text mb-6">Settings</h1>

                <Tabs defaultValue="keys" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="keys" icon={<Key size={14} />}>API Keys</TabsTrigger>
                        <TabsTrigger value="ui" icon={<Palette size={14} />}>UI Preferences</TabsTrigger>
                        <TabsTrigger value="shortcuts" icon={<Keyboard size={14} />}>Shortcuts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="keys">
                        <ApiKeysSection />
                    </TabsContent>

                    <TabsContent value="ui">
                        <UiPreferencesSection />
                    </TabsContent>

                    <TabsContent value="shortcuts">
                        <ShortcutsSection />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
