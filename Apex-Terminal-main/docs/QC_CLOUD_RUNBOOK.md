# QC Cloud Runbook

If local Docker execution is not possible, use the QC Cloud.

## 1. Prepare Project
1.  Log in to [QuantConnect](https://www.quantconnect.com/).
2.  Create New Algorithm -> "AutopilotQC_v1".
3.  **Upload Files** (Maintain this structure):
    *   `main.py`
    *   `adapter/` folder:
        *   `rolling_store.py`
        *   `snapshot_builder.py`
        *   `state_store.py`
        *   `order_router.py`
    *   `autopilot_brain/` folder (as Library or Package):
        *   `types.py`
        *   `inference.py` (and others)
    *   *Tip:* If using the Web UI, you may need to drag-and-drop the entire `qc/AutopilotQC_v1` content EXCEPT the folder itself, or correct the imports if creating a flat project.

## 2. Shared Library (Phase 1 Brain)
1.  The `autopilot_brain` package must be reachable.
2.  In cloud, you may need to structure it as `library/autopilot_brain` or paste the logic files directly if imports fail.

## 3. Configure Backtest
1.  Set Dates: `2023-01-03` to `2023-01-31`.
2.  Set Cash: `100000`.
3.  Click **Backtest**.

## 4. Verify Output
1.  **Logs**: Inspect the console.
    *   Search "Snapshot:" to count scans.
    *   Search "History Calls" (Should be 2).
    *   Search "ORDER:" -> Should be 0 (Dry Run).
2.  **Object Store**:
    *   Go to "Object Store" tab in results.
    *   Verify `tape/2023-01-xx/scan-XXXX.json` files exist.
