const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const wsMessages = [];
  page.on('websocket', ws => {
    ws.on('framesent', f => wsMessages.push({ dir: 'sent', payload: f.payload }));
    ws.on('framereceived', f => {
      try {
        wsMessages.push({ dir: 'recv', payload: JSON.parse(f.payload) });
      } catch (e) {
        wsMessages.push({ dir: 'recv', payload: f.payload });
      }
    });
  });

  console.log('Navigating to frontend...');
  await page.goto('http://localhost:5100', { waitUntil: 'networkidle' });

  // Wait for Live Data indicator
  try {
    await page.waitForSelector('text=Live Data', { timeout: 10000 });
    console.log('✅ Frontend indicates Live Data');
  } catch (e) {
    console.error('⚠️ Live Data indicator not found');
  }

  // Fetch backend /latest bar first, then wait for matching WS message
  try {
    const resLatest = await fetch('http://localhost:8000/api/v1/bars/AAPL/1m/latest');
    if (!resLatest.ok) throw new Error('HTTP ' + resLatest.status);
    const latest = await resLatest.json();
    console.log('Backend latest bar (target):', latest.bar_index, latest.ts_start_ms, latest.close);

    const targetIndex = latest.bar_index;
    const targetTs = latest.ts_start_ms;
    const targetClose = Number(latest.close);

    // Wait up to 30s for a matching WS frame
    let matched = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !matched) {
      for (const m of wsMessages.slice(-500)) {
        if (m.dir === 'recv' && m.payload && (m.payload.symbol === 'AAPL' || m.payload.s === 'AAPL')) {
          const payload = m.payload;
          if ((payload.bar_index && payload.bar_index === targetIndex) || (payload.ts_start_ms && payload.ts_start_ms === targetTs)) {
            matched = payload;
            break;
          }
        }
      }
      if (!matched) await new Promise(r => setTimeout(r, 500));
    }

    if (!matched) {
      console.error('❌ Did not observe a WS message matching backend latest bar index/ts');
      console.log('Last WS messages sample:', wsMessages.slice(-20));
      await page.screenshot({ path: 'artifacts/dashboard_no_matching_ws.png' });
      await browser.close();
      process.exit(2);
    }

    const wsVal = Number(matched.close || matched.c);
    const diff = Math.abs(wsVal - targetClose);
    const pct = (diff / (targetClose || 1)) * 100;

    console.log(`Matched WS bar_index=${matched.bar_index || matched.bar_index}, wsClose=${wsVal}, backendClose=${targetClose}, diff=${diff} (${pct.toFixed(4)}%)`);

    if (pct < 0.01) {
      console.log('✅ Dashboard is showing real prices (WS and backend latest match)');
      await page.screenshot({ path: 'artifacts/dashboard_price_match.png' });
      await browser.close();
      process.exit(0);
    } else {
      console.error('❌ Price mismatch between WS and backend latest bar');
      await page.screenshot({ path: 'artifacts/dashboard_price_mismatch.png' });
      console.log('Matched message:', matched);
      await browser.close();
      process.exit(3);
    }
  } catch (err) {
    console.error('Failed to verify backend latest vs WS:', err);
    await page.screenshot({ path: 'artifacts/dashboard_fetch_error.png' });
    await browser.close();
    process.exit(1);
  }
})();
