"""
E2E Test Harness for Playwright Tests.

Provides utilities for:
- Server lifecycle management
- WebSocket testing
- Visual verification
- Parity testing
"""

import asyncio
import subprocess
import time
import os
import signal
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from pathlib import Path
import json
import hashlib


@dataclass
class ServerConfig:
    """Configuration for test server."""
    
    host: str = "127.0.0.1"
    port: int = 8765
    startup_timeout: float = 10.0
    shutdown_timeout: float = 5.0
    health_endpoint: str = "/health"


@dataclass
class E2ETestContext:
    """Context passed to E2E tests (renamed to avoid pytest collection)."""
    
    server_url: str
    ws_url: str
    page: Any  # Playwright page
    context: Any  # Playwright browser context
    server_process: Optional[subprocess.Popen] = None
    messages: List[Dict[str, Any]] = field(default_factory=list)


class ServerManager:
    """Manages test server lifecycle."""
    
    def __init__(self, config: Optional[ServerConfig] = None):
        self.config = config or ServerConfig()
        self._process: Optional[subprocess.Popen] = None
        self._started = False
    
    async def start(self, cmd: List[str], env: Optional[Dict[str, str]] = None) -> None:
        """Start the server."""
        full_env = os.environ.copy()
        if env:
            full_env.update(env)
        
        self._process = subprocess.Popen(
            cmd,
            env=full_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid,  # Create new process group
        )
        
        # Wait for server to be ready
        start_time = time.time()
        while time.time() - start_time < self.config.startup_timeout:
            if await self._check_health():
                self._started = True
                return
            await asyncio.sleep(0.1)
        
        # Timeout - kill and raise
        await self.stop()
        raise TimeoutError(f"Server failed to start within {self.config.startup_timeout}s")
    
    async def _check_health(self) -> bool:
        """Check server health."""
        import aiohttp
        
        url = f"http://{self.config.host}:{self.config.port}{self.config.health_endpoint}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=1)) as resp:
                    return resp.status == 200
        except Exception:
            return False
    
    async def stop(self) -> None:
        """Stop the server."""
        if self._process:
            try:
                os.killpg(os.getpgid(self._process.pid), signal.SIGTERM)
                self._process.wait(timeout=self.config.shutdown_timeout)
            except Exception:
                os.killpg(os.getpgid(self._process.pid), signal.SIGKILL)
            finally:
                self._process = None
                self._started = False
    
    @property
    def is_running(self) -> bool:
        """Check if server is running."""
        return self._started and self._process is not None
    
    def get_url(self) -> str:
        """Get server URL."""
        return f"http://{self.config.host}:{self.config.port}"
    
    def get_ws_url(self) -> str:
        """Get WebSocket URL."""
        return f"ws://{self.config.host}:{self.config.port}/ws"


