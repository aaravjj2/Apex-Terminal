#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/bars/AAPL/1m"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri, ping_interval=None) as ws:
            print("✓ Connected!")
            
            # Get SUBSCRIBED message
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            print(f"✓ {data['type']}: {data.get('symbol', '')}")
            
            # Listen for 40 seconds
            print("Listening for 40s...")
            start = asyncio.get_event_loop().time()
            heartbeats = 0
            
            while asyncio.get_event_loop().time() - start < 40:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    if data['type'] == 'HEARTBEAT':
                        heartbeats += 1
                        elapsed = asyncio.get_event_loop().time() - start
                        print(f"  ❤️  Heartbeat #{heartbeats} at {elapsed:.1f}s")
                        # Respond
                        await ws.send(json.dumps({"action": "ping"}))
                except asyncio.TimeoutError:
                    continue
            
            print(f"\n✓ Connection stable! {heartbeats} heartbeats in 40s")
            return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test())
    exit(0 if success else 1)
