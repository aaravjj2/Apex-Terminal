"""
AI/ML Job Queue Module

Provides a lightweight job queue for orchestrating ML workloads:
- Local execution for small tasks
- Colab Pro integration for GPU-heavy tasks
- Job status tracking and result storage
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from enum import Enum
import threading
import queue
import logging
import hashlib
import json
import uuid

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Job execution status."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Type of ML job."""
    LOCAL = "local"           # Run locally
    COLAB = "colab"           # Run on Colab Pro
    CLOUD_RUN = "cloud_run"   # Run on Cloud Run


@dataclass
class JobSpec:
    """Specification for an ML job."""
    name: str
    job_type: JobType
    entrypoint: str  # Script path or notebook URL
    parameters: Dict[str, Any] = field(default_factory=dict)
    environment: Dict[str, str] = field(default_factory=dict)
    timeout_seconds: int = 3600
    priority: int = 0  # Higher = more priority
    requires_gpu: bool = False
    
    def get_hash(self) -> str:
        """Generate job spec hash for caching."""
        content = json.dumps({
            "name": self.name,
            "entrypoint": self.entrypoint,
            "parameters": self.parameters,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:12]


@dataclass
class JobResult:
    """Result from a completed job."""
    job_id: str
    status: JobStatus
    output_path: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    @property
    def duration_seconds(self) -> Optional[float]:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


@dataclass
class Job:
    """A queued ML job."""
    id: str
    spec: JobSpec
    status: JobStatus = JobStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[JobResult] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.spec.name,
            "type": self.spec.job_type.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "spec_hash": self.spec.get_hash(),
        }


