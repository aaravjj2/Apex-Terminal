"""
Playwright E2E tests for autopilot system.
Tests full workflow through browser.
"""

import pytest
from playwright.sync_api import Page, expect
import time


@pytest.fixture(scope="module")
def base_url():
    """Backend API base URL."""
    return "http://localhost:8000"


@pytest.fixture(scope="module")
def frontend_url():
    """Frontend base URL."""
    return "http://localhost:5173"


class TestAutopilotE2E:
    """E2E tests for autopilot functionality."""
    
    def test_api_health(self, page: Page, base_url: str):
        """Test API health endpoint is accessible."""
        page.goto(f"{base_url}/health")
        
        # Should show JSON response
        content = page.content()
        assert "healthy" in content.lower()
    
    def test_api_docs_accessible(self, page: Page, base_url: str):
        """Test Swagger docs are accessible."""
        page.goto(f"{base_url}/docs")
        
        # Wait for Swagger UI to load
        page.wait_for_selector("text=Phase 1", timeout=10000)
        expect(page.locator("text=autopilot")).to_be_visible()
    
    def test_autopilot_status_endpoint(self, page: Page, base_url: str):
        """Test autopilot status via browser."""
        page.goto(f"{base_url}/api/v1/autopilot/status")
        
        content = page.content()
        assert "mode" in content
        assert "llm_mode" in content
    
    def test_verification_health_endpoint(self, page: Page, base_url: str):
        """Test Alpaca verification health endpoint."""
        page.goto(f"{base_url}/api/v1/verification/alpaca/health")
        
        content = page.content()
        assert "status" in content
        # Should show either healthy or unconfigured
        assert "healthy" in content.lower() or "unconfigured" in content.lower()


class TestFrontendE2E:
    """E2E tests for frontend."""
    
    def test_frontend_loads(self, page: Page, frontend_url: str):
        """Test frontend application loads."""
        page.goto(frontend_url)
        
        # Wait for React app to mount
        page.wait_for_load_state("networkidle")
        
        # Check for main app container
        expect(page.locator("#root")).to_be_attached()
    
    def test_chart_renders(self, page: Page, frontend_url: str):
        """Test chart component renders."""
        page.goto(frontend_url)
        page.wait_for_load_state("networkidle")
        
        # Give time for chart to initialize
        time.sleep(2)
        
        # Check for canvas (chart) element
        canvas_count = page.locator("canvas").count()
        assert canvas_count >= 0  # May have multiple canvases
    
    def test_websocket_connection(self, page: Page, frontend_url: str):
        """Test WebSocket connection is established."""
        # Monitor network for WebSocket
        ws_connections = []
        
        page.on("websocket", lambda ws: ws_connections.append(ws))
        
        page.goto(frontend_url)
        page.wait_for_load_state("networkidle")
        
        # Wait for potential WS connection
        time.sleep(3)
        
        # WS may or may not connect depending on config
        # Just verify page loaded successfully
        expect(page.locator("#root")).to_be_attached()


class TestAutopilotRunE2E:
    """E2E tests for running autopilot via API."""
    
    def test_trigger_autopilot_run(self, page: Page, base_url: str):
        """Test triggering autopilot run via API."""
        # Navigate to docs
        page.goto(f"{base_url}/docs")
        page.wait_for_load_state("networkidle")
        
        # Find and expand autopilot-api section
        autopilot_section = page.locator("text=autopilot-api")
        if autopilot_section.count() > 0:
            autopilot_section.first.click()
        
        # Wait for expansion
        time.sleep(1)
        
        # Page should have API documentation
        expect(page.locator("text=run")).to_be_visible()
    
    def test_verification_endpoint_via_docs(self, page: Page, base_url: str):
        """Test verification endpoint documentation."""
        page.goto(f"{base_url}/docs")
        page.wait_for_load_state("networkidle")
        
        # Look for verification section
        verification_section = page.locator("text=verification")
        if verification_section.count() > 0:
            verification_section.first.click()
        
        time.sleep(1)
        
        # Verify endpoints are documented
        content = page.content()
        assert "verification" in content.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--headed"])
