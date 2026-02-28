
try:
    from alpaca.trading.requests import OrderRequest, MarketOrderRequest, LimitOrderRequest
    from alpaca.trading.enums import OrderClass
    import inspect

    print("=== OrderRequest Fields ===")
    print(OrderRequest.__annotations__)
    
    print("\n=== MarketOrderRequest Fields ===")
    print(MarketOrderRequest.__annotations__)

    print("\n=== OrderClass Enum ===")
    for x in OrderClass:
        print(f"{x.name}: {x.value}")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Error: {e}")
