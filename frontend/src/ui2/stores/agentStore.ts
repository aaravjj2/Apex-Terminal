/**
 * AI Agent Store (v1.71-v1.72)
 * Tool registry, invoke/execute, citations, conversation log.
 * Deterministic — StubProvider mode only.
 */

// ── Types ──────────────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  category: string;
}

export interface ToolCall {
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  duration_ms: number;
}

export interface Citation {
  source: string;
  entity_type: string;
  entity_id: string;
  snippet: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: ToolCall[];
  citations: Citation[];
  timestamp: string;
  provider: string;
}

// ── Deterministic hash ────────────────────────────────────────

function fnvHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── Built-in tools ────────────────────────────────────────────

const TOOLS: AgentTool[] = [
  { name: 'generate_report', description: 'Generate a formatted report from data', category: 'utility' },
  { name: 'classify_incident', description: 'Classify a risk or market incident', category: 'analysis' },
  { name: 'update_watchlist', description: 'Add/remove symbols from watchlist', category: 'data' },
  { name: 'run_backtest', description: 'Execute a backtest on a strategy', category: 'execution' },
  { name: 'create_order_ticket', description: 'Create a new order ticket', category: 'trading' },
  { name: 'execute_autopilot_run', description: 'Trigger an Autopilot 2.0 pipeline run', category: 'execution' },
  { name: 'search', description: 'Search entities across the platform', category: 'data' },
  { name: 'fetch_artifact', description: 'Retrieve a stored artifact by ID', category: 'data' },
  { name: 'summarize_run', description: 'Summarize a run or backtest result', category: 'analysis' },
  { name: 'run_workflow', description: 'Execute a workflow by ID', category: 'execution' },
];

// ── Stub responses ────────────────────────────────────────────

function stubInvoke(prompt: string): { content: string; toolCalls: ToolCall[]; citations: Citation[] } {
  const lower = prompt.toLowerCase();

  if (lower.includes('risk') || lower.includes('report')) {
    return {
      content: 'I\'ve generated a risk report for your portfolio. The current VaR (95%) is $12,450 with a maximum drawdown of 3.2%. All positions are within risk limits.',
      toolCalls: [
        { tool_name: 'generate_report', args: { type: 'risk', period: 'daily' }, result: { var_95: 12450, max_drawdown: 0.032, positions_in_limit: true }, duration_ms: 85 },
      ],
      citations: [
        { source: 'Risk Engine', entity_type: 'risk_run', entity_id: 'rr-local-1', snippet: 'VaR 95% = $12,450' },
      ],
    };
  }

  if (lower.includes('backtest') || lower.includes('strategy')) {
    return {
      content: 'Backtest complete for VWAP Mean Reversion strategy. Sharpe ratio: 1.82, win rate: 64.3%, max drawdown: -8.5%. The strategy shows consistent performance across market regimes.',
      toolCalls: [
        { tool_name: 'run_backtest', args: { strategy: 'vwap_mean_reversion', period: '6m' }, result: { sharpe: 1.82, win_rate: 0.643, max_dd: -0.085 }, duration_ms: 230 },
        { tool_name: 'summarize_run', args: { run_id: 'bt-local-1' }, result: { summary: 'Consistent alpha generation' }, duration_ms: 45 },
      ],
      citations: [
        { source: 'Backtest Engine', entity_type: 'backtest', entity_id: 'bt-local-1', snippet: 'Sharpe: 1.82, Win Rate: 64.3%' },
      ],
    };
  }

  if (lower.includes('spy') || lower.includes('order') || lower.includes('buy') || lower.includes('sell')) {
    return {
      content: 'Order ticket created for SPY. Limit buy 50 shares at $547.23. The order has been queued pending autopilot approval.',
      toolCalls: [
        { tool_name: 'create_order_ticket', args: { symbol: 'SPY', side: 'buy', qty: 50, price: 547.23 }, result: { ticket_id: 'OT-local-1', status: 'queued' }, duration_ms: 32 },
      ],
      citations: [],
    };
  }

  if (lower.includes('search') || lower.includes('find')) {
    return {
      content: 'Found 3 matching entities in the platform. Top results include portfolio positions, strategies, and recent trades.',
      toolCalls: [
        { tool_name: 'search', args: { query: prompt.slice(0, 50) }, result: { count: 3, top: ['Portfolio Alpha', 'VWAP Strategy', 'SPY Trade'] }, duration_ms: 18 },
      ],
      citations: [
        { source: 'Search Index', entity_type: 'search_result', entity_id: 'sr-1', snippet: 'Portfolio Alpha, VWAP Strategy, SPY Trade' },
      ],
    };
  }

  // Default
  return {
    content: 'I can help you with risk analysis, backtesting, order management, and platform search. What would you like me to do?',
    toolCalls: [],
    citations: [],
  };
}

// ── Store ──────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(fn => fn()); }

let messages: AgentMessage[] = [];
let isProcessing = false;

export const agentStore = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getMessages: () => messages,
  getIsProcessing: () => isProcessing,
  getTools: () => TOOLS,

  invoke(prompt: string) {
    const userMsg: AgentMessage = {
      id: `msg-${fnvHash(prompt + String(messages.length))}`,
      role: 'user', content: prompt,
      tool_calls: [], citations: [],
      timestamp: new Date(Date.now()).toISOString(), provider: 'local',
    };

    const { content, toolCalls, citations } = stubInvoke(prompt);
    const assistantMsg: AgentMessage = {
      id: `msg-${fnvHash(content + String(messages.length))}`,
      role: 'assistant', content,
      tool_calls: toolCalls, citations,
      timestamp: new Date(Date.now()).toISOString(), provider: 'local',
    };

    messages = [...messages, userMsg, assistantMsg];
    notify();
    return assistantMsg;
  },

  callTool(toolName: string, args: Record<string, unknown>) {
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool) return null;
    const result = { status: 'ok', tool: toolName, args, output: `Demo result for ${toolName}` };
    return result;
  },

  clear() { messages = []; notify(); },
  reset() { messages = []; isProcessing = false; notify(); },
};
