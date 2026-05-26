#!/usr/bin/env python3
"""
Daemonize Apex backend with auto-restart and crash-loop backoff.
Run as: python3 scripts/daemon.py [port]
"""
import os
import sys
import time
import signal
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = sys.argv[1] if len(sys.argv) > 1 else "8001"
LOG_PATH = os.path.join(ROOT, "apex-backend.log")
PID_PATH = os.path.join(ROOT, ".apex-backend.pid")
PYBIN = os.path.join(ROOT, "phase1", "venv", "bin", "python")


def daemonize() -> None:
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    os.chdir(ROOT)
    devnull = os.open(os.devnull, os.O_RDONLY)
    log = os.open(LOG_PATH, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(devnull, 0)
    os.dup2(log, 1)
    os.dup2(log, 2)
    os.close(devnull)
    os.close(log)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)


def run_loop() -> None:
    backoff = 1
    with open(PID_PATH, "w") as f:
        f.write(str(os.getpid()))
    while True:
        sys.stderr.write(f"[daemon] starting uvicorn on :{PORT}\n")
        sys.stderr.flush()
        proc = subprocess.Popen(
            [
                PYBIN, "-m", "uvicorn", "services.api.main:app",
                "--host", "0.0.0.0", "--port", PORT,
                "--app-dir", os.path.join(ROOT, "phase1"),
                "--workers", "1",
                "--timeout-keep-alive", "30",
                "--log-level", "info",
            ],
            cwd=os.path.join(ROOT, "phase1"),
            stdin=subprocess.DEVNULL,
        )
        rc = proc.wait()
        sys.stderr.write(f"[daemon] uvicorn exited rc={rc}; restarting in {backoff}s\n")
        sys.stderr.flush()
        time.sleep(backoff)
        backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    daemonize()
    run_loop()
