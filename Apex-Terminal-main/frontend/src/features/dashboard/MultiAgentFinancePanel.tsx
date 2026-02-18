/**
 * Multi-Agent Finance Analysis Component
 * 
 * Inspired by:
 * - AI Finance Agent Team (YFinance + DuckDuckGo + SQLite)
 * - AI Investment Agent (stock comparison, analyst recommendations)
 * - xAI Finance Agent (real-time stock data, formatted tables)
 * 
 * Features:
 * - Multiple specialized AI agents working together
 * - Real-time financial data integration
 * - Analyst recommendations display
 * - News sentiment analysis
 * - Stock comparison tools
 */

import { useState, useCallback } from 'react';
import {
    Bot, Brain, Globe, Radio, Zap, Search, TrendingUp, TrendingDown,
    BarChart2, FileText, Target, AlertTriangle, CheckCircle2,
    Send, Loader2
} from 'lucide-react';
import { cn } from '../../ui/utils';
import { Badge } from '../../ui/Badge';

// Types

interface StockAnalysis {
    symbol: string;
    price: number;
    change: number;
    change_pct: number;
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    target_price: number;
    analyst_count: number;
    news_sentiment: number;
    technical_score: number;
    fundamental_score: number;
}

interface NewsItem {
    title: string;
    source: string;
    published: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    url: string;
}

interface AgentTask {
    id: string;
    agent: string;
    task: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    result?: string;
    startTime?: number;
    endTime?: number;
}

// Format helpers
const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// Agent definitions inspired by awesome-llm-apps patterns
const AGENTS = [
    {
        id: 'market-analyst',
        name: 'Market Analyst',
        description: 'Analyzes market conditions, trends, and sector performance',
        icon: Globe,
        color: 'text-blue-400'
    },
    {
        id: 'stock-researcher',
        name: 'Stock Researcher',
        description: 'Deep dives into company fundamentals and technicals',
        icon: Search,
        color: 'text-purple-400'
    },
    {
        id: 'sentiment-analyzer',
        name: 'Sentiment Agent',
        description: 'Analyzes news and social sentiment for trading signals',
        icon: Radio,
        color: 'text-green-400'
    },
    {
        id: 'risk-assessor',
        name: 'Risk Assessor',
        description: 'Evaluates position and portfolio risk levels',
        icon: Target,
        color: 'text-orange-400'
    }
];

// Recommendation Badge Component
function RecommendationBadge({ rec }: { rec: string }) {
    const colors: Record<string, string> = {
        strong_buy: 'bg-up text-white',
        buy: 'bg-up/20 text-up border border-up',
        hold: 'bg-warn/20 text-warn border border-warn',
        sell: 'bg-down/20 text-down border border-down',
        strong_sell: 'bg-down text-white'
    };

    const labels: Record<string, string> = {
        strong_buy: 'STRONG BUY',
        buy: 'BUY',
        hold: 'HOLD',
        sell: 'SELL',
        strong_sell: 'STRONG SELL'
    };

    return (
        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", colors[rec] || 'bg-border text-text-secondary')}>
            {labels[rec] || rec}
        </span>
    );
}

// Stock Analysis Card
function StockAnalysisCard({ analysis }: { analysis: StockAnalysis }) {
    const isPositive = analysis.change >= 0;

    return (
        <div className="bg-element-bg rounded-lg border border-border p-4 hover:border-brand/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-text">{analysis.symbol}</span>
                        <RecommendationBadge rec={analysis.recommendation} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-semibold text-text tabular-nums">
                            {formatCurrency(analysis.price)}
                        </span>
                        <span className={cn("text-sm tabular-nums flex items-center gap-1", isPositive ? "text-up" : "text-down")}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {formatPercent(analysis.change_pct)}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-text-secondary uppercase">Target</div>
                    <div className="text-sm font-semibold text-brand">{formatCurrency(analysis.target_price)}</div>
                    <div className="text-[10px] text-text-muted">{analysis.analyst_count} analysts</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                    <div className="text-[10px] text-text-secondary mb-1">Technical</div>
                    <ScoreBar score={analysis.technical_score} />
                </div>
                <div className="text-center">
                    <div className="text-[10px] text-text-secondary mb-1">Fundamental</div>
                    <ScoreBar score={analysis.fundamental_score} />
                </div>
                <div className="text-center">
                    <div className="text-[10px] text-text-secondary mb-1">Sentiment</div>
                    <ScoreBar score={(analysis.news_sentiment + 1) / 2} />
                </div>
            </div>
        </div>
    );
}

