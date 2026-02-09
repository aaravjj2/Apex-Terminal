import { useState, useEffect } from 'react';
import { Package, Download, Trash2, Shield, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface InstalledPackage {
    name: string;
    version: string;
    type: string;
    description: string;
    author: string;
    capabilities: string[];
    enabled: boolean;
    installed_at: string;
}

export function PackageManager() {
    const [packages, setPackages] = useState<InstalledPackage[]>([]);
    const [loading, setLoading] = useState(false);
    const [showInstall, setShowInstall] = useState(false);
    const [installCode, setInstallCode] = useState('');
    const [installManifest, setInstallManifest] = useState(`{
  "name": "my-strategy",
  "version": "1.0.0",
  "description": "A custom trading strategy",
  "author": "user",
  "type": "strategy",
  "capabilities": ["read_bars"]
}`);

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/packages`);
            if (res.ok) {
                const data = await res.json();
                setPackages(data);
            }
        } catch (e) {
            console.error('Failed to fetch packages:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        try {
            const manifest = JSON.parse(installManifest);
            const res = await fetch(`${API_BASE}/packages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manifest, code: installCode })
            });

            if (res.ok) {
                setShowInstall(false);
                setInstallCode('');
                fetchPackages();
            } else {
                const error = await res.json();
                alert(`Install failed: ${error.detail}`);
            }
        } catch (e) {
            alert(`Invalid manifest JSON: ${e}`);
        }
    };

    const handleUninstall = async (name: string) => {
        if (!confirm(`Uninstall ${name}?`)) return;

        try {
            await fetch(`${API_BASE}/packages/${name}`, { method: 'DELETE' });
            fetchPackages();
        } catch (e) {
            console.error('Uninstall failed:', e);
        }
    };

    const handleToggle = async (name: string, enabled: boolean) => {
        try {
            await fetch(`${API_BASE}/packages/${name}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' });
            fetchPackages();
        } catch (e) {
            console.error('Toggle failed:', e);
        }
    };

    const isDangerous = (caps: string[]) => {
        return caps.some(c => ['place_orders', 'access_network', 'write_files'].includes(c));
    };

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-12 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <div className="flex items-center gap-2">
                    <Package size={18} className="text-[#2962ff]" />
                    <span className="text-sm font-bold text-[#d1d4dc]">Package Manager</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchPackages} className="p-1 hover:bg-[#2a2e39] rounded">
                        <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowInstall(!showInstall)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs rounded"
                    >
                        <Download size={12} />
                        Install
                    </button>
                </div>
            </div>

            {/* Install Form */}
            {showInstall && (
                <div className="p-4 border-b border-[#2a2e39] bg-[#1e222d] space-y-3">
                    <div>
                        <label className="text-xs text-[#787b86] block mb-1">Manifest (JSON)</label>
                        <textarea
                            value={installManifest}
                            onChange={(e) => setInstallManifest(e.target.value)}
                            className="w-full h-32 bg-[#131722] text-[#d1d4dc] p-2 font-mono text-xs rounded border border-[#2a2e39] resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-[#787b86] block mb-1">Code</label>
                        <textarea
                            value={installCode}
                            onChange={(e) => setInstallCode(e.target.value)}
                            placeholder="# Your strategy/indicator code here..."
                            className="w-full h-24 bg-[#131722] text-[#d1d4dc] p-2 font-mono text-xs rounded border border-[#2a2e39] resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowInstall(false)} className="px-3 py-1.5 text-xs text-[#787b86] hover:text-white">
                            Cancel
                        </button>
                        <button onClick={handleInstall} className="px-3 py-1.5 bg-[#089981] text-white text-xs rounded">
                            Install Package
                        </button>
                    </div>
                </div>
            )}

            {/* Packages List */}
            <div className="flex-1 overflow-auto p-4 space-y-2">
                {packages.length === 0 ? (
                    <div className="text-center text-[#787b86] py-12">
                        No packages installed. Click "Install" to add one.
                    </div>
                ) : (
                    packages.map((pkg) => (
                        <div key={pkg.name} className={`bg-[#1e222d] border rounded p-3 ${pkg.enabled ? 'border-[#2a2e39]' : 'border-[#2a2e39]/50 opacity-60'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[#d1d4dc]">{pkg.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-[#2a2e39] text-[#787b86] rounded">v{pkg.version}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${pkg.type === 'strategy' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {pkg.type}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[#787b86] mt-1">{pkg.description}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Shield size={12} className="text-[#787b86]" />
                                        <div className="flex gap-1">
                                            {pkg.capabilities.map(cap => (
                                                <span
                                                    key={cap}
                                                    className={`text-[10px] px-1 py-0.5 rounded ${isDangerous([cap]) ? 'bg-red-500/20 text-red-400' : 'bg-[#2a2e39] text-[#787b86]'}`}
                                                >
                                                    {cap}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(pkg.name, pkg.enabled)}
                                        className="p-1 hover:bg-[#2a2e39] rounded"
                                    >
                                        {pkg.enabled ? <ToggleRight size={18} className="text-[#089981]" /> : <ToggleLeft size={18} className="text-[#787b86]" />}
                                    </button>
                                    <button
                                        onClick={() => handleUninstall(pkg.name)}
                                        className="p-1 hover:bg-[#2a2e39] rounded text-[#787b86] hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
