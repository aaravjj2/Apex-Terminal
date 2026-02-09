# ElevenLabs TTS Integration

## Overview
We integrated ElevenLabs to give the autopilot a voice. It can now read out trade rationales and alerts.

## Features
- **Voice Agent**: "Rachel" (Voice ID: `21m00Tcm4TlvDq8ikWAM`).
- **Caching**: Audio files are cached in SQLite to save API costs and reduce latency.
- **Frontend Control**: Global mute/volume toggle in the top bar.
- **Queueing**: `AudioQueue` manages sequential playback to prevent overlap.

## Usage
1. **Enable**: Click "VOICE OFF" in the top bar to enable.
2. **Speak**: Click "Speak Rationale" on any Autopilot proposal card.

## Configuration
Set `ELEVENLABS_API_KEY` in `keys.env`.
