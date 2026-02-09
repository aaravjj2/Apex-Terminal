
# MCP Playwright Smoke Test: ElevenLabs TTS

Use this guide to verify the ElevenLabs Text-to-Speech integration using the Playwright MCP server.

## Prerequisites
- Backend running on port 8000
- Frontend running on port 5100
- Playwright MCP server running

## Smoke Test Steps

1.  **Open Application**
    - Navigate to `http://localhost:5100`
    - Verify "VOICE OFF" toggle is visible in the top right bar.

2.  **Enable Voice**
    - Click "VOICE OFF".
    - Verify it changes to "VOICE ON" and volume slider appears.
    - Screenshot: `devpost_media/elevenlabs/01_voice_enabled.png`

3.  **Navigate to Autopilot**
    - Click "Autopilot" in left nav.
    - Ensure proposals are loaded (or trigger a run).

4.  **Test Speech**
    - Locate a candidate card.
    - Click "🔊 Speak Rationale".
    - Verify console log or network activity (mocked or real).
    - Screenshot: `devpost_media/elevenlabs/02_speak_clicked.png`

## Automated Execution via MCP
You can automate this flow with the following MCP tool calls (pseudo-code):

```json
[
  {
    "tool": "playwright_navigate",
    "args": { "url": "http://localhost:5100" }
  },
  {
    "tool": "playwright_click",
    "args": { "selector": "text=VOICE OFF" }
  },
  {
    "tool": "playwright_screenshot",
    "args": { "path": "devpost_media/elevenlabs/01_voice_enabled.png" }
  }
]
```
