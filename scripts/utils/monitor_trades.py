
import asyncio
from playwright.async_api import async_playwright
import time
from datetime import datetime

async def monitor():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        print("Connecting to dashboard...")
        try:
            await page.goto("http://localhost:5100", timeout=60000)
            await page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Failed to load dashboard: {e}")
            await browser.close()
            return

        print("Dashboard loaded. Starting monitoring loop...", flush=True)

        while True:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{timestamp}] Checking status...", flush=True)

            try:
                # Take a screenshot of the current state
                await page.screenshot(path="current_dashboard.png")

                # Try to find relevant trade/autopilot elements
                # Note: Adjust selectors based on actual UI
                # Looking for "Run Log" or "Positions"
                
                # Check for cycle complete toast or log
                logs = await page.get_by_test_id("run-log-entry").all_inner_texts()
                if logs:
                     print(f"Latest logs: {logs[:2]}")

                # Check positions
                positions = await page.get_by_test_id("position-row").all_inner_texts()
                if positions:
                    print(f"Active Positions: {len(positions)}")
                else:
                    print("No active positions visible.")

            except Exception as e:
                print(f"Error during check: {e}")

            await asyncio.sleep(30)

if __name__ == "__main__":
    asyncio.run(monitor())
