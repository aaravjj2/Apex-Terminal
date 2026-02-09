"""
3-Loop Test Runner Module.

Implements the automated bug-fix → Playwright snapshot → E2E loop
for iterative visual testing until zero failures.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Callable, Any
from enum import Enum, auto
from pathlib import Path
import json
import time
import hashlib


class LoopPhase(Enum):
    """Phases of the 3-loop testing cycle."""
    
    UNIT_TEST = auto()      # Phase 1: Unit tests
    INTEGRATION = auto()    # Phase 2: Integration tests
    VISUAL_PARITY = auto()  # Phase 3: Visual comparison
    E2E = auto()            # Phase 4: End-to-end Playwright


class LoopTestStatus(Enum):
    """Status of a test run (renamed to avoid pytest collection)."""
    
    PENDING = auto()
    RUNNING = auto()
    PASSED = auto()
    FAILED = auto()
    SKIPPED = auto()
    ERROR = auto()


@dataclass
class LoopSingleTestResult:
    """Result of a single test (renamed to avoid pytest collection)."""
    
    name: str
    status: LoopTestStatus
    phase: LoopPhase
    duration_ms: float = 0.0
    error_message: str = ""
    stack_trace: str = ""
    attempts: int = 1
    
    # For visual tests
    diff_percentage: float = 0.0
    pixel_diff_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "status": self.status.name,
            "phase": self.phase.name,
            "duration_ms": self.duration_ms,
            "error_message": self.error_message,
            "attempts": self.attempts,
            "diff_percentage": self.diff_percentage,
            "pixel_diff_count": self.pixel_diff_count,
        }


@dataclass
class LoopIteration:
    """Single iteration of the test loop."""
    
    iteration_number: int
    start_time: float
    end_time: float = 0.0
    
    unit_results: List[LoopSingleTestResult] = field(default_factory=list)
    integration_results: List[LoopSingleTestResult] = field(default_factory=list)
    visual_results: List[LoopSingleTestResult] = field(default_factory=list)
    e2e_results: List[LoopSingleTestResult] = field(default_factory=list)
    
    fixes_applied: List[str] = field(default_factory=list)
    
    @property
    def duration_ms(self) -> float:
        """Total duration in milliseconds."""
        if self.end_time == 0:
            return 0
        return (self.end_time - self.start_time) * 1000
    
    @property
    def total_tests(self) -> int:
        """Total number of tests."""
        return (
            len(self.unit_results) +
            len(self.integration_results) +
            len(self.visual_results) +
            len(self.e2e_results)
        )
    
    @property
    def passed_tests(self) -> int:
        """Number of passed tests."""
        all_results = (
            self.unit_results +
            self.integration_results +
            self.visual_results +
            self.e2e_results
        )
        return sum(1 for r in all_results if r.status == LoopTestStatus.PASSED)
    
    @property
    def failed_tests(self) -> int:
        """Number of failed tests."""
        all_results = (
            self.unit_results +
            self.integration_results +
            self.visual_results +
            self.e2e_results
        )
        return sum(1 for r in all_results if r.status == LoopTestStatus.FAILED)
    
    @property
    def skipped_tests(self) -> int:
        """Number of skipped tests."""
        all_results = (
            self.unit_results +
            self.integration_results +
            self.visual_results +
            self.e2e_results
        )
        return sum(1 for r in all_results if r.status == LoopTestStatus.SKIPPED)
    
    @property
    def is_successful(self) -> bool:
        """Check if iteration succeeded (no failures or skips)."""
        return self.failed_tests == 0 and self.skipped_tests == 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "iteration": self.iteration_number,
            "duration_ms": self.duration_ms,
            "total_tests": self.total_tests,
            "passed": self.passed_tests,
            "failed": self.failed_tests,
            "skipped": self.skipped_tests,
            "is_successful": self.is_successful,
            "fixes_applied": self.fixes_applied,
            "unit_results": [r.to_dict() for r in self.unit_results],
            "integration_results": [r.to_dict() for r in self.integration_results],
            "visual_results": [r.to_dict() for r in self.visual_results],
            "e2e_results": [r.to_dict() for r in self.e2e_results],
        }


@dataclass
class LoopConfig:
    """Configuration for the test loop."""
    
    max_iterations: int = 10
    stop_on_success: bool = True
    retry_failed_only: bool = True
    
    # Phase enablement
    run_unit_tests: bool = True
    run_integration_tests: bool = True
    run_visual_tests: bool = True
    run_e2e_tests: bool = True
    
    # Timeouts
    unit_timeout_ms: int = 60000
    integration_timeout_ms: int = 120000
    visual_timeout_ms: int = 180000
    e2e_timeout_ms: int = 300000
    
    # Paths
    test_dir: str = "tests"
    golden_dir: str = "tests/golden"
    output_dir: str = "test-results"
    
    # Visual test settings
    pixel_tolerance: int = 0  # 0 = exact match required
    update_golden_on_pass: bool = False


@dataclass
class LoopState:
    """Current state of the test loop."""
    
    current_iteration: int = 0
    current_phase: LoopPhase = LoopPhase.UNIT_TEST
    is_running: bool = False
    is_complete: bool = False
    
    iterations: List[LoopIteration] = field(default_factory=list)
    
    # Statistics
    total_fixes_applied: int = 0
    total_time_ms: float = 0.0
    
    def get_current_iteration(self) -> Optional[LoopIteration]:
        """Get current iteration."""
        if self.iterations and self.current_iteration <= len(self.iterations):
            return self.iterations[self.current_iteration - 1]
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "current_iteration": self.current_iteration,
            "current_phase": self.current_phase.name,
            "is_running": self.is_running,
            "is_complete": self.is_complete,
            "total_fixes_applied": self.total_fixes_applied,
            "total_time_ms": self.total_time_ms,
            "iterations": [i.to_dict() for i in self.iterations],
        }


class LoopTestDiscovery:
    """
    Discovers tests to run (renamed to avoid pytest collection).
    
    Scans directories and collects test files/functions.
    """
    
    def __init__(self, test_dir: str):
        self._test_dir = Path(test_dir)
    
    def discover_unit_tests(self) -> List[str]:
        """Discover unit test files."""
        if not self._test_dir.exists():
            return []
        
        unit_dir = self._test_dir / "unit"
        if not unit_dir.exists():
            return []
        
        tests = []
        for f in unit_dir.glob("test_*.py"):
            tests.append(str(f))
        
        return sorted(tests)
    
    def discover_integration_tests(self) -> List[str]:
        """Discover integration test files."""
        if not self._test_dir.exists():
            return []
        
        int_dir = self._test_dir / "integration"
        if not int_dir.exists():
            return []
        
        tests = []
        for f in int_dir.glob("test_*.py"):
            tests.append(str(f))
        
        return sorted(tests)
    
    def discover_e2e_tests(self) -> List[str]:
        """Discover E2E test files."""
        if not self._test_dir.exists():
            return []
        
        e2e_dir = self._test_dir / "e2e"
        if not e2e_dir.exists():
            return []
        
        tests = []
        for f in e2e_dir.glob("test_*.py"):
            tests.append(str(f))
        
        return sorted(tests)
    
    def discover_visual_tests(self, golden_dir: str) -> List[str]:
        """Discover visual test golden images."""
        golden_path = Path(golden_dir)
        if not golden_path.exists():
            return []
        
        tests = []
        manifest_path = golden_path / "manifest.json"
        
        if manifest_path.exists():
            with open(manifest_path) as f:
                manifest = json.load(f)
                tests = list(manifest.keys())
        else:
            for f in golden_path.glob("*.png"):
                tests.append(f.stem)
        
        return sorted(tests)


class LoopReporter:
    """
    Generates reports for test loop results.
    
    Creates human-readable and machine-parseable reports.
    """
    
    def __init__(self, output_dir: str):
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_summary(self, state: LoopState) -> str:
        """Generate text summary."""
        lines = [
            "=" * 60,
            "3-LOOP TEST RUNNER SUMMARY",
            "=" * 60,
            "",
            f"Total Iterations: {len(state.iterations)}",
            f"Total Time: {state.total_time_ms:.2f}ms",
            f"Fixes Applied: {state.total_fixes_applied}",
            f"Status: {'SUCCESS' if state.is_complete and state.iterations[-1].is_successful else 'FAILED'}",
            "",
        ]
        
        for iteration in state.iterations:
            lines.append(f"Iteration {iteration.iteration_number}:")
            lines.append(f"  - Passed: {iteration.passed_tests}")
            lines.append(f"  - Failed: {iteration.failed_tests}")
            lines.append(f"  - Skipped: {iteration.skipped_tests}")
            lines.append(f"  - Duration: {iteration.duration_ms:.2f}ms")
            
            if iteration.fixes_applied:
                lines.append(f"  - Fixes: {', '.join(iteration.fixes_applied)}")
            lines.append("")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def generate_json_report(self, state: LoopState) -> str:
        """Generate JSON report."""
        return json.dumps(state.to_dict(), indent=2)
    
    def save_report(self, state: LoopState, name: str = "loop-report") -> str:
        """Save reports to disk."""
        # Text report
        text_path = self._output_dir / f"{name}.txt"
        with open(text_path, "w") as f:
            f.write(self.generate_summary(state))
        
        # JSON report
        json_path = self._output_dir / f"{name}.json"
        with open(json_path, "w") as f:
            f.write(self.generate_json_report(state))
        
        return str(text_path)


# Type aliases for test runners
LoopTestRunner = Callable[[List[str]], List[LoopSingleTestResult]]
FixFunction = Callable[[List[LoopSingleTestResult]], List[str]]


class ThreeLoopRunner:
    """
    Main 3-loop test runner.
    
    Orchestrates the bug-fix → visual parity → E2E cycle.
    """
    
    def __init__(
        self,
        config: LoopConfig,
        unit_runner: Optional[LoopTestRunner] = None,
        integration_runner: Optional[LoopTestRunner] = None,
        visual_runner: Optional[LoopTestRunner] = None,
        e2e_runner: Optional[LoopTestRunner] = None,
        fix_function: Optional[FixFunction] = None,
    ):
        self._config = config
        self._state = LoopState()
        self._discovery = LoopTestDiscovery(config.test_dir)
        self._reporter = LoopReporter(config.output_dir)
        
        # Test runners
        self._unit_runner = unit_runner or self._default_test_runner
        self._integration_runner = integration_runner or self._default_test_runner
        self._visual_runner = visual_runner or self._default_visual_runner
        self._e2e_runner = e2e_runner or self._default_test_runner
        self._fix_function = fix_function
        
        # Listeners
        self._phase_listeners: List[Callable[[LoopPhase], None]] = []
        self._iteration_listeners: List[Callable[[LoopIteration], None]] = []
        self._completion_listeners: List[Callable[[LoopState], None]] = []
    
    @property
    def state(self) -> LoopState:
        """Get current state."""
        return self._state
    
    @property
    def config(self) -> LoopConfig:
        """Get configuration."""
        return self._config
    
    def on_phase_change(self, callback: Callable[[LoopPhase], None]) -> None:
        """Register phase change listener."""
        self._phase_listeners.append(callback)
    
    def on_iteration_complete(self, callback: Callable[[LoopIteration], None]) -> None:
        """Register iteration complete listener."""
        self._iteration_listeners.append(callback)
    
    def on_complete(self, callback: Callable[[LoopState], None]) -> None:
        """Register completion listener."""
        self._completion_listeners.append(callback)
    
    def _notify_phase(self, phase: LoopPhase) -> None:
        """Notify phase listeners."""
        for listener in self._phase_listeners:
            listener(phase)
    
    def _notify_iteration(self, iteration: LoopIteration) -> None:
        """Notify iteration listeners."""
        for listener in self._iteration_listeners:
            listener(iteration)
    
    def _notify_complete(self) -> None:
        """Notify completion listeners."""
        for listener in self._completion_listeners:
            listener(self._state)
    
    def _default_test_runner(self, tests: List[str]) -> List[LoopSingleTestResult]:
        """Default test runner (placeholder)."""
        results = []
        for test in tests:
            results.append(LoopSingleTestResult(
                name=test,
                status=LoopTestStatus.PASSED,
                phase=LoopPhase.UNIT_TEST,
                duration_ms=10.0,
            ))
        return results
    
    def _default_visual_runner(self, tests: List[str]) -> List[LoopSingleTestResult]:
        """Default visual test runner (placeholder)."""
        results = []
        for test in tests:
            results.append(LoopSingleTestResult(
                name=test,
                status=LoopTestStatus.PASSED,
                phase=LoopPhase.VISUAL_PARITY,
                duration_ms=50.0,
            ))
        return results
    
    def run(self) -> LoopState:
        """
        Run the complete test loop.
        
        Returns final state with all results.
        """
        self._state = LoopState()
        self._state.is_running = True
        start_time = time.time()
        
        try:
            for i in range(1, self._config.max_iterations + 1):
                iteration = self._run_iteration(i)
                self._state.iterations.append(iteration)
                self._notify_iteration(iteration)
                
                if iteration.is_successful and self._config.stop_on_success:
                    break
                
                # Apply fixes if we have a fix function
                if not iteration.is_successful and self._fix_function:
                    all_failed = [
                        r for r in (
                            iteration.unit_results +
                            iteration.integration_results +
                            iteration.visual_results +
                            iteration.e2e_results
                        )
                        if r.status == LoopTestStatus.FAILED
                    ]
                    
                    fixes = self._fix_function(all_failed)
                    iteration.fixes_applied = fixes
                    self._state.total_fixes_applied += len(fixes)
        
        finally:
            self._state.is_running = False
            self._state.is_complete = True
            self._state.total_time_ms = (time.time() - start_time) * 1000
            self._notify_complete()
        
        return self._state
    
    def _run_iteration(self, iteration_number: int) -> LoopIteration:
        """Run single iteration."""
        self._state.current_iteration = iteration_number
        iteration = LoopIteration(
            iteration_number=iteration_number,
            start_time=time.time(),
        )
        
        # Phase 1: Unit Tests
        if self._config.run_unit_tests:
            self._state.current_phase = LoopPhase.UNIT_TEST
            self._notify_phase(LoopPhase.UNIT_TEST)
            
            tests = self._discovery.discover_unit_tests()
            if tests:
                iteration.unit_results = self._unit_runner(tests)
        
        # Phase 2: Integration Tests
        if self._config.run_integration_tests:
            self._state.current_phase = LoopPhase.INTEGRATION
            self._notify_phase(LoopPhase.INTEGRATION)
            
            tests = self._discovery.discover_integration_tests()
            if tests:
                iteration.integration_results = self._integration_runner(tests)
        
        # Phase 3: Visual Parity
        if self._config.run_visual_tests:
            self._state.current_phase = LoopPhase.VISUAL_PARITY
            self._notify_phase(LoopPhase.VISUAL_PARITY)
            
            tests = self._discovery.discover_visual_tests(self._config.golden_dir)
            if tests:
                iteration.visual_results = self._visual_runner(tests)
        
        # Phase 4: E2E Tests
        if self._config.run_e2e_tests:
            self._state.current_phase = LoopPhase.E2E
            self._notify_phase(LoopPhase.E2E)
            
            tests = self._discovery.discover_e2e_tests()
            if tests:
                iteration.e2e_results = self._e2e_runner(tests)
        
        iteration.end_time = time.time()
        return iteration
    
    def get_report(self) -> str:
        """Get summary report."""
        return self._reporter.generate_summary(self._state)
    
    def save_report(self) -> str:
        """Save report to disk."""
        return self._reporter.save_report(self._state)


def create_loop_runner(
    test_dir: str = "tests",
    golden_dir: str = "tests/golden",
    output_dir: str = "test-results",
    max_iterations: int = 10,
    pixel_tolerance: int = 0,
) -> ThreeLoopRunner:
    """
    Create a configured 3-loop test runner.
    
    Args:
        test_dir: Directory containing tests
        golden_dir: Directory containing golden images
        output_dir: Directory for test results
        max_iterations: Maximum loop iterations
        pixel_tolerance: Pixel comparison tolerance (0 = exact)
    """
    config = LoopConfig(
        max_iterations=max_iterations,
        test_dir=test_dir,
        golden_dir=golden_dir,
        output_dir=output_dir,
        pixel_tolerance=pixel_tolerance,
    )
    
    return ThreeLoopRunner(config)


class LoopOrchestrator:
    """
    High-level orchestrator for the testing workflow.
    
    Manages multiple loop runners and aggregates results.
    """
    
    def __init__(self):
        self._runners: Dict[str, ThreeLoopRunner] = {}
        self._results: Dict[str, LoopState] = {}
    
    def add_runner(self, name: str, runner: ThreeLoopRunner) -> None:
        """Add a runner."""
        self._runners[name] = runner
    
    def remove_runner(self, name: str) -> None:
        """Remove a runner."""
        if name in self._runners:
            del self._runners[name]
    
    def run_all(self) -> Dict[str, LoopState]:
        """Run all registered runners."""
        self._results = {}
        
        for name, runner in self._runners.items():
            self._results[name] = runner.run()
        
        return self._results
    
    def run_one(self, name: str) -> Optional[LoopState]:
        """Run a specific runner."""
        if name not in self._runners:
            return None
        
        result = self._runners[name].run()
        self._results[name] = result
        return result
    
    def get_results(self) -> Dict[str, LoopState]:
        """Get all results."""
        return self._results.copy()
    
    def get_aggregate_summary(self) -> Dict[str, Any]:
        """Get aggregate summary across all runners."""
        total_passed = 0
        total_failed = 0
        total_skipped = 0
        total_time = 0.0
        
        for state in self._results.values():
            if state.iterations:
                last = state.iterations[-1]
                total_passed += last.passed_tests
                total_failed += last.failed_tests
                total_skipped += last.skipped_tests
            total_time += state.total_time_ms
        
        return {
            "runners": len(self._runners),
            "total_passed": total_passed,
            "total_failed": total_failed,
            "total_skipped": total_skipped,
            "total_time_ms": total_time,
            "all_passed": total_failed == 0 and total_skipped == 0,
        }
