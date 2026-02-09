# QC Pattern A Port - Instructions

## Overview
Pattern A separates decision logic (AutopilotBrain) from execution (QC Adapter).

## Directory Structure
- `phase1/autopilot_brain`: Source of truth for decision logic.
- `qc/AutopilotQC_v1`: The QuantConnect algorithm.
- `qc/Library/AutopilotBrain`: The shared library copy for QC.

## Workflow
1. Modify logic in `phase1/autopilot_brain`.
2. Run tests: `python3 -m unittest discover tests/brain`
3. Sync to QC: `python3 scripts/sync_brain.py`
4. Run QC Backtest (via Lean or Web).
