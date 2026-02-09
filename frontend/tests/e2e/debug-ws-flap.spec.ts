import { test } from '@playwright/test';

// Debug test: capture console logs and backend ws_status while app is open
test('debug: reproduce WS flap', async ({ page, request }) => {
  const logs: Array<{type: string, text: string}> = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  // Capture websocket events
  page.on('websocket', ws => {
    console.log('page:websocket', ws.url());
    ws.on('framesent', frame => console.log('page:websocket:framesent', frame));
    ws.on('framereceived', frame => console.log('page:websocket:framereceived', frame));
    ws.on('close', () => console.log('page:websocket:close'));
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Open the Monitor/Chart view which initializes the data connection
  await page.getByTestId('nav-item-monitor').click();
  await page.waitForTimeout(2000);
  console.log('Opened Monitor view');

  console.log('Starting ws_status polling...');
  for (let i = 0; i < 12; i++) {
    try {
      const res = await request.get('http://localhost:8000/api/v1/autopilot/ws_status');
      const json = await res.json();
      console.log('ws_status', i, JSON.stringify(json));
    } catch (e) {
      console.log('ws_status error', e.message);
    }
    await page.waitForTimeout(1000);
  }

  console.log('Collected browser console logs:');
  for (const l of logs) {
    console.log(l.type, l.text);
  }
});