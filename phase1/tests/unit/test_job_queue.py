"""
Tests for AI/ML job queue module.
"""
import pytest
import time
from datetime import datetime

from services.automation.job_queue import (
    Job,
    JobSpec,
    JobResult,
    JobStatus,
    JobType,
    JobQueue,
    MLJobTemplates,
)


class TestJobSpec:
    """Tests for JobSpec dataclass."""
    
    def test_basic_spec(self):
        spec = JobSpec(
            name="Test Job",
            job_type=JobType.LOCAL,
            entrypoint="test.py",
            parameters={"arg1": "value1"}
        )
        
        assert spec.name == "Test Job"
        assert spec.job_type == JobType.LOCAL
        assert spec.timeout_seconds == 3600  # default
    
    def test_spec_hash(self):
        spec = JobSpec(
            name="Test",
            job_type=JobType.LOCAL,
            entrypoint="test.py",
            parameters={"x": 1}
        )
        
        hash1 = spec.get_hash()
        assert len(hash1) == 12
        
        # Same spec should have same hash
        spec2 = JobSpec(
            name="Test",
            job_type=JobType.LOCAL,
            entrypoint="test.py",
            parameters={"x": 1}
        )
        assert spec.get_hash() == spec2.get_hash()
        
        # Different params = different hash
        spec3 = JobSpec(
            name="Test",
            job_type=JobType.LOCAL,
            entrypoint="test.py",
            parameters={"x": 2}
        )
        assert spec.get_hash() != spec3.get_hash()


class TestJob:
    """Tests for Job dataclass."""
    
    def test_job_creation(self):
        spec = JobSpec("Test", JobType.LOCAL, "test.py")
        job = Job(id="job_123", spec=spec)
        
        assert job.id == "job_123"
        assert job.status == JobStatus.PENDING
        assert job.created_at is not None
    
    def test_job_to_dict(self):
        spec = JobSpec("Test", JobType.COLAB, "notebook.ipynb")
        job = Job(id="job_456", spec=spec)
        
        d = job.to_dict()
        assert d["id"] == "job_456"
        assert d["name"] == "Test"
        assert d["type"] == "colab"
        assert d["status"] == "pending"


class TestJobResult:
    """Tests for JobResult dataclass."""
    
    def test_result_duration(self):
        result = JobResult(
            job_id="job_1",
            status=JobStatus.COMPLETED,
            started_at=datetime(2026, 1, 1, 10, 0, 0),
            completed_at=datetime(2026, 1, 1, 10, 5, 30)
        )
        
        assert result.duration_seconds == 330  # 5 min 30 sec
    
    def test_result_no_duration_when_incomplete(self):
        result = JobResult(
            job_id="job_2",
            status=JobStatus.RUNNING,
            started_at=datetime(2026, 1, 1, 10, 0, 0)
        )
        
        assert result.duration_seconds is None


class TestJobQueue:
    """Tests for JobQueue."""
    
    def test_submit_job(self):
        queue = JobQueue(max_workers=1)
        spec = JobSpec("Test Submit", JobType.LOCAL, "test.py")
        
        job_id = queue.submit(spec)
        
        assert job_id.startswith("job_")
        assert queue.get_job(job_id) is not None
        assert queue.get_job(job_id).status == JobStatus.QUEUED
    
    def test_list_jobs(self):
        queue = JobQueue(max_workers=1)
        
        queue.submit(JobSpec("Job 1", JobType.LOCAL, "t.py"))
        queue.submit(JobSpec("Job 2", JobType.LOCAL, "t.py"))
        queue.submit(JobSpec("Job 3", JobType.LOCAL, "t.py"))
        
        jobs = queue.list_jobs()
        assert len(jobs) == 3
    
    def test_list_jobs_filtered(self):
        queue = JobQueue(max_workers=1)
        
        job_id = queue.submit(JobSpec("Job 1", JobType.LOCAL, "t.py"))
        queue.cancel_job(job_id)
        queue.submit(JobSpec("Job 2", JobType.LOCAL, "t.py"))
        
        queued = queue.list_jobs(status=JobStatus.QUEUED)
        cancelled = queue.list_jobs(status=JobStatus.CANCELLED)
        
        assert len(queued) == 1
        assert len(cancelled) == 1
    
    def test_cancel_job(self):
        queue = JobQueue(max_workers=1)
        spec = JobSpec("Cancel Test", JobType.LOCAL, "test.py")
        
        job_id = queue.submit(spec)
        assert queue.cancel_job(job_id) is True
        
        job = queue.get_job(job_id)
        assert job.status == JobStatus.CANCELLED
    
    def test_cannot_cancel_completed_job(self):
        queue = JobQueue(max_workers=1)
        spec = JobSpec("Test", JobType.LOCAL, "test.py")
        
        job_id = queue.submit(spec)
        job = queue.get_job(job_id)
        job.status = JobStatus.COMPLETED  # Simulate completion
        
        assert queue.cancel_job(job_id) is False


class TestMLJobTemplates:
    """Tests for pre-built ML job templates."""
    
    def test_regime_classifier_spec(self):
        spec = MLJobTemplates.train_regime_classifier(
            data_path="/data/bars.csv",
            output_path="/models/regime",
            epochs=50
        )
        
        assert "Regime" in spec.name
        assert spec.job_type == JobType.COLAB
        assert spec.requires_gpu is True
        assert spec.parameters["epochs"] == 50
    
    def test_backtest_spec(self):
        spec = MLJobTemplates.backtest_strategy(
            strategy_name="mean_reversion",
            start_date="2025-01-01",
            end_date="2025-12-31",
            symbols=["AAPL", "MSFT"]
        )
        
        assert "Backtest" in spec.name
        assert spec.job_type == JobType.LOCAL
        assert "AAPL,MSFT" in spec.parameters["symbols"]
    
    def test_optimize_spec(self):
        spec = MLJobTemplates.optimize_hyperparameters(
            strategy_name="trend_following",
            search_space={"lookback": [10, 50], "threshold": [0.01, 0.05]},
            n_trials=100
        )
        
        assert "Optimize" in spec.name
        assert spec.job_type == JobType.COLAB
        assert spec.parameters["n_trials"] == 100
    
    def test_signals_spec(self):
        spec = MLJobTemplates.generate_signals(
            model_path="/models/classifier.pt",
            symbols=["SPY", "QQQ"]
        )
        
        assert "Signal" in spec.name
        assert spec.job_type == JobType.LOCAL
        assert spec.priority == 10  # High priority
