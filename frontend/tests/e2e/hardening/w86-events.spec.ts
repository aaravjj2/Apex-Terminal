/**
 * W86 – Event Bus + Audit Events indexed in ES
 * Verifies:
 *  1. /api/v3/events/emit creates events
 *  2. Events appear in /api/v3/events list
 *  3. /api/v3/events/search filters by correlation_id
 *  4. Events are indexed in ES apex-events-*
 *  5. UI2 Ops page renders (event bus is wired in, server healthy)
 */
import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:8090';
const ES  = 'http://localhost:9200';
const UI  = 'http://localhost:5100';

// Polyfill for UUID (Playwright context doesn't have Node's crypto.randomUUID)
function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

test.describe('W86 Event Bus – API contract', () => {
  test('POST /api/v3/events/emit returns 201 with event_id', async ({ request }) => {
    const res = await request.post(`${API}/api/v3/events/emit`, {
      data: { category: 'system', action: 'playwright_test' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('event_id');
    expect(body).toHaveProperty('correlation_id');
    expect(body.category).toBe('system');
  });

  test('emitted event appears in GET /api/v3/events', async ({ request }) => {
    const entityId = `pw-w86-${randomId()}`;
    await request.post(`${API}/api/v3/events/emit`, {
      data: { category: 'strategy', action: 'created', entity_id: entityId },
    });
    const listRes = await request.get(`${API}/api/v3/events`);
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    const ids = body.items.map((e: any) => e.entity_id);
    expect(ids).toContain(entityId);
  });

  test('POST /api/v3/events/search filters by correlation_id', async ({ request }) => {
    const cid = `pw-cid-${randomId()}`;
    await request.post(`${API}/api/v3/events/emit`, {
      data: { category: 'backtest', action: 'run_started', correlation_id: cid },
    });
    const searchRes = await request.post(`${API}/api/v3/events/search`, {
      data: { correlation_id: cid },
    });
    expect(searchRes.status()).toBe(200);
    const body = await searchRes.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    for (const event of body.events) {
      expect(event.correlation_id).toBe(cid);
    }
  });

  test('GET /api/v3/events/{id} returns single event', async ({ request }) => {
    const emitRes = await request.post(`${API}/api/v3/events/emit`, {
      data: { category: 'audit', action: 'access_check' },
    });
    const eventId = (await emitRes.json()).event_id;

    const getRes = await request.get(`${API}/api/v3/events/${eventId}`);
    expect(getRes.status()).toBe(200);
    const body = await getRes.json();
    expect(body.event_id).toBe(eventId);
  });

  test('GET /api/v3/events/{nonexistent} returns 404', async ({ request }) => {
    const res = await request.get(`${API}/api/v3/events/nonexistent-pw-w86`);
    expect(res.status()).toBe(404);
  });
});

test.describe('W86 Event Bus – ES indexing', () => {
  test('emitted event is indexed in ES apex-events-* within 5s', async ({ request }) => {
    const entityId = `es-index-pw-${randomId()}`;
    const emitRes = await request.post(`${API}/api/v3/events/emit`, {
      data: { category: 'backtest', action: 'run_started', entity_id: entityId },
    });
    expect(emitRes.status()).toBe(201);
    const eventId = (await emitRes.json()).event_id;

    // Poll ES for up to 5 seconds
    const now = new Date();
    const indexName = `apex-events-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
    let found = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      const esRes = await request.get(`${ES}/${indexName}/_search?q=event_id:${eventId}`);
      if (esRes.ok()) {
        const esBody = await esRes.json();
        const hits = esBody?.hits?.hits ?? [];
        if (hits.some((h: any) => h._source?.event_id === eventId)) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  test('ES apex-events-* index exists', async ({ request }) => {
    const now = new Date();
    const indexName = `apex-events-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = await request.get(`${ES}/${indexName}`);
    expect(res.ok()).toBe(true);
  });
});

test.describe('W86 – UI2 Ops page (server healthy with event bus)', () => {
  test('ops page renders with ops-ui2-page testid', async ({ page }) => {
    await page.goto(`${UI}/ui2/ops`);
    await expect(page.getByTestId('ops-ui2-page')).toBeVisible({ timeout: 15_000 });
  });
});
