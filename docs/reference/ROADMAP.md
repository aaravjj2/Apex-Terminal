# Roadmap

> Planned features and development priorities for Apex Terminal.

## Table of Contents

- [Current Quarter (Q1 2026)](#current-quarter-q1-2026)
- [Q2 2026](#q2-2026)
- [Q3 2026](#q3-2026)
- [Q4 2026](#q4-2026)
- [2027 Horizon](#2027-horizon)
- [Community Requests](#community-requests)

---

## Current Quarter (Q1 2026)

Focus: **Stability, Performance, Developer Experience**

| Feature | Status | Priority | Target |
|---------|--------|----------|--------|
| Performance optimization (LCP < 1.0s) | In Progress | P0 | Mar 2026 |
| E2E test coverage to 80% | In Progress | P0 | Mar 2026 |
| Accessibility audit (WCAG 2.1 AA) | Planned | P1 | Mar 2026 |
| Internationalization (i18n) framework | Planned | P1 | Mar 2026 |
| Plugin/extension API v1 | Planned | P1 | Mar 2026 |
| Documentation site (Astro/Starlight) | In Progress | P1 | Mar 2026 |

---

## Q2 2026

Focus: **Mobile & Multi-Broker**

### Mobile Native App

| Item | Description |
|------|-------------|
| Platform | React Native with shared business logic |
| Charts | lightweight-charts mobile wrapper with touch gestures |
| Offline | IndexedDB sync for watchlists and alerts |
| Notifications | Push notifications for alerts and fills via FCM/APNs |
| Target | iOS and Android MVP |

### Multi-Broker Integration

| Item | Description |
|------|-------------|
| Architecture | Broker adapter interface with pluggable providers |
| Phase 1 brokers | Alpaca, Interactive Brokers, TD Ameritrade |
| Phase 2 brokers | Robinhood, Schwab, Fidelity |
| Features | Unified order routing, position aggregation, multi-account |
| Auth | OAuth2 per broker with secure token storage |

### Additional Q2 Items

| Feature | Priority |
|---------|----------|
| Localization: Spanish, German, Japanese, Chinese | P1 |
| PWA install prompt and offline chart caching | P2 |
| Keyboard shortcut recorder/macro system | P2 |

---

## Q3 2026

Focus: **AI Trading Copilot & Advanced Analytics**

### AI Trading Copilot

| Capability | Description |
|------------|-------------|
| Natural language queries | "Show me tech stocks with RSI below 30 and positive MACD crossover" |
| Chart annotation | AI-generated support/resistance levels and pattern callouts |
| Trade suggestions | Context-aware suggestions based on portfolio and market conditions |
| Risk warnings | Proactive alerts when portfolio risk metrics deteriorate |
| Model | Local inference with ONNX Runtime (no data leaves the browser) |

### Advanced ML Models

| Model | Use Case |
|-------|----------|
| Transformer price forecasting | Multi-horizon price prediction |
| Graph neural networks | Cross-asset correlation discovery |
| Reinforcement learning | Adaptive order execution optimization |
| NLP earnings analysis | Automated earnings call transcript analysis |

### Additional Q3 Items

| Feature | Priority |
|---------|----------|
| Advanced order types: trailing stop, bracket builder, TWAP/VWAP algo | P1 |
| Real-time options flow tracking (unusual activity scanner) | P1 |
| Custom indicator scripting language (Pine-style) | P2 |
| Chart replay mode for training | P2 |

---

## Q4 2026

Focus: **Social Trading & Compliance**

### Social Trading Marketplace

| Feature | Description |
|---------|-------------|
| Strategy marketplace | Publish and subscribe to trading strategies |
| Copy trading | Auto-mirror trades from followed traders with risk controls |
| Leaderboards | Performance rankings by strategy type, timeframe, risk profile |
| Revenue sharing | Creators earn fees on subscriptions |
| Reputation system | Track record verification and ratings |

### Regulatory Compliance Module

| Feature | Description |
|---------|-------------|
| Trade surveillance | Pattern detection for wash trading, spoofing, layering |
| Reporting | MiFID II, Reg NMS, FINRA-compliant trade reports |
| Audit trail | Immutable log of all order actions with timestamps |
| Best execution | TCA (Transaction Cost Analysis) dashboard |
| Data residency | Configurable data storage region |

### Additional Q4 Items

| Feature | Priority |
|---------|----------|
| Crypto asset support (spot, perps, DeFi integrations) | P1 |
| Fixed income analytics (bond pricing, yield curves) | P2 |
| Forex module with pip calculator and session clocks | P2 |
| Commodities futures with rollover management | P2 |

---

## 2027 Horizon

Long-term vision items under exploration.

| Feature | Description |
|---------|-------------|
| Desktop native app | Electron or Tauri wrapper for native performance |
| Multi-monitor | Detachable panels across displays |
| Quantitative research IDE | Jupyter-style notebook with market data integration |
| Institutional features | FIX protocol, prime brokerage integration, OMS/EMS |
| White-label SDK | Embeddable charting and trading components |
| Voice control | Hands-free trading via voice commands |
| AR/VR visualization | 3D market data visualization for spatial computing |

---

## Community Requests

Features most requested by the community (voting tracked on GitHub Discussions).

| Request | Votes | Status |
|---------|-------|--------|
| Custom indicator scripting | 342 | Planned Q3 2026 |
| Mobile app | 298 | Planned Q2 2026 |
| Multi-broker support | 267 | Planned Q2 2026 |
| Crypto support | 245 | Planned Q4 2026 |
| Chart replay | 189 | Planned Q3 2026 |
| Strategy backtester improvements | 176 | Ongoing |
| Renko / Point & Figure charts | 134 | Under Review |
| Heikin-Ashi smoothing options | 112 | Under Review |
| Calendar spread builder | 98 | Under Review |
| Multi-timeframe analysis layout | 87 | Under Review |

---

## How to Contribute

1. **Feature requests** — Open a GitHub Discussion with the `feature-request` label.
2. **Upvote** — React with 👍 on existing requests to prioritize.
3. **Pull requests** — See the [Contributing Guide](../guides/CONTRIBUTING.md) for development setup.
4. **Roadmap feedback** — Comment on the pinned Roadmap Discussion thread.

---

*Roadmap is subject to change based on community feedback and business priorities. Last updated: March 2026.*
