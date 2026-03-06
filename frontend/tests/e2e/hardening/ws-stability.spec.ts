/**
 * Hardening Suite  Gate 3: WebSocket Stability
 *
 * Tests the REAL WebSocket endpoints on the running Apex Terminal server.
 *
 * WS endpoints (confirmed):
 *   ws://localhost:8000/ws/autopilot
 *   ws://localhost:8000/ws/bars/{symbol}/{timeframe}
 *
 * Status API:
 *   GET /api/v1/autopilot/ws_status -> {connections, subscriptions, heartbeat_running}
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000';
const WS_AUTOPILOT = 'ws://localhost:8000/ws/autopilot';
const WS_BARS = 'ws://localhost:8000/ws/bars/AAPL/1m';

// ---------------------------------------------------------------------------
// WS Status API
// ---------------------------------------------------------------------------
test.describe('WebSocket Status API', () => {

  test('GET /api/v1/autopilot/ws_status returns 200', async ({ request }) => {
    const resp = await request.get(`${API}/api/v1/autopilot/ws_status`);
    expect(resp.status()).toBe(200);
  });

  test('heartbeat_running is true', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(json.heartbeat_running).toBe(true);
  });

  test('connections is a non-negative number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(typeof json.connections).toBe('number');
    expect(json.connections).toBeGreaterThanOrEqual(0);
  });

  test('subscriptions is a non-negative number', async ({ request }) => {
    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(typeof json.subscriptions).toBe('number');
    expect(json.subscriptions).toBeGreaterThanOrEqual(0);
  });

});

// ---------------------------------------------------------------------------
// WS autopilot endpoint  real connection
// ---------------------------------------------------------------------------
test.describe('WebSocket Autopilot  real connection', () => {

  test('can connect to /ws/autopilot', async ({ page }) => {
    const connected = await page.evaluate((wsUrl: string) => {
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); resolve(false); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timeout); resolve(false); };
      });
    }, WS_AUTOPILOT);
    expect(connected).toBe(true);
  });

  test('autopilot WS stays open for 3 seconds without disconnect', async ({ page }) => {
    const result = await page.evaluate((wsUrl: string) => {
      return new Promise<{ opened: boolean; closed: boolean; duration: number }>((resolve) => {
        const start = Date.now();
        let opened = false;
        let closedUnexpectedly = false;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => { opened = true; };
        ws.onclose = (e) => {
          if (opened && Date.now() - start < 2900) {
            closedUnexpectedly = true;
          }
        };
        ws.onerror = () => { closedUnexpectedly = true; };

        setTimeout(() => {
          ws.close();
          resolve({ opened, closed: closedUnexpectedly, duration: Date.now() - start });
        }, 3000);
      });
    }, WS_AUTOPILOT);

    expect(result.opened).toBe(true);
    expect(result.closed).toBe(false);
    expect(result.duration).toBeGreaterThanOrEqual(2900);
  });

  test('autopilot WS receives messages or stays silent for 2s (no error)', async ({ page }) => {
    const result = await page.evaluate((wsUrl: string) => {
      return new Promise<{ connected: boolean; hadError: boolean }>((resolve) => {
        const ws = new WebSocket(wsUrl);
        let hadError = false;
        ws.onerror = () => { hadError = true; };
        ws.onopen = () => {
          setTimeout(() => {
            ws.close();
            resolve({ connected: true, hadError });
          }, 2000);
        };
        setTimeout(() => {
          ws.close();
          resolve({ connected: ws.readyState !== WebSocket.CONNECTING, hadError });
        }, 6000);
      });
    }, WS_AUTOPILOT);
    expect(result.connected).toBe(true);
    expect(result.hadError).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// WS bars endpoint  real connection
// ---------------------------------------------------------------------------
test.describe('WebSocket Bars  real connection', () => {

  test('can connect to /ws/bars/AAPL/1m', async ({ page }) => {
    const connected = await page.evaluate((wsUrl: string) => {
      return new Promise<boolean>((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); resolve(false); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timeout); resolve(false); };
      });
    }, WS_BARS);
    expect(connected).toBe(true);
  });

  test('bars WS stays open for 2 seconds', async ({ page }) => {
    const result = await page.evaluate((wsUrl: string) => {
      return new Promise<{ opened: boolean; stayedOpen: boolean }>((resolve) => {
        const ws = new WebSocket(wsUrl);
        let opened = false;
        let closedEarly = false;
        const start = Date.now();

        ws.onopen = () => { opened = true; };
        ws.onclose = () => {
          if (opened && Date.now() - start < 1900) closedEarly = true;
        };
        ws.onerror = () => { closedEarly = true; };

        setTimeout(() => {
          ws.close();
          resolve({ opened, stayedOpen: !closedEarly });
        }, 2000);
      });
    }, WS_BARS);
    expect(result.opened).toBe(true);
    expect(result.stayedOpen).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// WS heartbeat stays running after connection
// ---------------------------------------------------------------------------
test.describe('WebSocket Heartbeat Persistence', () => {

  test('heartbeat_running stays true after connecting', async ({ request, page }) => {
    // Connect a WS, wait, then check heartbeat is still running
    await page.evaluate((wsUrl: string) => {
      return new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => setTimeout(() => { ws.close(); resolve(); }, 1500);
        ws.onerror = () => resolve();
        setTimeout(() => resolve(), 5000);
      });
    }, WS_AUTOPILOT);

    const json = await (await request.get(`${API}/api/v1/autopilot/ws_status`)).json();
    expect(json.heartbeat_running).toBe(true);
  });

  test('ws_status still returns 200 after WS activity', async ({ request, page }) => {
    await page.evaluate((wsUrl: string) => {
      return new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => { ws.close(); resolve(); };
        ws.onerror = () => resolve();
        setTimeout(() => resolve(), 3000);
      });
    }, WS_AUTOPILOT);

    const resp = await request.get(`${API}/api/v1/autopilot/ws_status`);
    expect(resp.status()).toBe(200);
  });

});
