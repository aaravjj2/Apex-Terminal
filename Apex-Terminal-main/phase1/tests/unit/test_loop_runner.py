"""
Tests for 3-Loop Test Runner Module.

Tests the automated testing loop infrastructure.
"""

import pytest
import tempfile
import os
from pathlib import Path

from services.charting.loop_runner import (
    LoopPhase,
    LoopTestStatus,
    LoopSingleTestResult,
    LoopIteration,
    LoopConfig,
    LoopState,
    LoopTestDiscovery,
    LoopReporter,
    ThreeLoopRunner,
    LoopOrchestrator,
    create_loop_runner,
)


# ============================================================================
# LoopPhase Tests
# ============================================================================

class TestLoopPhase:
    """Tests for LoopPhase enum."""
    
    def test_all_phases_exist(self):
        """Test all phases exist."""
        assert LoopPhase.UNIT_TEST is not None
        assert LoopPhase.INTEGRATION is not None
        assert LoopPhase.VISUAL_PARITY is not None
        assert LoopPhase.E2E is not None


# ============================================================================
# LoopTestStatus Tests
# ============================================================================

class TestLoopTestStatusClass:
    """Tests for LoopTestStatus enum."""
    
    def test_all_statuses_exist(self):
        """Test all statuses exist."""
        assert LoopTestStatus.PENDING is not None
        assert LoopTestStatus.RUNNING is not None
        assert LoopTestStatus.PASSED is not None
        assert LoopTestStatus.FAILED is not None
        assert LoopTestStatus.SKIPPED is not None
        assert LoopTestStatus.ERROR is not None


# ============================================================================
# LoopSingleTestResult Tests
# ============================================================================

class TestLoopSingleTestResultClass:
    """Tests for LoopSingleTestResult class."""
    
    def test_create_passed_result(self):
        """Test creating passed result."""
        result = LoopSingleTestResult(
            name="test_example",
            status=LoopTestStatus.PASSED,
            phase=LoopPhase.UNIT_TEST,
            duration_ms=50.0,
        )
        
        assert result.name == "test_example"
        assert result.status == LoopTestStatus.PASSED
        assert result.duration_ms == 50.0
    
    def test_create_failed_result(self):
        """Test creating failed result."""
        result = LoopSingleTestResult(
            name="test_failure",
            status=LoopTestStatus.FAILED,
            phase=LoopPhase.UNIT_TEST,
            error_message="Assertion failed",
        )
        
        assert result.status == LoopTestStatus.FAILED
        assert result.error_message == "Assertion failed"
    
    def test_visual_result(self):
        """Test visual test result."""
        result = LoopSingleTestResult(
            name="visual_test",
            status=LoopTestStatus.FAILED,
            phase=LoopPhase.VISUAL_PARITY,
            diff_percentage=1.5,
            pixel_diff_count=1000,
        )
        
        assert result.diff_percentage == 1.5
        assert result.pixel_diff_count == 1000
    
    def test_to_dict(self):
        """Test converting to dict."""
        result = LoopSingleTestResult(
            name="test",
            status=LoopTestStatus.PASSED,
            phase=LoopPhase.UNIT_TEST,
        )
        
        d = result.to_dict()
        
        assert d["name"] == "test"
        assert d["status"] == "PASSED"
        assert d["phase"] == "UNIT_TEST"


# ============================================================================
# LoopIteration Tests
# ============================================================================

