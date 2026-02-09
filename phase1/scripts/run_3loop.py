#!/usr/bin/env python3
"""
3-Loop Test Runner for CI/CD.

Executes:
1. Unit tests
2. Integration tests
3. Parity tests
4. (Optional) E2E Playwright tests

Continues looping until all tests pass or max iterations reached.
"""

import subprocess
import sys
import time
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse


@dataclass
class LoopTestResult:
    """Result of a test run (renamed to avoid pytest collection)."""
    
    name: str
    passed: int
    failed: int
    skipped: int
    errors: int
    duration_seconds: float
    output: str = ""
    
    @property
    def success(self) -> bool:
        return self.failed == 0 and self.errors == 0
    
    @property
    def total(self) -> int:
        return self.passed + self.failed + self.skipped + self.errors


@dataclass
class LoopResult:
    """Result of one complete loop."""
    
    iteration: int
    unit: LoopTestResult
    integration: LoopTestResult
    parity: LoopTestResult
    e2e: Optional[LoopTestResult] = None
    
    @property
    def all_passed(self) -> bool:
        results = [self.unit, self.integration, self.parity]
        if self.e2e:
            results.append(self.e2e)
        return all(r.success for r in results)


class LoopTestRunner:
    """Runs pytest and parses results (renamed to avoid pytest collection)."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
    
    def run_pytest(
        self,
        name: str,
        pattern: str,
        extra_args: Optional[List[str]] = None,
    ) -> LoopTestResult:
        """Run pytest with given pattern."""
        args = [
            sys.executable, "-m", "pytest",
            "-v",
            "--tb=short",
            "-q",
        ]
        
        if extra_args:
            args.extend(extra_args)
        
        args.append(pattern)
        
        start = time.time()
        
        result = subprocess.run(
            args,
            cwd=self.project_root,
            capture_output=True,
            text=True,
        )
        
        duration = time.time() - start
        output = result.stdout + result.stderr
        
        return self._parse_result(name, output, duration)
    
    def _parse_result(
        self,
        name: str,
        output: str,
        duration: float,
    ) -> LoopTestResult:
        """Parse pytest output."""
        passed = 0
        failed = 0
        skipped = 0
        errors = 0
        
        # Look for summary line
        for line in output.split('\n'):
            line_lower = line.lower()
            
            if 'passed' in line_lower:
                import re
                match = re.search(r'(\d+) passed', line_lower)
                if match:
                    passed = int(match.group(1))
            
            if 'failed' in line_lower:
                import re
                match = re.search(r'(\d+) failed', line_lower)
                if match:
                    failed = int(match.group(1))
            
            if 'skipped' in line_lower:
                import re
                match = re.search(r'(\d+) skipped', line_lower)
                if match:
                    skipped = int(match.group(1))
            
            if 'error' in line_lower:
                import re
                match = re.search(r'(\d+) error', line_lower)
                if match:
                    errors = int(match.group(1))
        
        return LoopTestResult(
            name=name,
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
            duration_seconds=duration,
            output=output,
        )


class ThreeLoopRunner:
    """Runs the 3-loop test strategy."""
    
    def __init__(
        self,
        project_root: Path,
        max_iterations: int = 3,
        include_e2e: bool = False,
    ):
        self.project_root = project_root
        self.max_iterations = max_iterations
        self.include_e2e = include_e2e
        self.runner = LoopTestRunner(project_root)
        self.results: List[LoopResult] = []
    
    def run(self) -> Tuple[bool, List[LoopResult]]:
        """Run until success or max iterations."""
        for i in range(1, self.max_iterations + 1):
            print(f"\n{'='*60}")
            print(f"ITERATION {i}/{self.max_iterations}")
            print('='*60)
            
            loop_result = self._run_iteration(i)
            self.results.append(loop_result)
            
            self._print_summary(loop_result)
            
            if loop_result.all_passed:
                print(f"\n✅ ALL TESTS PASSED on iteration {i}!")
                return True, self.results
            
            print(f"\n⚠️ Some tests failed, continuing to iteration {i+1}...")
        
        print(f"\n❌ Max iterations ({self.max_iterations}) reached with failures")
        return False, self.results
    
    def _run_iteration(self, iteration: int) -> LoopResult:
        """Run one complete iteration."""
        print("\n[1/4] Running Unit Tests...")
        unit = self.runner.run_pytest(
            "Unit Tests",
            "tests/unit/",
        )
        
        print("\n[2/4] Running Integration Tests...")
        integration = self.runner.run_pytest(
            "Integration Tests",
            "tests/integration/",
        )
        
        print("\n[3/4] Running Parity Tests...")
        parity = self.runner.run_pytest(
            "Parity Tests",
            "tests/parity/",
        )
        
        e2e = None
        if self.include_e2e:
            print("\n[4/4] Running E2E Tests...")
            e2e = self.runner.run_pytest(
                "E2E Tests",
                "tests/e2e/",
                extra_args=["--headed"] if False else [],  # headless by default
            )
        
        return LoopResult(
            iteration=iteration,
            unit=unit,
            integration=integration,
            parity=parity,
            e2e=e2e,
        )
    
    def _print_summary(self, result: LoopResult) -> None:
        """Print iteration summary."""
        print(f"\n--- Iteration {result.iteration} Summary ---")
        
        for test_result in [result.unit, result.integration, result.parity]:
            status = "✅" if test_result.success else "❌"
            print(
                f"{status} {test_result.name}: "
                f"{test_result.passed} passed, "
                f"{test_result.failed} failed, "
                f"{test_result.skipped} skipped "
                f"({test_result.duration_seconds:.2f}s)"
            )
        
        if result.e2e:
            status = "✅" if result.e2e.success else "❌"
            print(
                f"{status} {result.e2e.name}: "
                f"{result.e2e.passed} passed, "
                f"{result.e2e.failed} failed "
                f"({result.e2e.duration_seconds:.2f}s)"
            )
    
    def write_report(self, path: Path) -> None:
        """Write JSON report."""
        report = {
            "iterations": len(self.results),
            "success": self.results[-1].all_passed if self.results else False,
            "results": [],
        }
        
        for result in self.results:
            iteration_data = {
                "iteration": result.iteration,
                "all_passed": result.all_passed,
                "tests": {
                    "unit": {
                        "passed": result.unit.passed,
                        "failed": result.unit.failed,
                        "skipped": result.unit.skipped,
                    },
                    "integration": {
                        "passed": result.integration.passed,
                        "failed": result.integration.failed,
                        "skipped": result.integration.skipped,
                    },
                    "parity": {
                        "passed": result.parity.passed,
                        "failed": result.parity.failed,
                        "skipped": result.parity.skipped,
                    },
                },
            }
            
            if result.e2e:
                iteration_data["tests"]["e2e"] = {
                    "passed": result.e2e.passed,
                    "failed": result.e2e.failed,
                    "skipped": result.e2e.skipped,
                }
            
            report["results"].append(iteration_data)
        
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(report, f, indent=2)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="3-Loop Test Runner")
    
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path("."),
        help="Project root directory",
    )
    
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=3,
        help="Maximum test iterations",
    )
    
    parser.add_argument(
        "--include-e2e",
        action="store_true",
        help="Include E2E Playwright tests",
    )
    
    parser.add_argument(
        "--report",
        type=Path,
        help="Output report path",
    )
    
    args = parser.parse_args()
    
    runner = ThreeLoopRunner(
        project_root=args.project_root.absolute(),
        max_iterations=args.max_iterations,
        include_e2e=args.include_e2e,
    )
    
    success, results = runner.run()
    
    if args.report:
        runner.write_report(args.report)
        print(f"\nReport written to {args.report}")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
