// Bloomberg SVP — Strategy Validation Panel
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useCallback } from 'react';
import React from 'react';
import type { ValidationReport, ValidationIssue } from './artifactTypes';

interface ValidationPanelProps {
  specInput?: {
    name?: string;
    type?: string;
    spec?: Record<string, unknown>;
    version?: string;
    schema_version?: number;
  };
}

export function StrategyValidationPanel({ specInput }: ValidationPanelProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidation = useCallback(async () => {
    if (!specInput) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/v1/strategy-artifacts/validate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(specInput),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [specInput]);

  return (
    <div data-testid="strategy-validation-panel"
      style={{ background:PANEL, border:`1px solid ${BORDER}`, borderRadius:2, overflow:'hidden', fontFamily:MONO }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px', borderBottom:`1px solid ${BORDER}`, background:BG }}>
        <span style={{ color:AMBER, fontWeight:700, fontSize:10, letterSpacing:1 }}>STRATEGY VALIDATION</span>
        <button data-testid="strategy-validation-run"
          onClick={runValidation}
          disabled={loading}
          style={{
            background: loading ? SUBTLE+'22' : BLUE+'22',
            border:`1px solid ${loading ? SUBTLE : BLUE}`,
            color: loading ? SUBTLE : BLUE,
            fontFamily:MONO, fontSize:8, fontWeight:700, letterSpacing:0.5,
            padding:'3px 8px', cursor: loading ? 'default' : 'pointer', borderRadius:2,
          }}>
          {loading ? 'VALIDATING…' : 'RUN VALIDATION'}
        </button>
      </div>

      {/* Error strip */}
      {error && (
        <div style={{ padding:'5px 10px', background: RED+'11', color:RED, fontSize:9, borderBottom:`1px solid ${BORDER}` }}>
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div style={{ padding:10 }}>
          {/* Summary */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${BORDER}` }}>
            <span style={{ color: report.valid ? GREEN : RED, fontSize:14 }}>
              {report.valid ? '☑' : '☒'}
            </span>
            <span style={{ color: report.valid ? GREEN : RED, fontSize:10, fontWeight:700 }}>
              {report.valid ? 'VALID' : 'INVALID'}
            </span>
            <span style={{ color:SUBTLE, fontSize:8, marginLeft:'auto' }}>
              {report.errors.length} ERROR{report.errors.length !== 1 ? 'S' : ''} · {report.warnings.length} WARNING{report.warnings.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Errors */}
          <div data-testid="strategy-validation-errors" style={{ marginBottom:8 }}>
            <div style={{ color:RED, fontSize:8, fontWeight:700, letterSpacing:0.5, marginBottom:4 }}>
              ✕ ERRORS ({report.errors.length})
            </div>
            {report.errors.length === 0 ? (
              <div style={{ color:SUBTLE, fontSize:9, paddingLeft:8 }}>NO ERRORS</div>
            ) : (
              <div>
                {report.errors.map((issue: ValidationIssue, idx: number) => (
                  <div key={`error-${issue.rule_id}-${idx}`}
                    data-testid={`strategy-validation-issue-${issue.rule_id}-${idx}`}
                    style={{ display:'flex', gap:6, padding:'4px 8px', marginBottom:2, background: RED+'0d', border:`1px solid ${RED}33`, borderRadius:2 }}>
                    <span style={{ color:RED, fontSize:8, flexShrink:0, fontFamily:MONO }}>{issue.rule_id}</span>
                    <span style={{ color:TEXT, fontSize:9, flex:1 }}>{issue.message}</span>
                    <span style={{ color:SUBTLE, fontSize:8, flexShrink:0 }}>{issue.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warnings */}
          <div data-testid="strategy-validation-warnings">
            <div style={{ color:AMBER, fontSize:8, fontWeight:700, letterSpacing:0.5, marginBottom:4 }}>
              ⚠ WARNINGS ({report.warnings.length})
            </div>
            {report.warnings.length === 0 ? (
              <div style={{ color:SUBTLE, fontSize:9, paddingLeft:8 }}>NO WARNINGS</div>
            ) : (
              <div>
                {report.warnings.map((issue: ValidationIssue, idx: number) => (
                  <div key={`warning-${issue.rule_id}-${idx}`}
                    data-testid={`strategy-validation-issue-${issue.rule_id}-${idx}`}
                    style={{ display:'flex', gap:6, padding:'4px 8px', marginBottom:2, background: AMBER+'0d', border:`1px solid ${AMBER}33`, borderRadius:2 }}>
                    <span style={{ color:AMBER, fontSize:8, flexShrink:0, fontFamily:MONO }}>{issue.rule_id}</span>
                    <span style={{ color:TEXT, fontSize:9, flex:1 }}>{issue.message}</span>
                    <span style={{ color:SUBTLE, fontSize:8, flexShrink:0 }}>{issue.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!report && !error && (
        <div style={{ padding:'24px 12px', textAlign:'center', color:SUBTLE, fontSize:9 }}>
          CLICK &ldquo;RUN VALIDATION&rdquo; TO VALIDATE THE CURRENT STRATEGY
        </div>
      )}
    </div>
  );
}
