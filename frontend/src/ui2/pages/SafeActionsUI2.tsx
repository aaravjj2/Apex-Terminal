/**
 * Wave 107 — Safe Actions (Tickets) UI2
 * RBAC-gated ticket creation, ES-first search, audit trail view.
 * Route: /ui2/safe-actions
 */

import { useState, useEffect, useCallback } from 'react';
import { PageShellUI2, type PageStatus } from '../components';

const API = '/api/v3/tickets';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_by: string;
  role: string;
  created_at: number;
  updated_at: number;
}

interface AuditEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  actor: string;
  role: string;
  payload: Record<string, unknown>;
  created_at: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#16a34a',
  medium: '#d97706',
  high: '#dc2626',
  critical: '#7c3aed',
};

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || '#64748b';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
      fontWeight: 600, color: '#fff', background: color,
    }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'open' ? '#0ea5e9' : status === 'closed' ? '#64748b' : '#f59e0b';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
      fontWeight: 600, color: '#fff', background: color,
    }}>
      {status}
    </span>
  );
}

export function SafeActionsUI2() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [selected, setSelected]       = useState<Ticket | null>(null);
  const [auditLog, setAuditLog]       = useState<AuditEvent[]>([]);
  const [status, setStatus]           = useState<PageStatus>('loading');
  const [errorMsg, setErrorMsg]       = useState<string | undefined>();

  // Create form state
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', created_by: 'agent', role: 'agent',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const loadTickets = useCallback(async (q: string) => {
    setStatus('loading');
    setErrorMsg(undefined);
    try {
      const res = await fetch(`${API}/tickets/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      setTickets(data.hits || []);
      setStatus('ready');
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => { loadTickets(''); }, [loadTickets]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    loadTickets(searchQuery);
  }, [searchQuery, loadTickets]);

  const openAudit = useCallback(async (ticket: Ticket) => {
    setSelected(ticket);
    try {
      const res = await fetch(`${API}/tickets/${ticket.id}/audit`);
      if (!res.ok) throw new Error('Audit fetch failed');
      const data = await res.json();
      setAuditLog(data.events || []);
    } catch {
      setAuditLog([]);
    }
  }, []);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    try {
      const res = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.status === 403) {
        const err = await res.json();
        setCreateError(err.detail || 'Permission denied');
        return;
      }
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const ticket = await res.json();
      setCreateSuccess(`Ticket ${ticket.id.slice(0, 8)} created!`);
      setForm({ title: '', description: '', priority: 'medium', created_by: 'agent', role: 'agent' });
      loadTickets('');
    } catch (e) {
      setCreateError(String(e));
    }
  }, [form, loadTickets]);

  return (
    <PageShellUI2
      status={status}
      testId="safe-actions-page"
      errorMessage={errorMsg}
      emptyMessage="No tickets found."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 data-testid="safe-actions-title"
              style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
            Safe Actions — Tickets
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            RBAC-gated BP Audit Trail
          </span>
        </div>

        {/* Create ticket */}
        <div data-testid="create-ticket-panel"
             style={{ background: 'var(--ui2-bg-card)', border: '1px solid var(--ui2-border)',
               borderRadius: 'var(--ui2-radius)', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' }}>
            Create Ticket
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              data-testid="ticket-title-input"
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              aria-label="Ticket title"
              required
              style={{ padding: '8px 12px', background: 'var(--ui2-bg-input)',
                border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            />
            <input
              data-testid="ticket-description-input"
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              aria-label="Ticket description"
              style={{ padding: '8px 12px', background: 'var(--ui2-bg-input)',
                border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                data-testid="ticket-priority-select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                aria-label="Ticket priority"
                style={{ flex: 1, padding: '8px 12px', background: 'var(--ui2-bg-input)',
                  border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                  color: 'var(--ui2-text-primary)', fontSize: '13px' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select
                data-testid="ticket-role-select"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                aria-label="Ticket creator role"
                style={{ flex: 1, padding: '8px 12px', background: 'var(--ui2-bg-input)',
                  border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
                  color: 'var(--ui2-text-primary)', fontSize: '13px' }}
              >
                <option value="admin">admin</option>
                <option value="agent">agent</option>
                <option value="auditor">auditor</option>
                <option value="viewer">viewer (blocked)</option>
              </select>
            </div>
            {createError && (
              <div data-testid="create-ticket-error"
                   style={{ color: '#f87171', fontSize: '12px', padding: '6px 10px',
                     background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>
                {createError}
              </div>
            )}
            {createSuccess && (
              <div data-testid="create-ticket-success"
                   style={{ color: '#4ade80', fontSize: '12px', padding: '6px 10px',
                     background: 'rgba(74,222,128,0.1)', borderRadius: '4px' }}>
                {createSuccess}
              </div>
            )}
            <button
              type="submit"
              data-testid="create-ticket-btn"
              aria-label="Submit new ticket"
              style={{ padding: '8px 20px', background: 'var(--ui2-accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px', alignSelf: 'flex-start' }}
            >
              Create Ticket
            </button>
          </form>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            data-testid="ticket-search-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tickets (ES-first)..."
            aria-label="Search tickets"
            style={{ flex: 1, padding: '10px 14px', background: 'var(--ui2-bg-input)',
              border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)',
              color: 'var(--ui2-text-primary)', fontSize: '14px' }}
          />
          <button
            type="submit"
            data-testid="ticket-search-btn"
            aria-label="Run ticket search"
            style={{ padding: '10px 20px', background: 'var(--ui2-accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--ui2-radius-sm)', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px' }}
          >
            Search
          </button>
        </form>

        {/* Results + Audit */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Ticket list */}
          <div data-testid="tickets-list"
               style={{ flex: 1, background: 'var(--ui2-bg-card)',
                 border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius)',
                 overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)',
                          fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              Tickets ({tickets.length})
            </div>
            {tickets.length === 0 ? (
              <div data-testid="tickets-empty"
                   style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No tickets. Create one above.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {tickets.map((t) => (
                  <li
                    key={t.id}
                    data-testid={`ticket-row-${t.id}`}
                    onClick={() => openAudit(t)}
                    style={{ padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--ui2-border)',
                      background: selected?.id === t.id ? 'var(--ui2-bg-hover)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <span style={{ flex: 1, fontSize: '13px', color: '#e2e8f0' }}>{t.title}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{t.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Audit trail */}
          <div data-testid="audit-trail-panel"
               style={{ width: '320px', background: 'var(--ui2-bg-card)',
                 border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius)',
                 overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)',
                          fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              Audit Trail
              {selected ? ` — ${selected.id.slice(0, 8)}` : ''}
            </div>
            {!selected ? (
              <div style={{ padding: '32px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                Select a ticket to view its audit trail
              </div>
            ) : auditLog.length === 0 ? (
              <div data-testid="audit-empty"
                   style={{ padding: '32px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                No audit events
              </div>
            ) : (
              <ul data-testid="audit-events-list"
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {auditLog.map((ev) => (
                  <li key={ev.id}
                      data-testid={`audit-event-${ev.id}`}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui2-border)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{ev.event_type}</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{ev.role}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                      by {ev.actor}
                    </div>
                    {Object.keys(ev.payload).length > 0 && (
                      <div style={{ color: '#64748b', marginTop: '4px', fontSize: '11px' }}>
                        {JSON.stringify(ev.payload)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageShellUI2>
  );
}
