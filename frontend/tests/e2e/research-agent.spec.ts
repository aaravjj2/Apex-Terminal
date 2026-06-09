import { expect, test } from '@playwright/test';

const backendPort = process.env.APEX_BACKEND_PORT || '8010';

test.describe('Research Agent', () => {
  test('API status exposes 4 nodes + MCP metadata', async ({ request }) => {
    const res = await request.get(`http://localhost:${backendPort}/api/v1/research/status`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.agent).toBe('research_4_node_state_machine');
    expect(body.nodes).toHaveLength(4);
    expect(typeof body.mcp_sse_mounted).toBe('boolean');
    expect(typeof body.finbert_available).toBe('boolean');
  });

  test('API demo returns blueprint trade plan', async ({ request }) => {
    const res = await request.get(`http://localhost:${backendPort}/api/v1/research/demo`);
    expect(res.ok()).toBeTruthy();
    const plan = await res.json();
    expect(plan.trade_plan_id).toBe('REQ-7738-ALPHA');
    expect(plan.orchestrator_node.parsed_components.underlying).toBe('SPY');
  });

  test('API handshake dry-run end-to-end', async ({ request }) => {
    const res = await request.post(`http://localhost:${backendPort}/api/v1/research/handshake`, {
      data: {
        osi_symbol: 'SPY   251219C00600000',
        news_text: 'SPY beats earnings estimates; guidance raised for next quarter',
        event_type: 'EARNINGS_BEAT',
        market_mid: 12.6,
        dry_run: true,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ticker).toBe('SPY');
    expect(body.trade_plan).toBeTruthy();
    expect(body.handshake_mode).toBeTruthy();
  });

  test('loads 4-node UI and runs blueprint demo', async ({ page }) => {
    await page.goto('/ui2/research-agent');
    await expect(page.getByTestId('research-agent-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ra-nodes')).toBeVisible();
    await expect(page.getByTestId('ra-mcp-badge')).toBeVisible();
    await expect(page.getByTestId('ra-finbert-badge')).toBeVisible();

    await page.getByTestId('ra-demo').click();
    await expect(page.getByTestId('ra-payload')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('ra-payload')).toContainText('REQ-7738-ALPHA');
    await expect(page.getByTestId('ra-payload')).toContainText('SPY');
  });

  test('TCC handshake button when plan approved', async ({ page }) => {
    await page.goto('/ui2/research-agent');
    await page.getByTestId('ra-demo').click();
    await expect(page.getByTestId('ra-payload')).toBeVisible({ timeout: 60_000 });

    const handshakeBtn = page.getByTestId('ra-handshake');
    const status = await page.getByTestId('ra-payload').textContent();
    if (status?.includes('APPROVED')) {
      await expect(handshakeBtn).toBeEnabled();
      await handshakeBtn.click();
      await expect(page.getByTestId('ra-handshake-result')).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(handshakeBtn).toBeDisabled();
    }
  });

  test('navigates from pipeline to research agent', async ({ page }) => {
    await page.goto('/ui2/command-center');
    await expect(page.getByTestId('autopilot-pipeline-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('pipe-link-research').click();
    await expect(page.getByTestId('research-agent-page')).toBeVisible({ timeout: 30_000 });
  });
});
