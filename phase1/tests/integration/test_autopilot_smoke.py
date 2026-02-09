import time
from services.automation.job_queue import submit_job, get_job_status, JobSpec, JobType
import os


def test_autopilot_noop_job_completes():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    entry = os.path.join(repo_root, 'scripts', 'noop.py')
    assert os.path.exists(entry), f"noop script not found at {entry}"
    spec = JobSpec(name="noop", job_type=JobType.LOCAL, entrypoint=entry)
    job_id = submit_job(spec)

    # Poll for completion
    for _ in range(100):
        st = get_job_status(job_id)
        if st and st['status'] in ('completed', 'failed'):
            break
        time.sleep(0.05)

    st = get_job_status(job_id)
    assert st is not None
    assert st['status'] == 'completed'