class WebSocketRecorder:
    """Records WebSocket messages for verification."""
    
    def __init__(self):
        self._messages: List[Dict[str, Any]] = []
        self._raw_messages: List[str] = []
        self._start_time: Optional[float] = None
    
    def start(self) -> None:
        """Start recording."""
        self._messages = []
        self._raw_messages = []
        self._start_time = time.time()
    
    def record(self, message: str) -> None:
        """Record a message."""
        self._raw_messages.append(message)
        
        try:
            parsed = json.loads(message)
            parsed["_recorded_at"] = time.time() - (self._start_time or 0)
            self._messages.append(parsed)
        except json.JSONDecodeError:
            self._messages.append({
                "_raw": message,
                "_recorded_at": time.time() - (self._start_time or 0),
            })
    
    def get_messages(self, msg_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recorded messages, optionally filtered by type."""
        if msg_type is None:
            return self._messages.copy()
        
        return [m for m in self._messages if m.get("type") == msg_type]
    
    def get_raw_messages(self) -> List[str]:
        """Get raw message strings."""
        return self._raw_messages.copy()
    
    @property
    def message_count(self) -> int:
        """Get message count."""
        return len(self._messages)
    
    def compute_hash(self) -> str:
        """Compute hash of all messages."""
        content = json.dumps(self._raw_messages, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


class VisualVerifier:
    """Verifies visual elements on page."""
    
    def __init__(self, page: Any):
        self._page = page
    
    async def element_exists(self, selector: str) -> bool:
        """Check if element exists."""
        try:
            element = await self._page.query_selector(selector)
            return element is not None
        except Exception:
            return False
    
    async def element_visible(self, selector: str) -> bool:
        """Check if element is visible."""
        try:
            element = await self._page.query_selector(selector)
            if element:
                return await element.is_visible()
            return False
        except Exception:
            return False
    
    async def element_text(self, selector: str) -> Optional[str]:
        """Get element text content."""
        try:
            element = await self._page.query_selector(selector)
            if element:
                return await element.text_content()
            return None
        except Exception:
            return None
    
    async def wait_for_selector(self, selector: str, timeout: float = 5000) -> bool:
        """Wait for selector to appear."""
        try:
            await self._page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception:
            return False
    
    async def screenshot(self, path: str, selector: Optional[str] = None) -> None:
        """Take screenshot."""
        if selector:
            element = await self._page.query_selector(selector)
            if element:
                await element.screenshot(path=path)
        else:
            await self._page.screenshot(path=path)


class ParityE2ERunner:
    """Runs E2E parity tests comparing live vs replay."""
    
    def __init__(
        self,
        live_url: str,
        replay_url: str,
    ):
        self._live_url = live_url
        self._replay_url = replay_url
        self._live_recorder = WebSocketRecorder()
        self._replay_recorder = WebSocketRecorder()
    
    async def run_parity_test(
        self,
        browser: Any,
        duration_ms: int = 5000,
    ) -> Dict[str, Any]:
        """Run parity test between live and replay."""
        # Record live
        live_context = await browser.new_context()
        live_page = await live_context.new_page()
        
        self._live_recorder.start()
        
        await live_page.goto(self._live_url)
        
        # Setup WebSocket listener
        await live_page.evaluate("""
            window._wsMessages = [];
            const ws = new WebSocket(window.WS_URL || 'ws://localhost:8765/ws');
            ws.onmessage = (e) => window._wsMessages.push(e.data);
        """)
        
        await asyncio.sleep(duration_ms / 1000)
        
        live_messages = await live_page.evaluate("window._wsMessages")
        for msg in live_messages:
            self._live_recorder.record(msg)
        
        await live_context.close()
        
        # Record replay
        replay_context = await browser.new_context()
        replay_page = await replay_context.new_page()
        
        self._replay_recorder.start()
        
        await replay_page.goto(self._replay_url)
        
        await replay_page.evaluate("""
            window._wsMessages = [];
            const ws = new WebSocket(window.WS_URL || 'ws://localhost:8765/ws/replay');
            ws.onmessage = (e) => window._wsMessages.push(e.data);
        """)
        
        await asyncio.sleep(duration_ms / 1000)
        
        replay_messages = await replay_page.evaluate("window._wsMessages")
        for msg in replay_messages:
            self._replay_recorder.record(msg)
        
        await replay_context.close()
        
        # Compare
        live_hash = self._live_recorder.compute_hash()
        replay_hash = self._replay_recorder.compute_hash()
        
        return {
            "match": live_hash == replay_hash,
            "live_hash": live_hash,
            "replay_hash": replay_hash,
            "live_count": self._live_recorder.message_count,
            "replay_count": self._replay_recorder.message_count,
        }


@dataclass
class E2ETestResult:
    """Result of an E2E test."""
    
    name: str
    passed: bool
    duration_ms: float
    error: Optional[str] = None
    screenshots: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "passed": self.passed,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "screenshots": self.screenshots,
        }


class E2ETestRunner:
    """Runs E2E tests with reporting."""
    
    def __init__(
        self,
        output_dir: Optional[Path] = None,
    ):
        self._output_dir = output_dir or Path("./e2e-results")
        self._results: List[E2ETestResult] = []
    
    async def run_test(
        self,
        name: str,
        test_fn: Callable,
        context: E2ETestContext,
    ) -> E2ETestResult:
        """Run a single test."""
        start = time.time()
        error = None
        passed = False
        screenshots = []
        
        try:
            await test_fn(context)
            passed = True
        except Exception as e:
            error = str(e)
            
            # Take failure screenshot
            screenshot_path = self._output_dir / f"{name}_failure.png"
            self._output_dir.mkdir(parents=True, exist_ok=True)
            await context.page.screenshot(path=str(screenshot_path))
            screenshots.append(str(screenshot_path))
        
        duration_ms = (time.time() - start) * 1000
        
        result = E2ETestResult(
            name=name,
            passed=passed,
            duration_ms=duration_ms,
            error=error,
            screenshots=screenshots,
        )
        
        self._results.append(result)
        return result
    
    def get_results(self) -> List[E2ETestResult]:
        """Get all results."""
        return self._results.copy()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get results summary."""
        passed = sum(1 for r in self._results if r.passed)
        failed = len(self._results) - passed
        
        return {
            "total": len(self._results),
            "passed": passed,
            "failed": failed,
            "pass_rate": passed / len(self._results) if self._results else 0,
            "total_duration_ms": sum(r.duration_ms for r in self._results),
        }
    
    def write_report(self, path: Optional[Path] = None) -> None:
        """Write JSON report."""
        report_path = path or (self._output_dir / "report.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        report = {
            "summary": self.get_summary(),
            "results": [r.to_dict() for r in self._results],
        }
        
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
