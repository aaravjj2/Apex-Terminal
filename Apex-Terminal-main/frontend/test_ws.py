import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/bars/AAPL/1m"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            # Wait for a message or just hold connection
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"Received: {msg}")
            except asyncio.TimeoutError:
                print("No message received in 5s (expected if market closed)")
            
            # Keep open for a bit
            await asyncio.sleep(2)
            print("Connection still open")
    except Exception as e:
        print(f"WS Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
