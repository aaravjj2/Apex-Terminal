
import { test, expect } from '@playwright/test';

test.describe('Autopilot Frontend Features', () => {
    test.beforeEach(async ({ page }) => {
        // Mock Status with Sentiment
        await page.route('**/api/v1/autopilot/status', async route => {
            const json = {
                state: 'idle',
                mode: 'paper',
                kill_switch: false,
                kill_switch_active: false,
                last_cycle: null,
                last_cycle_at: null,
                cycles_completed: 10,
                trades_executed: 5,
                win_rate: 0.6,
                avg_win: 100,
                avg_loss: 50,
                sharpe_ratio: 1.5,
                portfolio: {
                    equity: 10500,
                    cash: 5000,
                    total_risk: 1000,
                    open_positions: 1
                },
                open_positions: 1,
                broker_metrics: {},
                sentiment: {
                    timestamp: new Date().toISOString(),
                    provider: 'finnhub',
                    news_velocity: 'high',
                    sentiment_scores: {
                        'MARKET': -0.7 // Very Bearish
                    }
                }
            };
            await route.fulfill({ json });
        });

        // Mock Positions
        await page.route('**/api/v1/autopilot/positions?status=open', async route => {
            const json = {
                positions: [
                    {
                        position_id: 'AAPL',
                        symbol: 'AAPL',
                        template: 'long_call',
                        legs: [],
                        entry_price: 150,
                        entry_cost: 150,
                        entry_time: new Date().toISOString(),
                        quantity: 1,
                        status: 'open',
                        current_value: 160,
                        greeks: {},
                        max_loss: 150,
                        max_profit: 300,
                        max_risk: 150,
                        dte: 30,
                        days_to_expiry: 30,
                        expiration: '2026-01-01',
                        underlying_price: 160,
                        iv_rank: 50,
                        realized_pnl: 0,
                        unrealized_pnl: 10,
                        pnl_percent: 0.06,
                        total_commission: 0
                    }
                ],
                count: 1,
                portfolio: {}
            };
            await route.fulfill({ json });
        });

        // Mock Panic Close
        await page.route('**/api/v1/autopilot/positions/AAPL/close', async route => {
            await route.fulfill({ json: { status: 'submitted', order_id: 'panic_123' } });
        });

        // Mock Config
        await page.route('**/api/v1/autopilot/config', async route => {
            await route.fulfill({
                json: {
                    config: { mode: 'paper', paper_equity: 100000 },
                    defaults: { mode: 'paper' }
                }
            });
        });

        // Mock Universe
        await page.route('**/api/v1/autopilot/universe', async route => {
            await route.fulfill({ json: { symbols: [], count: 0 } });
        });

        // Mock Logs
        await page.route('**/api/v1/autopilot/logs*', async route => {
            await route.fulfill({ json: { logs: [], count: 0 } });
        });

        // Mock Agents
        await page.route('**/api/v1/autopilot/agents', async route => {
            await route.fulfill({ json: { agents: [], count: 0 } });
        });
    });

    test('should display sentiment indicator', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('nav-item-autopilot').click();

        // Wait for dashboard to load
        await expect(page.getByTestId('autopilot-dashboard')).toBeVisible();

        // Check for Chart Canvas
        await expect(page.getByTestId('chart-canvas')).toBeVisible();

        // Check for Sentiment Badge
        const sentimentBadge = page.locator('text=🐻 BEARISH');
        await expect(sentimentBadge).toBeVisible();
        await expect(page.locator('text=MARKET:')).toBeVisible();
    });

    test('should trigger panic sell', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('nav-item-autopilot').click();

        await expect(page.getByTestId('autopilot-positions')).toBeVisible();

        // Expand position if needed (row might need click)
        const row = page.getByTestId('position-row-AAPL');
        await expect(row).toBeVisible();

        // Check for Panic Button
        const panicBtn = page.getByTestId('panic-sell-AAPL');
        await expect(panicBtn).toBeVisible();

        // Setup request interception to verify call
        const closeRequestPromise = page.waitForRequest(request =>
            request.url().includes('/positions/AAPL/close') && request.method() === 'POST'
        );

        // Click Panic Sell
        await panicBtn.click();

        // Verify request was made
        const request = await closeRequestPromise;
        expect(request).toBeTruthy();
    });
});
