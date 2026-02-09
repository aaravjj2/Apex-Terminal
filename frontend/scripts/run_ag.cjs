const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PLAN_PATH = path.resolve(__dirname, '../../.ag/inbox/plan.json');
const OUTBOX_DIR = path.resolve(__dirname, '../../.ag/outbox');
const RESULTS_PATH = path.join(OUTBOX_DIR, 'results.json');
const SUMMARY_PATH = path.join(OUTBOX_DIR, 'summary.txt');
const ARTIFACTS_DIR = path.join(OUTBOX_DIR, 'artifacts');

// Ensure directories exist
if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
    console.log('Starting AG Runner...');
    let plan;
    try {
        plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    } catch (e) {
        console.error('Failed to read plan.json:', e);
        process.exit(1);
    }

    const isHeaded = process.argv.includes('--headed');
    const browser = await chromium.launch({ headless: !isHeaded });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results = {
        passed: true,
        failedStepIdx: null,
        error: null,
        steps: []
    };

    let stepIdx = 0;
    try {
        for (const step of plan.steps) {
            console.log(`Executing step ${stepIdx}: ${step.action} - ${step.description || ''}`);
            const startTime = Date.now();

            try {
                switch (step.action) {
                    case 'goto':
                        const targetUrl = step.url || `${plan.baseUrl || ''}${step.path || ''}`;
                        await page.goto(targetUrl);
                        break;
                    case 'assertVisible':
                        await page.waitForSelector(step.selector, { state: 'visible', timeout: 10000 });
                        break;
                    case 'click':
                        const clickOptions = { timeout: 10000 };
                        if (step.position) {
                            clickOptions.position = step.position;
                        }
                        await page.click(step.selector, clickOptions);
                        break;
                    case 'fill':
                        await page.fill(step.selector, step.value, { timeout: 10000 });
                        break;
                    case 'screenshot':
                        const screenshotPath = step.path.startsWith('/') ? step.path : path.resolve(__dirname, '../../', step.path);
                        // Ensure dir
                        const dir = path.dirname(screenshotPath);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        await page.screenshot({ path: screenshotPath });
                        break;
                    case 'keydown':
                        if (step.modifiers) {
                            await page.keyboard.down(step.modifiers[0]);
                        }
                        await page.keyboard.press(step.key);
                        if (step.modifiers) {
                            await page.keyboard.up(step.modifiers[0]);
                        }
                        break;
                    case 'timeout':
                        await page.waitForTimeout(step.duration);
                        break;
                    default:
                        throw new Error(`Unknown action: ${step.action}`);
                }
                results.steps.push({ idx: stepIdx, status: 'passed', duration: Date.now() - startTime });
            } catch (err) {
                console.error(`Step ${stepIdx} failed:`, err.message);
                throw err;
            }
            stepIdx++;
        }
    } catch (error) {
        results.passed = false;
        results.failedStepIdx = stepIdx;
        results.error = error.message;

        // Take failure screenshot
        try {
            const failPath = path.join(ARTIFACTS_DIR, `failure_${stepIdx}.png`);
            await page.screenshot({ path: failPath });
            // Save trace if possible (skipped for simplicity here)
        } catch (e) {
            console.error('Failed to take error screenshot:', e);
        }
    } finally {
        await browser.close();

        // Write results
        fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
        fs.writeFileSync(SUMMARY_PATH, results.passed ? 'PASS' : `FAIL: Step ${results.failedStepIdx} - ${results.error}`);

        console.log('Run finished. Results written.');
        if (!results.passed) process.exit(1);
    }
}

run();
