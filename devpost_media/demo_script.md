# AI Vibe Coding Hackathon - Demo Script

**Project:** Autonomous TradingView Recreation
**Duration:** 2-3 minutes
**Tone:** Technical, confident, energetic

## 0:00-0:05 | Title Card
**Visual:** Project logo or dashboard with title overlay.
**Voiceover:** "Welcome to the Autonomous TradingView Recreation – a self-hosted, deterministic trading platform with an AI autopilot that trades for you."

## 0:05-0:35 | The Charting Engine
**Visual:** Dashboard showing live charts. Cursor switches symbols (AAPL -> MSFT).
**Voiceover:** "At its core is a high-performance, deterministic Bar Engine built with FastAPI. It streams tick-level data via WebSockets to a React frontend, rendering millions of candles with sub-millisecond latency. Whether it's historical playback or live market data, the experience is seamless."

## 0:35-1:15 | Autopilot & AI Logic
**Visual:** Clicking "Autopilot" view. Showing "Run Cycle". List of candidates appears.
**Voiceover:** "But the real magic is the Autopilot. This isn't just a chart – it's an agent. The system autonomously scans the market, identifying trade candidates using customizable patterns. It scores them using a pluggable Logic Engine – which can even use LLMs for qualitative analysis."

## 1:15-1:45 | Execution & Monitoring
**Visual:** Trade being selected. Notification of "Order Placed". Switching to "Portfolio" view showing the open position.
**Voiceover:** "Once a trade is validated, the Execution Engine routes it to Alpaca. Here, we see a live paper trade execution. The system manages the entire lifecycle – creating orders, tracking fills, and monitoring risk in real-time."

## 1:45-2:15 | Exit Logic & Robustness
**Visual:** Monitoring view. Showing logs or "Exit Rules".
**Voiceover:** "It doesn't sleep. The Position Monitor continuously evaluates sophisticated exit conditions – take profit, stop loss, or time-based exits – ensuring your strategy is executed with robotic precision."

## 2:15-2:30 | Technical Architecture
**Visual:** Architecture diagram overlay.
**Voiceover:** "Built with Python, FastAPI, and React. Dockerized for easy deployment. It handles the data ingestion complexity so you can focus on the strategy."

## 2:30-2:45 | Outro
**Visual:** GitHub Repo Link.
**Voiceover:** "Check out the repo to run it yourself. This is the future of algorithmic trading interfaces."
