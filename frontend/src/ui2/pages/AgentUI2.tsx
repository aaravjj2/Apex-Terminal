/**
 * v1.72 — AgentUI2 Page
 * AI Agent panel with prompt input, conversation, tool calls, citations.
 * Uses data-testid for all interactive elements.
 */

import { useState, useSyncExternalStore, useRef, useEffect } from 'react';
import { PageHeader, Pill, StatusBadge, DataTable, type ColumnDef } from '../components';
import { agentStore, type AgentMessage, type ToolCall, type Citation } from '../stores/agentStore';

export function AgentUI2() {
  const messages = useSyncExternalStore(agentStore.subscribe, agentStore.getMessages);
  const tools = agentStore.getTools();
  const [input, setInput] = useState('');
  const [_pageReady, _setPageReady] = useState(false);
  useEffect(() => { _setPageReady(true); }, []);
  const [showTools, setShowTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt) return;
    setInput('');
    agentStore.invoke(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toolColumns: ColumnDef<Record<string, unknown>>[] = [
    { key: 'name', label: 'Name', width: '160px', render: (val: unknown) => (
      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ui2-accent)' }}>{val as string}</span>
    )},
    { key: 'category', label: 'Category', width: '100px', render: (val: unknown) => (
      <StatusBadge variant="info" testId="">{val as string}</StatusBadge>
    )},
    { key: 'description', label: 'Description' },
  ];

  const QUICK_PROMPTS = [
    'Generate a risk report for my portfolio',
    'Backtest the VWAP strategy',
    'Buy 50 SPY at market',
    'Search for recent trades',
  ];

  return (
    <>
    {!_pageReady && <div data-testid="page-loading" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    {_pageReady && <div data-testid="page-ready" style={{position:'fixed',top:0,right:0,opacity:0,pointerEvents:'none'}} />}
    <div data-testid="agent-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="AI Agent"
          subtitle="Intelligent assistant with tool execution"
          icon="🤖"
          badge={<Pill variant="info" size="xs">STUB</Pill>}
          testId="agent-header"
        />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '8px 16px 16px 16px', gap: '12px' }}>
        {/* Main conversation area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Message list */}
          <div ref={scrollRef} data-testid="agent-messages" style={{
            flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px',
            padding: '8px', background: 'var(--ui2-bg-panel)', borderRadius: 'var(--ui2-radius-md)',
            border: '1px solid var(--ui2-border)',
          }}>
            {messages.length === 0 && (
              <div data-testid="agent-empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>🤖</div>
                <div style={{ fontSize: '14px', color: 'var(--ui2-text-primary)', marginBottom: '8px' }}>
                  AI Agent Ready
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)', marginBottom: '16px' }}>
                  Ask me to analyze data, run backtests, manage orders, or search the platform.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button key={i} data-testid={`agent-quick-prompt-${i}`}
                      onClick={() => { setInput(qp); }}
                      style={{
                        padding: '6px 12px', fontSize: '11px', background: 'var(--ui2-bg-input)',
                        border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                        color: 'var(--ui2-text-secondary)', cursor: 'pointer',
                      }}
                    >{qp}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg: AgentMessage) => (
              <div key={msg.id} data-testid={`agent-msg-${msg.id}`} style={{
                padding: '10px 12px', borderRadius: 'var(--ui2-radius-md)',
                background: msg.role === 'user' ? 'rgba(59,130,246,0.08)' : 'var(--ui2-bg-input)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : 'var(--ui2-border)'}`,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: msg.role === 'user' ? 'var(--ui2-accent)' : 'var(--ui2-success)' }}>
                    {msg.role === 'user' ? 'You' : 'Agent'}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--ui2-text-muted)' }}>{msg.provider}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ui2-text-primary)', lineHeight: 1.5 }}>
                  {msg.content}
                </div>

                {/* Tool calls */}
                {msg.tool_calls.length > 0 && (
                  <div data-testid={`agent-tools-${msg.id}`} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ui2-text-muted)' }}>Tool Calls</div>
                    {msg.tool_calls.map((tc: ToolCall, i: number) => (
                      <div key={i} data-testid={`agent-tool-call-${msg.id}-${i}`} style={{
                        padding: '6px 8px', background: 'rgba(99,102,241,0.06)',
                        borderRadius: 'var(--ui2-radius-sm)', border: '1px solid rgba(99,102,241,0.15)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ui2-accent)' }}>{tc.tool_name}</span>
                          <span style={{ fontSize: '9px', color: 'var(--ui2-text-muted)' }}>{tc.duration_ms}ms</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--ui2-text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {JSON.stringify(tc.result)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Citations */}
                {msg.citations.length > 0 && (
                  <div data-testid={`agent-citations-${msg.id}`} style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {msg.citations.map((c: Citation, i: number) => (
                      <span key={i} data-testid={`agent-citation-${msg.id}-${i}`} style={{
                        padding: '2px 8px', fontSize: '10px', background: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px',
                        color: 'var(--ui2-success)',
                      }}>
                        📎 {c.source}: {c.snippet.slice(0, 40)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div data-testid="agent-input-bar" style={{
            display: 'flex', gap: '8px', marginTop: '8px',
          }}>
            <input
              data-testid="agent-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI agent..."
              style={{
                flex: 1, padding: '10px 14px', fontSize: '13px',
                background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)',
                borderRadius: 'var(--ui2-radius-md)', color: 'var(--ui2-text-primary)',
                outline: 'none',
              }}
            />
            <button data-testid="agent-send-btn" onClick={handleSend}
              style={{
                padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                background: 'var(--ui2-accent)', color: 'white', border: 'none',
                borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
              }}
            >Send</button>
            <button data-testid="agent-clear-btn" onClick={() => agentStore.clear()}
              style={{
                padding: '10px 14px', fontSize: '13px',
                background: 'var(--ui2-bg-input)', color: 'var(--ui2-text-secondary)',
                border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)', cursor: 'pointer',
              }}
            >Clear</button>
          </div>
        </div>

        {/* Right sidebar — tool registry */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <button data-testid="agent-tools-toggle" onClick={() => setShowTools(!showTools)}
            style={{
              padding: '8px 12px', fontSize: '12px', fontWeight: 600,
              background: showTools ? 'var(--ui2-accent)' : 'var(--ui2-bg-input)',
              color: showTools ? 'white' : 'var(--ui2-text-secondary)',
              border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)',
              cursor: 'pointer', marginBottom: '8px',
            }}
          >{showTools ? 'Hide Tools' : 'Show Tools'} ({tools.length})</button>

          {showTools && (
            <div data-testid="agent-tool-registry" style={{ flex: 1, overflow: 'auto' }}>
              <DataTable
                data={tools as any}
                columns={toolColumns}
                keyField="name"
                testId="agent-tools-table"
              />
            </div>
          )}

          {/* Stats */}
          <div data-testid="agent-stats" style={{
            marginTop: 'auto', padding: '10px 12px',
            background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
            borderRadius: 'var(--ui2-radius-md)',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--ui2-text-muted)', marginBottom: '4px' }}>Session Stats</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--ui2-text-secondary)' }}>Messages</span>
              <span data-testid="agent-msg-count" style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>{messages.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--ui2-text-secondary)' }}>Tool Calls</span>
              <span data-testid="agent-tool-count" style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>
                {messages.reduce((s, m) => s + m.tool_calls.length, 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--ui2-text-secondary)' }}>Provider</span>
              <span style={{ fontWeight: 600, color: 'var(--ui2-text-primary)' }}>stub</span>
            </div>
          </div>
        </div>
      </div>
      <div data-testid="agent-ready" style={{ display: 'none' }} />
    </div>
    </>
  );
}
