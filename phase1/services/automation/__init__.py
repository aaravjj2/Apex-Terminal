"""
Automation Module
-----------------
Provides n8n workflow export, job queue, and automation orchestration.
"""

from .n8n_export import (
    N8nNode,
    N8nWorkflow,
    N8nConnection,
    WorkflowTemplates,
    export_all_templates,
)

from .job_queue import (
    Job,
    JobSpec,
    JobResult,
    JobStatus,
    JobType,
    JobQueue,
    MLJobTemplates,
    get_job_queue,
    submit_job,
    get_job_status,
)

__all__ = [
    # n8n exports
    "N8nNode",
    "N8nWorkflow",
    "N8nConnection",
    "WorkflowTemplates",
    "export_all_templates",
    # Job queue
    "Job",
    "JobSpec",
    "JobResult",
    "JobStatus",
    "JobType",
    "JobQueue",
    "MLJobTemplates",
    "get_job_queue",
    "submit_job",
    "get_job_status",
]
