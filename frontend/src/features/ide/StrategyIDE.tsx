import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Save, History, ChevronDown, Settings, Zap, FlaskConical, X } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Version {
    id: number;
    strategy_id: string;
    version: number;
    content_hash: string;
    message: string;
    author: string;
    created_at: string;
}

interface StrategyIDEProps {
    strategyId?: string;
    onClose?: () => void;
}

export function StrategyIDE({ strategyId, onClose }: StrategyIDEProps) {
    const [code, setCode] = useState<string>(`# SMA Crossover Strategy
# Define your trading logic here

def on_bar(bar, portfolio, params):
    """Called on each new bar."""
    sma_fast = params.get('sma_fast', 10)
    sma_slow = params.get('sma_slow', 20)
    
    # Your strategy logic here
    if portfolio.sma(sma_fast) > portfolio.sma(sma_slow):
        return {'action': 'buy', 'size': 100}
    elif portfolio.sma(sma_fast) < portfolio.sma(sma_slow):
        return {'action': 'sell', 'size': 100}
    
    return None
`);
    const [strategyName, setStrategyName] = useState('My Strategy');
    const [versions, setVersions] = useState<Version[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [showVersions, setShowVersions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'paused'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [showParams, setShowParams] = useState(true);

    // Parameters
    const [params, setParams] = useState({
        sma_fast: 10,
        sma_slow: 20,
        stop_loss: 2.0,
        take_profit: 5.0,
    });

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const currentStrategyId = strategyId || 'new-strategy';

    useEffect(() => {
        if (strategyId) {
            fetchVersions();
        }
    }, [strategyId]);

    const fetchVersions = async () => {
        try {
            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions`);
            if (res.ok) {
                const data = await res.json();
                setVersions(data);
                if (data.length > 0 && !selectedVersion) {
                    // Load latest version
                    const latest = data[0];
                    const fullVersion = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions/${latest.version}`);
                    if (fullVersion.ok) {
                        const vData = await fullVersion.json();
                        const content = JSON.parse(vData.content);
                        setCode(content.code || code);
                        setStrategyName(content.name || strategyName);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch versions:', e);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const content = {
                name: strategyName,
                code: code,
                params: params,
                updated_at: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content,
                    message: `Saved at ${new Date().toLocaleTimeString()}`,
                    author: 'user'
                })
            });

            if (res.ok) {
                const newVersion = await res.json();
                setVersions(prev => [newVersion, ...prev]);
                addLog('info', `Saved as version ${newVersion.version}`);
            }
        } catch (e) {
            addLog('error', `Save failed: ${e}`);
        } finally {
            setSaving(false);
        }
    };

    const handleRun = async (mode: 'backtest' | 'paper') => {
        try {
            // Create run
            const res = await fetch(`${API_BASE}/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy_id: currentStrategyId,
                    run_type: mode,
                    config: { ...params, code: code }
                })
            });

            if (res.ok) {
                const { run_id } = await res.json();

                // Start run
                await fetch(`${API_BASE}/runs/${run_id}/start`, { method: 'POST' });
                setRunStatus('running');
                addLog('info', `Started ${mode} run: ${run_id}`);
            }
        } catch (e) {
            addLog('error', `Failed to start run: ${e}`);
        }
    };

    const handleStop = () => {
        setRunStatus('idle');
        addLog('info', 'Run stopped');
    };

    const handlePause = () => {
        setRunStatus(runStatus === 'paused' ? 'running' : 'paused');
        addLog('info', runStatus === 'paused' ? 'Resumed' : 'Paused');
    };

    const loadVersion = async (version: number) => {
        try {
            const res = await fetch(`${API_BASE}/strategies/${currentStrategyId}/versions/${version}`);
            if (res.ok) {
                const data = await res.json();
                const content = JSON.parse(data.content);
                setCode(content.code || '');
                setStrategyName(content.name || strategyName);
                setParams(content.params || params);
                setSelectedVersion(version);
                setShowVersions(false);
                addLog('info', `Loaded version ${version}`);
            }
        } catch (e) {
            addLog('error', `Failed to load version: ${e}`);
        }
    };

    const addLog = (level: string, message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-99), `[${timestamp}] [${level.toUpperCase()}] ${message}`]);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#131722] flex flex-col">
            {/* Header */}
            <div className="h-12 border-b border-[#2a2e39] flex items-center px-4 gap-4 bg-[#1e222d]">
                <input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    className="bg-transparent text-lg font-bold text-white border-none focus:outline-none focus:ring-1 focus:ring-[#2962ff] rounded px-2 py-1"
                />

                <div className="flex items-center gap-2 ml-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowVersions(!showVersions)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2e39] hover:bg-[#363a45] text-[#d1d4dc] text-xs rounded transition-colors"
                        >
                            <History size={14} />
                            v{selectedVersion || versions[0]?.version || 1}
                            <ChevronDown size={12} />
                        </button>

                        {showVersions && (
                            <div className="absolute top-full mt-1 left-0 w-64 bg-[#1e222d] border border-[#2a2e39] rounded shadow-xl z-50 max-h-64 overflow-y-auto">
                                {versions.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => loadVersion(v.version)}
                                        className={`w-full px-3 py-2 text-left text-xs hover:bg-[#2a2e39] ${selectedVersion === v.version ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'text-[#d1d4dc]'}`}
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-medium">v{v.version}</span>
                                            <span className="text-[#787b86]">{v.author}</span>
                                        </div>
                                        <div className="text-[#787b86] truncate">{v.message}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1" />

                {/* Run Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleRun('backtest')}
                        disabled={runStatus === 'running'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#089981] hover:bg-[#07836d] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                        <FlaskConical size={14} />
                        Backtest
                    </button>
                    <button
                        onClick={() => handleRun('paper')}
                        disabled={runStatus === 'running'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f7931a] hover:bg-[#e5850d] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                        <Zap size={14} />
                        Paper
                    </button>

                    {runStatus !== 'idle' && (
                        <>
                            <button onClick={handlePause} className="p-2 hover:bg-[#2a2e39] rounded">
                                {runStatus === 'paused' ? <Play size={16} className="text-green-400" /> : <Pause size={16} className="text-yellow-400" />}
                            </button>
                            <button onClick={handleStop} className="p-2 hover:bg-[#2a2e39] rounded">
                                <Square size={16} className="text-red-400" />
                            </button>
                        </>
                    )}
                </div>

                <div className="w-px h-6 bg-[#2a2e39] mx-2" />

                <button
                    onClick={() => setShowParams(!showParams)}
                    className={`p-2 rounded transition-colors ${showParams ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'hover:bg-[#2a2e39] text-[#787b86]'}`}
                >
                    <Settings size={16} />
                </button>

                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-[#2a2e39] rounded text-[#787b86] hover:text-white">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Code Editor */}
                <div className="flex-1 flex flex-col min-w-0">
                    <textarea
                        ref={editorRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        spellCheck={false}
                        className="flex-1 bg-[#131722] text-[#d1d4dc] p-4 font-mono text-sm resize-none focus:outline-none"
                        style={{ tabSize: 4 }}
                    />

                    {/* Logs Console */}
                    <div className="h-32 border-t border-[#2a2e39] bg-[#0d1117] overflow-y-auto">
                        <div className="px-3 py-1 border-b border-[#2a2e39] text-[10px] text-[#787b86] uppercase font-bold sticky top-0 bg-[#0d1117]">
                            Console
                        </div>
                        <div className="p-2 font-mono text-xs">
                            {logs.map((log, i) => (
                                <div key={i} className={`py-0.5 ${log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARNING]') ? 'text-yellow-400' : 'text-[#787b86]'}`}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Parameters Panel */}
                {showParams && (
                    <div className="w-72 border-l border-[#2a2e39] bg-[#1e222d] flex flex-col">
                        <div className="p-3 border-b border-[#2a2e39] text-xs font-bold text-[#787b86] uppercase">
                            Parameters
                        </div>
                        <div className="p-3 space-y-4 overflow-y-auto">
                            <ParamSlider label="SMA Fast" value={params.sma_fast} min={5} max={50} onChange={(v) => setParams({ ...params, sma_fast: v })} />
                            <ParamSlider label="SMA Slow" value={params.sma_slow} min={10} max={100} onChange={(v) => setParams({ ...params, sma_slow: v })} />
                            <ParamSlider label="Stop Loss %" value={params.stop_loss} min={0.5} max={10} step={0.5} onChange={(v) => setParams({ ...params, stop_loss: v })} />
                            <ParamSlider label="Take Profit %" value={params.take_profit} min={1} max={20} step={0.5} onChange={(v) => setParams({ ...params, take_profit: v })} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ParamSlider({ label, value, min, max, step = 1, onChange }: { label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-[#d1d4dc]">{label}</span>
                <span className="text-[#787b86] font-mono">{value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#2a2e39] rounded appearance-none cursor-pointer accent-[#2962ff]"
            />
        </div>
    );
}