class JobQueue:
    """
    Simple priority queue for ML jobs.
    
    Features:
    - Priority-based execution
    - Worker pool for parallel execution
    - Job status tracking
    - Result persistence
    """
    
    def __init__(self, max_workers: int = 2):
        self.max_workers = max_workers
        self._queue: queue.PriorityQueue = queue.PriorityQueue()
        self._jobs: Dict[str, Job] = {}
        self._workers: List[threading.Thread] = []
        self._running = False
        self._lock = threading.Lock()
        
        # Callbacks
        self._on_job_complete: List[Callable[[Job], None]] = []
        
    def submit(self, spec: JobSpec) -> str:
        """Submit a job to the queue."""
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        job = Job(id=job_id, spec=spec)
        
        with self._lock:
            self._jobs[job_id] = job
            # Priority queue: (priority, timestamp, job_id)
            # Negative priority so higher priority jobs come first
            self._queue.put((-spec.priority, job.created_at.timestamp(), job_id))
            job.status = JobStatus.QUEUED
        
        logger.info(f"Job submitted: {job_id} ({spec.name})")
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        return self._jobs.get(job_id)
    
    def list_jobs(self, status: Optional[JobStatus] = None) -> List[Job]:
        """List jobs, optionally filtered by status."""
        jobs = list(self._jobs.values())
        if status:
            jobs = [j for j in jobs if j.status == status]
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending/queued job."""
        job = self._jobs.get(job_id)
        if not job:
            return False
        
        if job.status in (JobStatus.PENDING, JobStatus.QUEUED):
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            return True
        return False
    
    def start_workers(self):
        """Start worker threads."""
        if self._running:
            return
        
        self._running = True
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"JobWorker-{i}",
                daemon=True
            )
            worker.start()
            self._workers.append(worker)
        
        logger.info(f"Started {self.max_workers} job workers")
    
    def stop_workers(self):
        """Stop worker threads."""
        self._running = False
        # Workers will exit on next iteration
    
    def _worker_loop(self):
        """Worker thread main loop."""
        while self._running:
            try:
                # Block with timeout to allow graceful shutdown
                priority, timestamp, job_id = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue
            
            job = self._jobs.get(job_id)
            if not job or job.status == JobStatus.CANCELLED:
                continue
            
            self._execute_job(job)
    
    def _execute_job(self, job: Job):
        """Execute a single job."""
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        
        logger.info(f"Starting job: {job.id} ({job.spec.name})")
        
        try:
            if job.spec.job_type == JobType.LOCAL:
                result = self._execute_local(job)
            elif job.spec.job_type == JobType.COLAB:
                result = self._execute_colab(job)
            else:
                result = self._execute_cloud_run(job)
            
            job.result = result
            job.status = result.status
            
        except Exception as e:
            logger.error(f"Job failed: {job.id} - {e}")
            job.result = JobResult(
                job_id=job.id,
                status=JobStatus.FAILED,
                error_message=str(e),
                started_at=job.started_at,
                completed_at=datetime.utcnow()
            )
            job.status = JobStatus.FAILED
        
        job.completed_at = datetime.utcnow()
        
        # Fire callbacks
        for callback in self._on_job_complete:
            try:
                callback(job)
            except Exception as e:
                logger.error(f"Job callback error: {e}")
    
    def _execute_local(self, job: Job) -> JobResult:
        """Execute job locally."""
        import subprocess
        import sys
        
        cmd = [sys.executable, job.spec.entrypoint]
        
        # Add parameters as arguments
        for key, value in job.spec.parameters.items():
            cmd.extend([f"--{key}", str(value)])
        
        env = {**dict(job.spec.environment)}
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=job.spec.timeout_seconds,
                env=env
            )
            
            if result.returncode == 0:
                return JobResult(
                    job_id=job.id,
                    status=JobStatus.COMPLETED,
                    metrics={"stdout_lines": len(result.stdout.split('\n'))},
                    started_at=job.started_at,
                    completed_at=datetime.utcnow()
                )
            else:
                return JobResult(
                    job_id=job.id,
                    status=JobStatus.FAILED,
                    error_message=result.stderr,
                    started_at=job.started_at,
                    completed_at=datetime.utcnow()
                )
                
        except subprocess.TimeoutExpired:
            return JobResult(
                job_id=job.id,
                status=JobStatus.FAILED,
                error_message="Job timed out",
                started_at=job.started_at,
                completed_at=datetime.utcnow()
            )
    
    def _execute_colab(self, job: Job) -> JobResult:
        """
        Execute job on Colab Pro.
        
        Note: This is a stub. In production, you would:
        1. Use Google API to trigger notebook execution
        2. Poll for completion
        3. Retrieve results
        """
        logger.info(f"Colab execution requested for: {job.spec.entrypoint}")
        
        # In production, this would make API calls to Colab
        # For now, return a placeholder result
        return JobResult(
            job_id=job.id,
            status=JobStatus.COMPLETED,
            output_path=f"gs://ml-outputs/{job.id}/",
            metrics={"colab": True, "gpu_type": "T4"},
            started_at=job.started_at,
            completed_at=datetime.utcnow()
        )
    
    def _execute_cloud_run(self, job: Job) -> JobResult:
        """Execute job on Cloud Run."""
        logger.info(f"Cloud Run execution requested: {job.spec.entrypoint}")
        
        # Placeholder for Cloud Run execution
        return JobResult(
            job_id=job.id,
            status=JobStatus.COMPLETED,
            output_path=f"gs://ml-outputs/{job.id}/",
            metrics={"cloud_run": True},
            started_at=job.started_at,
            completed_at=datetime.utcnow()
        )
    
    def on_job_complete(self, callback: Callable[[Job], None]):
        """Register callback for job completion."""
        self._on_job_complete.append(callback)


# Pre-defined job specs for common ML tasks
class MLJobTemplates:
    """Pre-built job specifications for common ML tasks."""
    
    @staticmethod
    def train_regime_classifier(
        data_path: str,
        output_path: str,
        epochs: int = 100,
        use_gpu: bool = True
    ) -> JobSpec:
        """Train market regime classifier."""
        return JobSpec(
            name="Train Regime Classifier",
            job_type=JobType.COLAB if use_gpu else JobType.LOCAL,
            entrypoint="notebooks/regime_classifier.ipynb" if use_gpu else "scripts/train_regime.py",
            parameters={
                "data_path": data_path,
                "output_path": output_path,
                "epochs": epochs,
            },
            requires_gpu=use_gpu,
            timeout_seconds=7200,
            priority=5
        )
    
    @staticmethod
    def backtest_strategy(
        strategy_name: str,
        start_date: str,
        end_date: str,
        symbols: List[str]
    ) -> JobSpec:
        """Run strategy backtest."""
        return JobSpec(
            name=f"Backtest: {strategy_name}",
            job_type=JobType.LOCAL,
            entrypoint="scripts/run_backtest.py",
            parameters={
                "strategy": strategy_name,
                "start_date": start_date,
                "end_date": end_date,
                "symbols": ",".join(symbols),
            },
            requires_gpu=False,
            timeout_seconds=1800,
            priority=3
        )
    
    @staticmethod
    def optimize_hyperparameters(
        strategy_name: str,
        search_space: Dict[str, Any],
        n_trials: int = 50
    ) -> JobSpec:
        """Run hyperparameter optimization."""
        return JobSpec(
            name=f"Optimize: {strategy_name}",
            job_type=JobType.COLAB,  # GPU helps with parallel trials
            entrypoint="notebooks/hyperopt.ipynb",
            parameters={
                "strategy": strategy_name,
                "search_space": json.dumps(search_space),
                "n_trials": n_trials,
            },
            requires_gpu=True,
            timeout_seconds=14400,  # 4 hours
            priority=2
        )
    
    @staticmethod
    def generate_signals(
        model_path: str,
        symbols: List[str]
    ) -> JobSpec:
        """Generate trading signals from trained model."""
        return JobSpec(
            name="Generate Signals",
            job_type=JobType.LOCAL,
            entrypoint="scripts/generate_signals.py",
            parameters={
                "model_path": model_path,
                "symbols": ",".join(symbols),
            },
            requires_gpu=False,
            timeout_seconds=300,
            priority=10  # High priority for signal generation
        )


# Global job queue instance
_job_queue: Optional[JobQueue] = None


def get_job_queue() -> JobQueue:
    """Get or create the global job queue."""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue(max_workers=2)
        _job_queue.start_workers()
    return _job_queue


def submit_job(spec: JobSpec) -> str:
    """Convenience function to submit a job."""
    return get_job_queue().submit(spec)


def get_job_status(job_id: str) -> Optional[Dict]:
    """Get job status as dict."""
    job = get_job_queue().get_job(job_id)
    return job.to_dict() if job else None