// Score Bar Component
function ScoreBar({ score }: { score: number }) {
    const percentage = Math.max(0, Math.min(100, score * 100));
    const color = score >= 0.7 ? 'bg-up' : score >= 0.4 ? 'bg-warn' : 'bg-down';

    return (
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${percentage}%` }} />
        </div>
    );
}

// News Item Card
function NewsItemCard({ news }: { news: NewsItem }) {
    const sentimentColors = {
        positive: 'text-up',
        neutral: 'text-text-secondary',
        negative: 'text-down'
    };

    return (
        <div className="p-3 hover:bg-element-bg rounded-lg transition-colors">
            <div className="flex items-start gap-3">
                <div className={cn("mt-1", sentimentColors[news.sentiment])}>
                    {news.sentiment === 'positive' ? <TrendingUp size={14} /> :
                     news.sentiment === 'negative' ? <TrendingDown size={14} /> :
                     <BarChart2 size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                    <a href={news.url} target="_blank" rel="noopener noreferrer" 
                       className="text-sm text-text hover:text-brand transition-colors line-clamp-2">
                        {news.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                        <span>{news.source}</span>
                        <span>•</span>
                        <span>{news.published}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Agent Task Status
function AgentTaskRow({ task }: { task: AgentTask }) {
    const agent = AGENTS.find(a => a.id === task.agent);
    const Icon = agent?.icon || Bot;

    return (
        <div className="flex items-center gap-3 p-3 bg-element-bg rounded-lg">
            <div className={cn("p-2 rounded-lg bg-border", agent?.color)}>
                <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text">{task.task}</div>
                <div className="text-[10px] text-text-secondary">{agent?.name}</div>
            </div>
            <div className="flex items-center gap-2">
                {task.status === 'running' && (
                    <Loader2 size={14} className="animate-spin text-brand" />
                )}
                {task.status === 'completed' && (
                    <CheckCircle2 size={14} className="text-up" />
                )}
                {task.status === 'error' && (
                    <AlertTriangle size={14} className="text-down" />
                )}
                <Badge
                    variant={task.status === 'completed' ? 'success' : 
                            task.status === 'running' ? 'info' : 
                            task.status === 'error' ? 'error' : 'default'}
                    size="sm"
                >
                    {task.status}
                </Badge>
            </div>
        </div>
    );
}

// Main Component
export function MultiAgentFinancePanel() {
    const [query, setQuery] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [analyses, setAnalyses] = useState<StockAnalysis[]>([]);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [agentResponse, setAgentResponse] = useState<string>('');

    // Simulate multi-agent analysis
    const runAnalysis = useCallback(async () => {
        if (!query.trim()) return;

        setIsAnalyzing(true);
        setAgentResponse('');
        setTasks([]);

        // Parse symbols from query
        const symbols = query.toUpperCase().match(/[A-Z]{1,5}/g) || ['AAPL'];

        // Create agent tasks
        const newTasks: AgentTask[] = [
            { id: '1', agent: 'market-analyst', task: 'Analyzing market conditions...', status: 'pending' },
            { id: '2', agent: 'stock-researcher', task: `Researching ${symbols.join(', ')}...`, status: 'pending' },
            { id: '3', agent: 'sentiment-analyzer', task: 'Scanning news & sentiment...', status: 'pending' },
            { id: '4', agent: 'risk-assessor', task: 'Evaluating risk factors...', status: 'pending' }
        ];

        setTasks(newTasks);

        // Simulate sequential agent execution
        for (let i = 0; i < newTasks.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));

            setTasks(prev => prev.map((t, idx) => 
                idx === i ? { ...t, status: 'running' } : t
            ));

            await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));

            setTasks(prev => prev.map((t, idx) => 
                idx === i ? { ...t, status: 'completed' } : 
                idx === i + 1 ? { ...t, status: 'running' } : t
            ));
        }

        // Generate mock analysis results
        const mockAnalyses: StockAnalysis[] = symbols.slice(0, 4).map(symbol => {
            const recommendations: StockAnalysis['recommendation'][] = ['strong_buy', 'buy', 'hold', 'sell'];
            return {
                symbol,
                price: 150 + Math.random() * 200,
                change: (Math.random() - 0.5) * 10,
                change_pct: (Math.random() - 0.5) * 5,
                recommendation: recommendations[Math.floor(Math.random() * 4)],
                target_price: 160 + Math.random() * 200,
                analyst_count: Math.floor(10 + Math.random() * 30),
                news_sentiment: (Math.random() - 0.5) * 2,
                technical_score: Math.random(),
                fundamental_score: Math.random()
            };
        });

        setAnalyses(mockAnalyses);

        // Generate mock news
        const mockNews: NewsItem[] = [
            {
                title: `${symbols[0]} Reports Strong Q4 Earnings, Beats Expectations`,
                source: 'MarketWatch',
                published: '2 hours ago',
                sentiment: 'positive',
                url: '#'
            },
            {
                title: `Analysts Upgrade ${symbols[0]} on Cloud Growth Momentum`,
                source: 'Bloomberg',
                published: '4 hours ago',
                sentiment: 'positive',
                url: '#'
            },
            {
                title: 'Tech Sector Faces Headwinds Amid Rate Concerns',
                source: 'Reuters',
                published: '6 hours ago',
                sentiment: 'negative',
                url: '#'
            },
            {
                title: 'Market Volatility Expected to Continue This Week',
                source: 'CNBC',
                published: '8 hours ago',
                sentiment: 'neutral',
                url: '#'
            }
        ];

        setNews(mockNews);

        // Generate agent summary response
        const positiveCount = mockAnalyses.filter(a => ['strong_buy', 'buy'].includes(a.recommendation)).length;
        setAgentResponse(`
**Analysis Complete** 🎯

Our multi-agent team has analyzed ${symbols.join(', ')}:

**Key Findings:**
- ${positiveCount} out of ${mockAnalyses.length} stocks have BUY or STRONG BUY ratings
- Average analyst target suggests ${((mockAnalyses.reduce((a, b) => a + (b.target_price / b.price - 1), 0) / mockAnalyses.length) * 100).toFixed(1)}% upside
- News sentiment is ${mockNews.filter(n => n.sentiment === 'positive').length > mockNews.filter(n => n.sentiment === 'negative').length ? 'predominantly positive' : 'mixed'}

**Top Pick:** ${mockAnalyses.sort((a, b) => (b.technical_score + b.fundamental_score) - (a.technical_score + a.fundamental_score))[0]?.symbol} shows the strongest combined technical and fundamental signals.

**Risk Note:** Current market volatility suggests using smaller position sizes and wider stops.
        `.trim());

        setIsAnalyzing(false);
    }, [query]);

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-panel-bg shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-semibold text-text">AI Finance Agent Team</h2>
                    </div>
                    <Badge variant="info" size="sm">
                        {AGENTS.length} Agents Ready
                    </Badge>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Panel - Query & Tasks */}
                <div className="w-1/3 border-r border-border flex flex-col">
                    {/* Query Input */}
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                                placeholder="Ask about any stock (e.g., 'Analyze AAPL vs GOOGL')"
                                className="w-full px-4 py-3 pr-12 bg-element-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-brand"
                            />
                            <button
                                onClick={runAnalysis}
                                disabled={isAnalyzing || !query.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-brand hover:bg-brand/90 text-white disabled:opacity-50 transition-colors"
                            >
                                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                        <div className="flex gap-2 mt-3">
                            {['AAPL', 'NVDA', 'GOOGL', 'SPY'].map(sym => (
                                <button
                                    key={sym}
                                    onClick={() => setQuery(`Analyze ${sym}`)}
                                    className="px-2 py-1 text-[10px] bg-element-bg hover:bg-border rounded text-text-secondary transition-colors"
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Agent Status */}
                    <div className="flex-1 overflow-auto p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Bot size={14} className="text-text-secondary" />
                            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Agent Tasks</span>
                        </div>

                        {tasks.length === 0 ? (
                            <div className="text-center py-8 text-text-muted text-sm">
                                Enter a query to start multi-agent analysis
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {tasks.map(task => (
                                    <AgentTaskRow key={task.id} task={task} />
                                ))}
                            </div>
                        )}

                        {/* Agent Response */}
                        {agentResponse && (
                            <div className="mt-4 p-4 bg-element-bg rounded-lg border border-border">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={14} className="text-brand" />
                                    <span className="text-xs font-semibold text-text">Team Summary</span>
                                </div>
                                <div className="text-sm text-text-secondary whitespace-pre-wrap">
                                    {agentResponse.split('**').map((part, i) => 
                                        i % 2 === 1 ? <strong key={i} className="text-text">{part}</strong> : part
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Results */}
                <div className="flex-1 overflow-auto p-4">
                    {analyses.length > 0 ? (
                        <>
                            {/* Stock Analysis Cards */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <BarChart2 size={14} className="text-text-secondary" />
                                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Stock Analysis</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {analyses.map(analysis => (
                                        <StockAnalysisCard key={analysis.symbol} analysis={analysis} />
                                    ))}
                                </div>
                            </div>

                            {/* News Feed */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={14} className="text-text-secondary" />
                                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Related News</span>
                                </div>
                                <div className="bg-panel-bg rounded-lg border border-border">
                                    {news.map((item, i) => (
                                        <NewsItemCard key={i} news={item} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <Brain size={48} className="text-border mb-4" />
                            <h3 className="text-lg font-semibold text-text mb-2">AI Finance Team Ready</h3>
                            <p className="text-sm text-text-secondary max-w-md">
                                Our multi-agent team combines market analysis, stock research, 
                                sentiment analysis, and risk assessment to give you comprehensive 
                                financial insights.
                            </p>
                            <div className="flex gap-4 mt-6">
                                {AGENTS.map(agent => (
                                    <div key={agent.id} className="flex flex-col items-center">
                                        <div className={cn("p-3 rounded-lg bg-element-bg border border-border", agent.color)}>
                                            <agent.icon size={20} />
                                        </div>
                                        <span className="text-[10px] text-text-muted mt-1">{agent.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MultiAgentFinancePanel;
