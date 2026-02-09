import { useState, useEffect } from 'react';
import { AlertTriangle, User, Wallet } from 'lucide-react';

interface AccountInfo {
    account_id: string;
    status: string;
    equity: number;
    buying_power: number;
    is_paper: boolean;
}

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export function TradingBanner() {
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [mode, setMode] = useState<'paper' | 'live'>('paper');

    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const res = await fetch(`${API_BASE}/account`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setAccount(data);
                setMode(data.is_paper ? 'paper' : 'live');
            } catch (e) {
                // Mock
                setAccount({
                    account_id: 'PA30UB1Y6NLQ',
                    status: 'ACTIVE',
                    equity: 102848.62,
                    buying_power: 205697.24,
                    is_paper: true,
                });
                setMode('paper');
            }
        };
        fetchAccount();
        const interval = setInterval(fetchAccount, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    const bannerColor = mode === 'paper'
        ? 'bg-yellow-600/90 border-yellow-500'
        : 'bg-red-600/90 border-red-500';

    const modeLabel = mode === 'paper' ? '📝 PAPER TRADING' : '🔴 LIVE TRADING';

    return (
        <div className={`fixed top-0 left-0 right-0 z-[90] h-6 ${bannerColor} border-b flex items-center justify-between px-4 text-xs font-medium text-white`}>
            <div className="flex items-center gap-4">
                <span className="font-bold">{modeLabel}</span>
                {mode === 'live' && (
                    <span className="flex items-center gap-1 text-red-200">
                        <AlertTriangle size={12} />
                        Real money at risk
                    </span>
                )}
            </div>

            {account && (
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-white/80">
                        <User size={12} />
                        {account.account_id}
                    </span>
                    <span className="flex items-center gap-1">
                        <Wallet size={12} />
                        {formatCurrency(account.equity)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${account.status === 'ACTIVE' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                        {account.status}
                    </span>
                </div>
            )}
        </div>
    );
}