class TestLoopIteration:
    """Tests for LoopIteration class."""
    
    def test_create_iteration(self):
        """Test creating iteration."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=1000.0,
        )
        
        assert iteration.iteration_number == 1
        assert iteration.start_time == 1000.0
    
    def test_duration_calculation(self):
        """Test duration calculation."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=1.0,
            end_time=2.5,
        )
        
        assert iteration.duration_ms == 1500.0
    
    def test_test_counts(self):
        """Test counting tests."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=0,
        )
        
        iteration.unit_results = [
            LoopSingleTestResult("test1", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            LoopSingleTestResult("test2", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            LoopSingleTestResult("test3", LoopTestStatus.FAILED, LoopPhase.UNIT_TEST),
        ]
        
        assert iteration.total_tests == 3
        assert iteration.passed_tests == 2
        assert iteration.failed_tests == 1
    
    def test_is_successful(self):
        """Test success check."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=0,
        )
        
        iteration.unit_results = [
            LoopSingleTestResult("test1", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            LoopSingleTestResult("test2", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
        ]
        
        assert iteration.is_successful
    
    def test_is_not_successful_with_failure(self):
        """Test failure detection."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=0,
        )
        
        iteration.unit_results = [
            LoopSingleTestResult("test1", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            LoopSingleTestResult("test2", LoopTestStatus.FAILED, LoopPhase.UNIT_TEST),
        ]
        
        assert not iteration.is_successful
    
    def test_is_not_successful_with_skip(self):
        """Test skip detection."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=0,
        )
        
        iteration.unit_results = [
            LoopSingleTestResult("test1", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            LoopSingleTestResult("test2", LoopTestStatus.SKIPPED, LoopPhase.UNIT_TEST),
        ]
        
        assert not iteration.is_successful
    
    def test_to_dict(self):
        """Test converting to dict."""
        iteration = LoopIteration(
            iteration_number=1,
            start_time=0,
            end_time=1,
        )
        
        d = iteration.to_dict()
        
        assert d["iteration"] == 1
        assert "unit_results" in d


# ============================================================================
# LoopConfig Tests
# ============================================================================

class TestLoopConfig:
    """Tests for LoopConfig class."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = LoopConfig()
        
        assert config.max_iterations == 10
        assert config.stop_on_success is True
        assert config.run_unit_tests is True
        assert config.pixel_tolerance == 0
    
    def test_custom_config(self):
        """Test custom configuration."""
        config = LoopConfig(
            max_iterations=5,
            pixel_tolerance=5,
            test_dir="custom_tests",
        )
        
        assert config.max_iterations == 5
        assert config.pixel_tolerance == 5
        assert config.test_dir == "custom_tests"


# ============================================================================
# LoopState Tests
# ============================================================================

class TestLoopState:
    """Tests for LoopState class."""
    
    def test_initial_state(self):
        """Test initial state."""
        state = LoopState()
        
        assert state.current_iteration == 0
        assert state.is_running is False
        assert state.is_complete is False
    
    def test_get_current_iteration(self):
        """Test getting current iteration."""
        state = LoopState()
        state.current_iteration = 1
        state.iterations.append(LoopIteration(1, 0))
        
        current = state.get_current_iteration()
        
        assert current is not None
        assert current.iteration_number == 1
    
    def test_to_dict(self):
        """Test converting to dict."""
        state = LoopState()
        state.current_iteration = 1
        state.is_running = True
        
        d = state.to_dict()
        
        assert d["current_iteration"] == 1
        assert d["is_running"] is True


# ============================================================================
# TestDiscovery Tests
# ============================================================================

class TestLoopTestDiscoveryClass:
    """Tests for LoopTestDiscovery class."""
    
    def test_create_discovery(self):
        """Test creating discovery."""
        discovery = LoopTestDiscovery("tests")
        assert discovery is not None
    
    def test_discover_nonexistent_dir(self):
        """Test discovering from nonexistent directory."""
        discovery = LoopTestDiscovery("/nonexistent/path")
        
        assert discovery.discover_unit_tests() == []
        assert discovery.discover_integration_tests() == []
        assert discovery.discover_e2e_tests() == []
    
    def test_discover_unit_tests(self):
        """Test discovering unit tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            unit_dir = Path(tmpdir) / "unit"
            unit_dir.mkdir()
            (unit_dir / "test_example.py").touch()
            (unit_dir / "test_another.py").touch()
            (unit_dir / "not_a_test.py").touch()
            
            discovery = LoopTestDiscovery(tmpdir)
            tests = discovery.discover_unit_tests()
            
            assert len(tests) == 2
    
    def test_discover_visual_tests_from_manifest(self):
        """Test discovering visual tests from manifest."""
        import json
        
        with tempfile.TemporaryDirectory() as tmpdir:
            golden_dir = Path(tmpdir)
            manifest = {
                "test_chart": {"path": "test_chart.png"},
                "test_tooltip": {"path": "test_tooltip.png"},
            }
            
            with open(golden_dir / "manifest.json", "w") as f:
                json.dump(manifest, f)
            
            discovery = LoopTestDiscovery("tests")
            tests = discovery.discover_visual_tests(str(golden_dir))
            
            assert len(tests) == 2


# ============================================================================
# LoopReporter Tests
# ============================================================================

class TestLoopReporter:
    """Tests for LoopReporter class."""
    
    def test_create_reporter(self):
        """Test creating reporter."""
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = LoopReporter(tmpdir)
            assert reporter is not None
    
    def test_generate_summary(self):
        """Test generating summary."""
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = LoopReporter(tmpdir)
            
            state = LoopState()
            state.iterations.append(LoopIteration(1, 0, end_time=1))
            state.iterations[0].unit_results = [
                LoopSingleTestResult("test1", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST),
            ]
            
            summary = reporter.generate_summary(state)
            
            assert "3-LOOP TEST RUNNER SUMMARY" in summary
            assert "Iteration 1" in summary
    
    def test_generate_json_report(self):
        """Test generating JSON report."""
        import json
        
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = LoopReporter(tmpdir)
            
            state = LoopState()
            state.current_iteration = 1
            
            report = reporter.generate_json_report(state)
            
            data = json.loads(report)
            assert data["current_iteration"] == 1
    
    def test_save_report(self):
        """Test saving report."""
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = LoopReporter(tmpdir)
            
            state = LoopState()
            state.iterations.append(LoopIteration(1, 0, end_time=1))
            
            path = reporter.save_report(state)
            
            assert os.path.exists(path)
            assert os.path.exists(path.replace(".txt", ".json"))


# ============================================================================
# ThreeLoopRunner Tests
# ============================================================================

class TestThreeLoopRunner:
    """Tests for ThreeLoopRunner class."""
    
    def test_create_runner(self):
        """Test creating runner."""
        config = LoopConfig()
        runner = ThreeLoopRunner(config)
        
        assert runner is not None
        assert runner.config == config
    
    def test_run_single_iteration(self):
        """Test running single iteration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            
            state = runner.run()
            
            assert state.is_complete
            assert len(state.iterations) == 1
    
    def test_stop_on_success(self):
        """Test stopping on success."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=10,
                stop_on_success=True,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            
            state = runner.run()
            
            # Should stop after first successful iteration
            assert len(state.iterations) == 1
    
    def test_custom_runners(self):
        """Test with custom test runners."""
        def custom_unit_runner(tests):
            return [
                LoopSingleTestResult("custom_test", LoopTestStatus.PASSED, LoopPhase.UNIT_TEST)
            ]
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(test_dir=tmpdir, output_dir=tmpdir)
            runner = ThreeLoopRunner(
                config,
                unit_runner=custom_unit_runner,
            )
            
            state = runner.run()
            
            assert state.is_complete
    
    def test_phase_listener(self):
        """Test phase change listener."""
        phases = []
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            runner.on_phase_change(lambda p: phases.append(p))
            
            runner.run()
            
            assert len(phases) > 0
    
    def test_iteration_listener(self):
        """Test iteration complete listener."""
        iterations = []
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            runner.on_iteration_complete(lambda i: iterations.append(i))
            
            runner.run()
            
            assert len(iterations) == 1
    
    def test_completion_listener(self):
        """Test completion listener."""
        final_states = []
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            runner.on_complete(lambda s: final_states.append(s))
            
            runner.run()
            
            assert len(final_states) == 1
            assert final_states[0].is_complete
    
    def test_get_report(self):
        """Test getting report."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            runner = ThreeLoopRunner(config)
            runner.run()
            
            report = runner.get_report()
            
            assert "3-LOOP" in report


# ============================================================================
# LoopOrchestrator Tests
# ============================================================================

class TestLoopOrchestrator:
    """Tests for LoopOrchestrator class."""
    
    def test_create_orchestrator(self):
        """Test creating orchestrator."""
        orchestrator = LoopOrchestrator()
        assert orchestrator is not None
    
    def test_add_runner(self):
        """Test adding runner."""
        orchestrator = LoopOrchestrator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(test_dir=tmpdir, output_dir=tmpdir)
            runner = ThreeLoopRunner(config)
            
            orchestrator.add_runner("test", runner)
            
            assert "test" in orchestrator._runners
    
    def test_remove_runner(self):
        """Test removing runner."""
        orchestrator = LoopOrchestrator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(test_dir=tmpdir, output_dir=tmpdir)
            runner = ThreeLoopRunner(config)
            
            orchestrator.add_runner("test", runner)
            orchestrator.remove_runner("test")
            
            assert "test" not in orchestrator._runners
    
    def test_run_all(self):
        """Test running all runners."""
        orchestrator = LoopOrchestrator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            
            orchestrator.add_runner("runner1", ThreeLoopRunner(config))
            orchestrator.add_runner("runner2", ThreeLoopRunner(config))
            
            results = orchestrator.run_all()
            
            assert "runner1" in results
            assert "runner2" in results
    
    def test_run_one(self):
        """Test running one runner."""
        orchestrator = LoopOrchestrator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            
            orchestrator.add_runner("test", ThreeLoopRunner(config))
            
            result = orchestrator.run_one("test")
            
            assert result is not None
            assert result.is_complete
    
    def test_get_aggregate_summary(self):
        """Test getting aggregate summary."""
        orchestrator = LoopOrchestrator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config = LoopConfig(
                max_iterations=1,
                test_dir=tmpdir,
                output_dir=tmpdir,
            )
            
            orchestrator.add_runner("runner1", ThreeLoopRunner(config))
            orchestrator.run_all()
            
            summary = orchestrator.get_aggregate_summary()
            
            assert "runners" in summary
            assert "total_passed" in summary
            assert "all_passed" in summary


# ============================================================================
# create_loop_runner Tests
# ============================================================================

class TestCreateLoopRunner:
    """Tests for create_loop_runner function."""
    
    def test_create_default_runner(self):
        """Test creating runner with defaults."""
        runner = create_loop_runner()
        
        assert runner is not None
        assert runner.config.max_iterations == 10
    
    def test_create_custom_runner(self):
        """Test creating runner with custom settings."""
        runner = create_loop_runner(
            test_dir="custom_tests",
            max_iterations=5,
            pixel_tolerance=3,
        )
        
        assert runner.config.test_dir == "custom_tests"
        assert runner.config.max_iterations == 5
        assert runner.config.pixel_tolerance == 3
