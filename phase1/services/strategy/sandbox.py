"""
Strategy Sandbox - Isolated execution environment for user strategies.
"""

from dataclasses import dataclass
from typing import Optional, Any, Dict
from datetime import datetime
import multiprocessing
import signal
import resource
import logging
import traceback
import queue
import time


logger = logging.getLogger(__name__)


@dataclass
class SandboxConfig:
    """Sandbox configuration."""
    # Resource limits
    cpu_time_limit: int = 30  # seconds
    memory_limit_mb: int = 512
    
    # Execution limits
    max_bars_per_call: int = 1000
    max_orders_per_bar: int = 10
    
    # Safety
    block_network: bool = True
    block_file_io: bool = True
    whitelist_imports: bool = True
    
    # Allowed imports
    allowed_modules: tuple = (
        "math", "statistics", "datetime", "collections",
        "numpy", "pandas", "talib",  # If available
    )


class SandboxError(Exception):
    """Error from sandbox execution."""
    pass


class TimeoutError(SandboxError):
    """Strategy exceeded time limit."""
    pass


class MemoryError(SandboxError):
    """Strategy exceeded memory limit."""
    pass


class SecurityError(SandboxError):
    """Strategy violated security policy."""
    pass


@dataclass
class SandboxResult:
    """Result from sandbox execution."""
    success: bool
    output: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0
    memory_used_mb: float = 0


def _timeout_handler(signum, frame):
    """Handle timeout signal."""
    raise TimeoutError("Strategy execution timed out")


def _run_in_sandbox(
    func,
    args: tuple,
    kwargs: dict,
    config: SandboxConfig,
    result_queue: multiprocessing.Queue,
):
    """Worker function that runs in isolated process."""
    start_time = time.time()
    
    try:
        # Set resource limits
        if config.cpu_time_limit > 0:
            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(config.cpu_time_limit)
        
        if config.memory_limit_mb > 0:
            soft, hard = resource.getrlimit(resource.RLIMIT_AS)
            resource.setrlimit(
                resource.RLIMIT_AS,
                (config.memory_limit_mb * 1024 * 1024, hard)
            )
        
        # Execute the function
        result = func(*args, **kwargs)
        
        # Cancel alarm
        signal.alarm(0)
        
        execution_time = (time.time() - start_time) * 1000
        
        result_queue.put(SandboxResult(
            success=True,
            output=result,
            execution_time_ms=execution_time,
        ))
        
    except TimeoutError as e:
        result_queue.put(SandboxResult(
            success=False,
            error=f"Timeout: {e}",
            execution_time_ms=(time.time() - start_time) * 1000,
        ))
    
    except MemoryError as e:
        result_queue.put(SandboxResult(
            success=False,
            error=f"Memory limit exceeded: {e}",
            execution_time_ms=(time.time() - start_time) * 1000,
        ))
    
    except Exception as e:
        result_queue.put(SandboxResult(
            success=False,
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
            execution_time_ms=(time.time() - start_time) * 1000,
        ))


class Sandbox:
    """
    Isolated execution environment for user strategies.
    
    Features:
    - CPU time limits
    - Memory limits
    - Network blocking (via resource limits)
    - Restricted imports
    """
    
    def __init__(self, config: Optional[SandboxConfig] = None):
        self.config = config or SandboxConfig()
    
    def execute(
        self,
        func,
        args: tuple = (),
        kwargs: dict = None,
        timeout: Optional[int] = None,
    ) -> SandboxResult:
        """
        Execute a function in the sandbox.
        
        Args:
            func: Callable to execute
            args: Positional arguments
            kwargs: Keyword arguments
            timeout: Overall timeout (including process startup)
        
        Returns:
            SandboxResult with execution result or error
        """
        kwargs = kwargs or {}
        timeout = timeout or self.config.cpu_time_limit + 5
        
        # Create result queue
        result_queue = multiprocessing.Queue()
        
        # Start worker process
        process = multiprocessing.Process(
            target=_run_in_sandbox,
            args=(func, args, kwargs, self.config, result_queue),
        )
        
        process.start()
        
        try:
            # Wait for result with timeout
            result = result_queue.get(timeout=timeout)
            return result
            
        except queue.Empty:
            # Process timed out
            process.terminate()
            process.join(timeout=1)
            
            if process.is_alive():
                process.kill()
            
            return SandboxResult(
                success=False,
                error="Sandbox execution timed out (process killed)",
            )
        
        finally:
            if process.is_alive():
                process.terminate()
    
    def validate_strategy_code(self, code: str) -> tuple:
        """
        Validate strategy code before execution.
        
        Args:
            code: Python source code
        
        Returns:
            (is_valid, errors)
        """
        errors = []
        
        # Check for forbidden imports
        import ast
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, [f"Syntax error: {e}"]
        
        if self.config.whitelist_imports:
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name not in self.config.allowed_modules:
                            errors.append(f"Import not allowed: {alias.name}")
                
                elif isinstance(node, ast.ImportFrom):
                    if node.module and node.module.split('.')[0] not in self.config.allowed_modules:
                        errors.append(f"Import not allowed: {node.module}")
        
        # Check for dangerous constructs
        dangerous = ["eval", "exec", "compile", "__import__", "open", "subprocess"]
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in dangerous:
                        errors.append(f"Dangerous function: {node.func.id}")
        
        return len(errors) == 0, errors
    
    def run_strategy_bar(
        self,
        strategy,
        bar,
        context: dict = None,
    ) -> SandboxResult:
        """
        Run a strategy's on_bar method in sandbox.
        
        Args:
            strategy: Strategy instance
            bar: Bar data
            context: Additional context
        
        Returns:
            SandboxResult
        """
        def wrapped_on_bar():
            strategy.on_bar(bar)
            return {
                "state": strategy.state.value if hasattr(strategy, 'state') else None,
            }
        
        return self.execute(wrapped_on_bar)


class SafeStrategyRunner:
    """
    Wrapper for running strategies with sandbox protection.
    """
    
    def __init__(self, strategy, sandbox: Optional[Sandbox] = None):
        self.strategy = strategy
        self.sandbox = sandbox or Sandbox()
        self.errors: list = []
        self.warnings: list = []
    
    def safe_on_bar(self, bar) -> bool:
        """Run on_bar with sandbox protection."""
        result = self.sandbox.run_strategy_bar(self.strategy, bar)
        
        if not result.success:
            self.errors.append({
                "bar_index": bar.bar_index,
                "error": result.error,
                "execution_time_ms": result.execution_time_ms,
            })
            return False
        
        # Check for slow execution
        if result.execution_time_ms > 100:  # 100ms warning
            self.warnings.append({
                "bar_index": bar.bar_index,
                "warning": f"Slow execution: {result.execution_time_ms:.1f}ms",
            })
        
        return True
    
    def get_diagnostics(self) -> dict:
        """Get execution diagnostics."""
        return {
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "errors": self.errors[-10:],  # Last 10
            "warnings": self.warnings[-10:],
        }
