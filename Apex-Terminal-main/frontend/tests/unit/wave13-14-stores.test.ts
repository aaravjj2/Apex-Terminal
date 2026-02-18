/**
 * Wave 13-14 Store Unit Tests (v1.123-v1.142)
 * Tests for wave1314Store: runs, workflows, templates, incidents, replay, decisions, search, health
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { wave1314Store } from '../../src/ui2/stores/wave1314Store';

describe('wave1314Store', () => {
  // ── Automation Runs ──────────────────────────────────────

  describe('automation runs', () => {
    it('has 3 demo runs', () => {
      const runs = wave1314Store.getRuns();
      expect(runs).toHaveLength(3);
    });

    it('returns runs sorted by started_at descending', () => {
      const runs = wave1314Store.getRuns();
      for (let i = 0; i < runs.length - 1; i++) {
        expect(runs[i].started_at >= runs[i + 1].started_at).toBe(true);
      }
    });

    it('gets run by id', () => {
      const run = wave1314Store.getRun('run-demo-001');
      expect(run).not.toBeNull();
      expect(run!.workflow_name).toBe('Daily Export at Market Close');
    });

    it('returns null for nonexistent run', () => {
      expect(wave1314Store.getRun('nonexistent')).toBeNull();
    });

    it('run has steps', () => {
      const run = wave1314Store.getRun('run-demo-001');
      expect(run!.steps.length).toBe(2);
      expect(run!.steps[0].action_type).toBe('export_bundle');
    });

    it('run has logs', () => {
      const run = wave1314Store.getRun('run-demo-001');
      expect(run!.logs.length).toBeGreaterThan(0);
    });

    it('failed run has error status', () => {
      const run = wave1314Store.getRun('run-demo-003');
      expect(run!.status).toBe('failed');
    });
  });

  // ── Workflows CRUD ───────────────────────────────────────

  describe('workflows', () => {
    it('has 2 demo workflows', () => {
      expect(wave1314Store.getWorkflows()).toHaveLength(2);
    });

    it('gets workflow by id', () => {
      const wf = wave1314Store.getWorkflow('wf-v3-001');
      expect(wf).not.toBeNull();
      expect(wf!.name).toBe('Daily Export at Market Close');
    });

    it('creates a new workflow', () => {
      const before = wave1314Store.getWorkflows().length;
      const wf = wave1314Store.createWorkflow(
        'Test WF',
        { type: 'schedule', config: { cron: '0 9 * * *' } },
        [{ type: 'notify', config: { message: 'hello' } }],
      );
      expect(wf.name).toBe('Test WF');
      expect(wave1314Store.getWorkflows().length).toBe(before + 1);
    });

    it('deletes a workflow', () => {
      const before = wave1314Store.getWorkflows().length;
      wave1314Store.deleteWorkflow('wf-v3-001');
      expect(wave1314Store.getWorkflows().length).toBe(before - 1);
    });

    it('returns null for nonexistent workflow', () => {
      expect(wave1314Store.getWorkflow('nope')).toBeNull();
    });
  });

  // ── Templates ────────────────────────────────────────────

  describe('templates', () => {
    it('has 3 demo templates', () => {
      expect(wave1314Store.getTemplates()).toHaveLength(3);
    });

    it('applies template creates a workflow', () => {
      const before = wave1314Store.getWorkflows().length;
      const wf = wave1314Store.applyTemplate('tmpl-001');
      expect(wf).not.toBeNull();
      expect(wave1314Store.getWorkflows().length).toBe(before + 1);
    });

    it('apply nonexistent template returns null', () => {
      expect(wave1314Store.applyTemplate('nope')).toBeNull();
    });
  });

  // ── Incidents ────────────────────────────────────────────

  describe('incidents', () => {
    it('has 2 demo incidents', () => {
      expect(wave1314Store.getIncidents()).toHaveLength(2);
    });

    it('returns incidents sorted by created_at descending', () => {
      const incs = wave1314Store.getIncidents();
      for (let i = 0; i < incs.length - 1; i++) {
        expect(incs[i].created_at >= incs[i + 1].created_at).toBe(true);
      }
    });

    it('gets incident by id', () => {
      const inc = wave1314Store.getIncident('inc-demo-001');
      expect(inc).not.toBeNull();
      expect(inc!.title).toBe('Market data feed disconnected');
    });

    it('creates a new incident', () => {
      const before = wave1314Store.getIncidents().length;
      const inc = wave1314Store.createIncident('Test Incident', 'warning', 'Test description');
      expect(inc.status).toBe('open');
      expect(wave1314Store.getIncidents().length).toBe(before + 1);
    });
  });

  // ── Replay Controls ──────────────────────────────────────

  describe('replay', () => {
    it('starts playing at speed 1', () => {
      const r = wave1314Store.getReplay();
      expect(r.status).toBe('playing');
      expect(r.speed).toBe(1.0);
    });

    it('toggles pause', () => {
      wave1314Store.toggleReplayPause();
      expect(wave1314Store.getReplay().status).toBe('paused');
      wave1314Store.toggleReplayPause();
      expect(wave1314Store.getReplay().status).toBe('playing');
    });

    it('sets replay speed', () => {
      wave1314Store.setReplaySpeed(2.0);
      expect(wave1314Store.getReplay().speed).toBe(2.0);
      wave1314Store.setReplaySpeed(1.0);
    });
  });

  // ── Decisions ────────────────────────────────────────────

  describe('decisions', () => {
    it('has 4 demo decisions', () => {
      expect(wave1314Store.getDecisions()).toHaveLength(4);
    });

    it('returns decisions sorted by timestamp descending', () => {
      const decs = wave1314Store.getDecisions();
      for (let i = 0; i < decs.length - 1; i++) {
        expect(decs[i].timestamp >= decs[i + 1].timestamp).toBe(true);
      }
    });

    it('gets decision by id', () => {
      const dec = wave1314Store.getDecision('dec-001');
      expect(dec).not.toBeNull();
      expect(dec!.symbol).toBe('AAPL');
    });

    it('decision has portfolio impact', () => {
      const dec = wave1314Store.getDecision('dec-001');
      expect(dec!.portfolio_impact).toBeDefined();
      expect(dec!.portfolio_impact!.old_weight).toBeGreaterThanOrEqual(0);
    });

    it('decision has features and risk evaluation', () => {
      const dec = wave1314Store.getDecision('dec-001');
      expect(Object.keys(dec!.features).length).toBeGreaterThan(0);
      expect(dec!.risk_evaluation.max_profit).toBeGreaterThan(0);
    });
  });

  // ── Search ───────────────────────────────────────────────

  describe('search', () => {
    it('returns suggestions for empty query', () => {
      const sugs = wave1314Store.getSuggestions('');
      expect(sugs.length).toBeGreaterThan(0);
      expect(sugs.length).toBeLessThanOrEqual(5);
    });

    it('filters suggestions by query', () => {
      const sugs = wave1314Store.getSuggestions('AAPL');
      expect(sugs.length).toBe(1);
      expect(sugs[0].query).toBe('AAPL');
    });

    it('returns empty for no match', () => {
      const sugs = wave1314Store.getSuggestions('ZZZNOTFOUND');
      expect(sugs).toHaveLength(0);
    });

    it('getSearchBackend returns local', () => {
      expect(wave1314Store.getSearchBackend()).toBe('local');
    });

    it('getLLMProvider returns deterministic', () => {
      expect(wave1314Store.getLLMProvider()).toBe('deterministic');
    });
  });

  // ── Health V4 ────────────────────────────────────────────

  describe('healthV4', () => {
    it('returns health data', () => {
      const h = wave1314Store.getHealthV4();
      expect(h).not.toBeNull();
      expect(h!.version).toBe('4.0.0');
    });

    it('has 8 subsystems', () => {
      const h = wave1314Store.getHealthV4()!;
      const count = Object.keys(h.subsystems).length;
      expect(count).toBe(8);
    });

    it('all subsystems have status', () => {
      const h = wave1314Store.getHealthV4()!;
      for (const [name, data] of Object.entries(h.subsystems)) {
        expect(data).toHaveProperty('status');
      }
    });

    it('status is healthy', () => {
      const h = wave1314Store.getHealthV4()!;
      expect(h.status).toBe('healthy');
    });
  });

  // ── Subscribe / Snapshot ─────────────────────────────────

  describe('subscribe', () => {
    it('subscribe returns unsubscribe function', () => {
      const unsub = wave1314Store.subscribe(() => {});
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('getSnapshot returns state object', () => {
      const snap = wave1314Store.getSnapshot();
      expect(snap).toBeDefined();
      expect(snap.runs).toBeDefined();
      expect(snap.workflows).toBeDefined();
    });
  });
});
