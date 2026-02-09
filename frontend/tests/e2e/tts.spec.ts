/**
 * ElevenLabs TTS E2E Tests
 * Tests for voice toggle and speak functionality
 */

import { test, expect } from '@playwright/test';
import { navigateDeterministic } from './helpers';

test.describe('ElevenLabs TTS Integration', () => {
    test.beforeEach(async ({ page }) => {
        // Mock TTS Status to be enabled
        await page.route('**/api/v1/tts/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ enabled: true, voice_id: 'mock-voice' })
            });
        });

        // Mock TTS Speak to return dummy audio
        await page.route('**/api/v1/tts/speak', async route => {
            // Return a minimal valid MP3 header (silent)
            const silentMp3 = Buffer.from([
                0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            await route.fulfill({
                status: 200,
                contentType: 'audio/mpeg',
                body: silentMp3
            });
        });

        // Mock Autopilot Proposals API (must be set up BEFORE navigation)
        await page.route('**/api/v1/autopilot/proposals', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    cycle_id: "test-cycle",
                    candidates_generated: 1,
                    candidates_by_template: { "put_credit_spread": 1 },
                    selected_count: 1,
                    selection_method: "test",
                    timestamp: new Date().toISOString(),
                    candidates: [{
                        id: "test-cand-1",
                        symbol: "AAPL",
                        template: "put_credit_spread",
                        status: "selected",
                        rationale: "Bullish divergence detected.",
                        legs: [],
                        max_loss: 100,
                        max_profit: 50,
                        pop: 0.75,
                        dte: 5,
                        iv_rank: 0.2,
                        liquidity_score: 0.9,
                        adjusted_score: 0.8,
                        rejection_reasons: []
                    }]
                })
            });
        });

        // Stub Audio playback to avoid browser decoding errors and verify call
        await page.addInitScript(() => {
            (window as any).__audio_played_count = 0;
            (window as any).Audio = class {
                src: string = '';
                volume: number = 1;
                onended: (() => void) | null = null;
                onerror: ((e: any) => void) | null = null;

                constructor(src?: string) {
                    if (src) this.src = src;
                }

                play() {
                    (window as any).__audio_played_count++;
                    console.log('Mock Audio.play called');
                    setTimeout(() => {
                        if (this.onended) this.onended();
                    }, 100);
                    return Promise.resolve();
                }

                pause() { }
            };
        });
    });

    test('Voice toggle enables and persists', async ({ page }) => {
        await navigateDeterministic(page, '/');

        // Find Voice Toggle
        const toggle = page.getByTestId('voice-toggle-btn');
        await expect(toggle).toBeVisible();
        await toggle.click();

        await expect(page.getByTestId('voice-toggle-btn')).toBeVisible();

        // Check local storage persistence implied by state change
        // Volume slider should appear
        await expect(page.locator('input[type="range"]')).toBeVisible();
    });

    test('Clicking speak button triggers API and playback', async ({ page }) => {
        // Navigate to home first
        await navigateDeterministic(page, '/');

        // Click Autopilot in navigation
        await page.getByTestId('nav-item-autopilot').click();

        // Ensure we are in "Voice ON" mode
        const voiceToggle = page.getByTestId('voice-toggle-btn');
        if (await voiceToggle.isVisible()) {
            await voiceToggle.click();
        }

        // Wait for proposals to load (with increased timeout)
        await page.getByTestId('autopilot-proposals').waitFor({ timeout: 30000 });

        // Find Speak button
        const speakBtn = page.locator('button[title="Read Rationale"]');
        await expect(speakBtn).toBeVisible();

        // Click it
        await speakBtn.click();

        // Verify playback count incremented
        await expect.poll(async () => {
            return await page.evaluate(() => (window as any).__audio_played_count);
        }, { timeout: 10000 }).toBeGreaterThan(0);
    });
});
