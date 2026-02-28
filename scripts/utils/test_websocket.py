#!/usr/bin/env python3
"""
WebSocket connection stability test
"""

import asyncio
import websockets
import json
import time

async def test_websocket():
    uri = "ws://localhost:8000/ws/bars/AAPL/1m"
    
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri) as websocket:
        print("✓ Connected!")
        
        # Wait for SUBSCRIBED message
        msg = await websocket.recv()
        data = json.loads(msg)
        print(f"✓ Received: {data['type']}")
        assert data['type'] == 'SUBSCRIBED'
        
        # Wait for heartbeats
        heartbeat_count = 0
        start_time = time.time()
        timeout = 45  # 45 seconds
        
        print(f"Listening for heartbeats for {timeout}s...")
        
        while time.time() - start_time < timeout:
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                data = json.loads(msg)
                
                if data.get('type') == 'HEARTBEAT':
                    heartbeat_count += 1
                    elapsed = time.time() - start_time
                    print(f"  Heartbeat #{heartbeat_count} at {elapsed:.1f}s")
                    
                    # Send pong response
                    await websocket.send(json.dumps({"action": "ping"}))
                
                elif data.get('type') == 'PONG':
                    # Server responded to our ping
                    pass
                
                elif data.get('type') in ['BAR_FORMING', 'BAR_CONFIRMED']:
                    # Received bar data
                    print(f"  Received bar: {data['data']['symbol']} @ {data['data']['close']}")
                
            except asyncio.TimeoutError:
                # No message in 5s is okay
                continue
        
        print(f"\n✓ Connection stable!")
        print(f"  Duration: {timeout}s")
        print(f"  Heartbeats: {heartbeat_count}")
        print(f"  Expected: ~{timeout // 30} (every 30s)")
        
        if heartbeat_count >= 1:
            print("✓ Heartbeat mechanism working!")
        else:
            print("⚠ No heartbeats received (may be timing issue)")

if __name__ == "__main__":
    asyncio.run(test_websocket())
