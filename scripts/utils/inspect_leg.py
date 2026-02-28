
try:
    from alpaca.trading.requests import OptionLegRequest
    print("=== OptionLegRequest Fields ===")
    print(OptionLegRequest.__annotations__)

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Error: {e}")
