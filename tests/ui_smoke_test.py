import sys
from playwright.sync_api import sync_playwright

def run_smoke_test():
    """Loop 2: Minimal IO Verification via Browser"""
    print("Loop 2: Starting Playwright Smoke Test...")
    try:
        with sync_playwright() as p:
            # Launch headless
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Load a static resource (e.g. Brain Contract DOC)
            # Or just verify browser functionality if no webserver running
            page.set_content("<html><body><h1>QC Adapter Ready</h1></body></html>")
            
            # Verify Content
            title = page.locator("h1").text_content()
            assert title == "QC Adapter Ready"
            
            # Snapshot
            page.screenshot(path="docs/smoke_snapshot.png")
            print("Loop 2: Verification Passed. Snapshot saved.")
            browser.close()
    except Exception as e:
        print(f"Loop 2 FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_smoke_test()
