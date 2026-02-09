import pytest
from playwright.sync_api import Page, expect

@pytest.mark.playwright
def test_smoke_page_load(page: Page):
    """Loop 2: Verify browser environment and capability."""
    print("Loop 2: Starting Playwright Smoke Test (Pytest)...")
    
    # 1. Load static content (simulating UI app or docs)
    # Since we are headless and maybe no webserver, use data:html
    page.goto("data:text/html,<html><body><h1 id='title'>QC Adapter Ready</h1></body></html>")
    
    # 2. Verify Content
    expect(page.locator("#title")).to_have_text("QC Adapter Ready")
    
    # 3. Snapshot
    screenshot_path = "docs/smoke_snapshot_pytest.png"
    page.screenshot(path=screenshot_path)
    print(f"Snapshot saved to {screenshot_path}")
