/**
 * News Tile - Real-time news feed
 */

import { useState } from 'react';
import { ExternalLink, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../../ui/utils';

interface TileProps {
    tileId: string;
    onClose: () => void;
    onMaximize: () => void;
    isMaximized: boolean;
}

type Sentiment = 'bullish' | 'bearish' | 'neutral';

interface NewsItem {
    id: string;
    headline: string;
    source: string;
    time: string;
    symbols: string[];
    sentiment: Sentiment;
}

const MOCK_NEWS: NewsItem[] = [
    { id: '1', headline: 'Apple Reports Record Q4 Earnings, Beats Expectations', source: 'Reuters', time: '2m ago', symbols: ['AAPL'], sentiment: 'bullish' },
    { id: '2', headline: 'Fed Signals Potential Rate Cuts in 2024', source: 'Bloomberg', time: '15m ago', symbols: ['SPY', 'QQQ'], sentiment: 'bullish' },
    { id: '3', headline: 'NVIDIA Faces Supply Chain Challenges for AI Chips', source: 'WSJ', time: '32m ago', symbols: ['NVDA'], sentiment: 'bearish' },
    { id: '4', headline: 'Tesla Announces Price Cuts in Europe Amid Competition', source: 'CNBC', time: '1h ago', symbols: ['TSLA'], sentiment: 'bearish' },
    { id: '5', headline: 'Microsoft Azure Growth Accelerates in Cloud Market', source: 'TechCrunch', time: '2h ago', symbols: ['MSFT'], sentiment: 'bullish' },
    { id: '6', headline: 'Meta Expands AI Features Across Platforms', source: 'Verge', time: '3h ago', symbols: ['META'], sentiment: 'neutral' },
];

const sentimentIcons: Record<Sentiment, React.ReactNode> = {
    bullish: <TrendingUp size={14} className="text-green-500" />,
    bearish: <TrendingDown size={14} className="text-red-500" />,
    neutral: <Minus size={14} className="text-text-muted" />,
};

export function NewsTile({ tileId: _tileId, isMaximized: _isMaximized }: TileProps) {
    const [news] = useState<NewsItem[]>(MOCK_NEWS);
    const [filter, setFilter] = useState<'all' | Sentiment>('all');

    const filteredNews = news.filter(item => 
        filter === 'all' || item.sentiment === filter
    );

    return (
        <div className="h-full flex flex-col">
            {/* Filter */}
            <div className="flex gap-2 p-2 border-b border-border overflow-x-auto">
                {(['all', 'bullish', 'bearish', 'neutral'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-2 py-1 rounded text-xs capitalize whitespace-nowrap",
                            filter === f
                                ? "bg-brand text-white"
                                : "bg-element-bg text-text-secondary hover:text-text"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* News List */}
            <div className="flex-1 overflow-y-auto">
                {filteredNews.map(item => (
                    <div
                        key={item.id}
                        className="p-3 hover:bg-element-bg cursor-pointer border-b border-border/50 group"
                    >
                        <div className="flex items-start gap-2">
                            {sentimentIcons[item.sentiment]}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-text font-medium line-clamp-2 group-hover:text-brand">
                                    {item.headline}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-text-muted">{item.source}</span>
                                    <span className="text-xs text-text-muted flex items-center gap-1">
                                        <Clock size={10} />
                                        {item.time}
                                    </span>
                                    <div className="flex gap-1">
                                        {item.symbols.map(sym => (
                                            <span key={sym} className="text-xs bg-element-bg px-1.5 py-0.5 rounded text-brand">
                                                {sym}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <ExternalLink size={14} className="text-text-muted opacity-0 group-hover:opacity-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
