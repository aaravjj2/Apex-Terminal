import sys
import os
sys.path.append(os.getcwd())

from services.config import get_settings

try:
    s = get_settings()
    print(f"Key loaded: {bool(s.apca_api_key_id)}")
    print(f"Secret loaded: {bool(s.apca_api_secret_key)}")
    print(f"Key (masked): {s.apca_api_key_id[:4]}... if existing")

    print("\nAttempting TradingClient init...")
    from alpaca.trading.client import TradingClient
    client = TradingClient(
        api_key=s.apca_api_key_id,
        secret_key=s.apca_api_secret_key,
        paper=True
    )
    print("TradingClient initialized successfully")
    print(f"Account check: {client.get_account().id}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
