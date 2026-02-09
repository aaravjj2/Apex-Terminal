import shutil
import os

SOURCE = "phase1/autopilot_brain"
DEST_LIB = "qc/Library/AutopilotBrain/autopilot_brain"

def sync():
    if os.path.exists(DEST_LIB):
        shutil.rmtree(DEST_LIB)
    
    shutil.copytree(SOURCE, DEST_LIB)
    print(f"Synced {SOURCE} -> {DEST_LIB}")

if __name__ == "__main__":
    sync()
