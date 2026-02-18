"""
Unit tests for 3-Loop Runner.

Tests cover:
- Test result parsing
- Loop execution
- Reporting
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
import subprocess

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from scripts.run_3loop import (
    LoopTestResult,
    LoopResult,
    LoopTestRunner,
    ThreeLoopRunner,
)


class TestLoopTestResult:
    """Tests for LoopTestResult."""
    
    def test_success_when_no_failures(self):
        """Should be success when no failures or errors."""
        result = LoopTestResult(
            name="test",
            passed=10,
            failed=0,
            skipped=0,
            errors=0,
            duration_seconds=1.0,
        )
        
        assert result.success is True
    
    def test_not_success_when_failed(self):
        """Should not be success when failed > 0."""
        result = LoopTestResult(
            name="test",
            passed=9,
            failed=1,
            skipped=0,
            errors=0,
            duration_seconds=1.0,
        )
        
        assert result.success is False
    
    def test_not_success_when_errors(self):
        """Should not be success when errors > 0."""
        result = LoopTestResult(
            name="test",
            passed=10,
            failed=0,
            skipped=0,
            errors=1,
            duration_seconds=1.0,
        )
        
        assert result.success is False
    
    def test_total(self):
        """Should sum all counts."""
        result = LoopTestResult(
            name="test",
            passed=5,
            failed=2,
            skipped=1,
            errors=1,
            duration_seconds=1.0,
        )
        
        assert result.total == 9


class TestLoopResult:
    """Tests for LoopResult."""
    
    def test_all_passed_when_success(self):
        """Should return True when all tests pass."""
        result = LoopResult(
            iteration=1,
            unit=LoopTestResult("unit", 10, 0, 0, 0, 1.0),
            integration=LoopTestResult("int", 5, 0, 0, 0, 1.0),
            parity=LoopTestResult("parity", 3, 0, 0, 0, 1.0),
        )
        
        assert result.all_passed is True
    
    def test_not_all_passed_when_unit_fails(self):
        """Should return False when unit tests fail."""
        result = LoopResult(
            iteration=1,
            unit=LoopTestResult("unit", 9, 1, 0, 0, 1.0),
            integration=LoopTestResult("int", 5, 0, 0, 0, 1.0),
            parity=LoopTestResult("parity", 3, 0, 0, 0, 1.0),
        )
        
        assert result.all_passed is False
    
    def test_with_e2e(self):
        """Should include E2E in check."""
        result = LoopResult(
            iteration=1,
            unit=LoopTestResult("unit", 10, 0, 0, 0, 1.0),
            integration=LoopTestResult("int", 5, 0, 0, 0, 1.0),
            parity=LoopTestResult("parity", 3, 0, 0, 0, 1.0),
            e2e=LoopTestResult("e2e", 2, 1, 0, 0, 1.0),
        )
        
        assert result.all_passed is False


class TestLoopTestRunnerClass:
    """Tests for LoopTestRunner."""
    
    def test_parse_passed_output(self):
        """Should parse passed count."""
        runner = LoopTestRunner(Path("."))
        
        output = "10 passed in 1.23s"
        result = runner._parse_result("test", output, 1.23)
        
        assert result.passed == 10
    
    def test_parse_failed_output(self):
        """Should parse failed count."""
        runner = LoopTestRunner(Path("."))
        
        output = "8 passed, 2 failed in 1.23s"
        result = runner._parse_result("test", output, 1.23)
        
        assert result.passed == 8
        assert result.failed == 2
    
    def test_parse_skipped_output(self):
        """Should parse skipped count."""
        runner = LoopTestRunner(Path("."))
        
        output = "10 passed, 1 skipped in 1.23s"
        result = runner._parse_result("test", output, 1.23)
        
        assert result.skipped == 1


class TestThreeLoopRunner:
    """Tests for ThreeLoopRunner."""
    
    def test_initialization(self):
        """Should initialize with defaults."""
        runner = ThreeLoopRunner(Path("."))
        
        assert runner.max_iterations == 3
        assert runner.include_e2e is False
    
    def test_write_report(self, tmp_path):
        """Should write JSON report."""
        runner = ThreeLoopRunner(tmp_path)
        
        runner.results = [
            LoopResult(
                iteration=1,
                unit=LoopTestResult("unit", 10, 0, 0, 0, 1.0),
                integration=LoopTestResult("int", 5, 0, 0, 0, 1.0),
                parity=LoopTestResult("parity", 3, 0, 0, 0, 1.0),
            )
        ]
        
        report_path = tmp_path / "report.json"
        runner.write_report(report_path)
        
        assert report_path.exists()
        
        import json
        with open(report_path) as f:
            data = json.load(f)
        
        assert data["success"] is True
        assert data["iterations"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
