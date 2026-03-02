# Setting Up Alerts

> Get notified when price, indicator, or volume conditions are triggered — never miss a setup.

Alerts in Apex Terminal let you define conditions and receive notifications without constantly watching the screen. This guide covers creating, managing, and optimizing your alert workflow.

---

## Table of Contents

1. [Accessing Alerts](#accessing-alerts)
2. [Creating a Price Alert](#creating-a-price-alert)
3. [Indicator-Based Alerts](#indicator-based-alerts)
4. [Volume Alerts](#volume-alerts)
5. [Notification Channels](#notification-channels)
6. [Managing Active Alerts](#managing-active-alerts)
7. [Alert History](#alert-history)
8. [Tips](#tips)

---

## Accessing Alerts

- **Command bar:** `Ctrl+K` → type `alerts`
- **Sidebar:** Click the bell icon
- **Chart shortcut:** Right-click a price level → **Set Alert Here**
- **Keyboard:** Press `A` on the chart to open the alert creator at the crosshair price

---

## Creating a Price Alert

1. Open the alert panel or right-click a chart price level.
2. Select **Price Alert**.
3. Configure:

| Field | Description |
|-------|-------------|
| Symbol | Pre-filled with the active chart symbol |
| Condition | Crosses Above, Crosses Below, Enters Range, Exits Range |
| Price | The trigger price level |
| Expiration | Duration the alert stays active (1 day, 1 week, GTC) |

4. Click **Create Alert**. A horizontal line appears on the chart at the alert price.

![Price Alert](../assets/screenshots/price-alert.png)

> **Tip:** Drag the alert line on the chart to adjust the price level visually.

---

## Indicator-Based Alerts

Trigger alerts when technical indicators reach specific conditions:

1. Select **Indicator Alert** in the alert creator.
2. Choose an indicator from the dropdown (any indicator available in the charting module).
3. Set the condition:

| Indicator | Example Condition |
|-----------|------------------|
| RSI | Crosses below 30 (oversold) |
| MACD | MACD line crosses above signal line |
| Bollinger Bands | Price exits upper band |
| Moving Average | Price crosses above 200 EMA |
| Stochastic | %K crosses above %D in oversold zone |
| VWAP | Price crosses below VWAP |

4. Configure the timeframe the indicator is evaluated on (1m, 5m, 1h, 1D, etc.).
5. Click **Create Alert**.

> **Note:** Indicator alerts are evaluated on each new bar close for the selected timeframe.

---

## Volume Alerts

Monitor unusual volume activity:

1. Select **Volume Alert** in the alert creator.
2. Choose a condition:

| Condition | Description |
|-----------|-------------|
| Volume Spike | Volume exceeds N× average (e.g., 2× 20-day avg) |
| Volume Above | Absolute volume exceeds a threshold |
| Relative Volume | Current session volume vs. same time yesterday |

3. Set the multiplier or absolute threshold.
4. Click **Create Alert**.

Volume alerts are particularly useful for detecting institutional activity and breakout confirmations.

---

## Notification Channels

Choose how you want to be notified when an alert triggers:

| Channel | Setup Required | Description |
|---------|---------------|-------------|
| **In-App Popup** | None | Toast notification within Apex Terminal |
| **Sound** | None | Audio alert (configurable tone) |
| **Browser Push** | Allow permissions | OS-level push notification |
| **Email** | Configure in Settings | Alert details sent to your email |
| **Webhook** | Provide URL | POST request to your endpoint |

Configure default channels in **Settings → Alerts → Notification Preferences**. Override per alert when creating.

> **Tip:** Use webhooks to integrate alerts with Slack, Discord, or custom trading bots.

---

## Managing Active Alerts

The alert manager (bell icon in sidebar) shows all active alerts:

| Column | Description |
|--------|-------------|
| Symbol | Instrument being monitored |
| Type | Price, Indicator, or Volume |
| Condition | The trigger condition |
| Status | Active, Triggered, Expired |
| Created | When the alert was set |
| Expires | When the alert auto-deactivates |

Actions available:

- **Pause** — temporarily disable without deleting
- **Edit** — modify the condition or price
- **Duplicate** — create a copy with slight modifications
- **Delete** — remove permanently

---

## Alert History

The **History** tab shows all previously triggered alerts:

- Trigger time and price at the moment of trigger
- Whether the alert was one-time or recurring
- The notification channel used
- Quick link to the chart at the trigger moment

Use history to review how your alert-driven workflow performed over time.

![Alert History](../assets/screenshots/alert-history.png)

---

## Tips

- **Layer alerts** — set alerts at multiple support/resistance levels for a tiered approach.
- **Combine with screener** — screen for candidates, then set alerts on the best setups.
- **Use recurring alerts** — for conditions like "RSI below 30" that you want monitored continuously.
- **Keep alerts organized** — name them descriptively (e.g., "AAPL support bounce at $175").
- **Clean up expired alerts** — periodically review and delete stale alerts to keep the manager tidy.
- **Webhook for automation** — connect alerts to a trading bot for semi-automated execution.

---

*Next: [Workspace Tutorial](WORKSPACE_TUTORIAL.md) to build your ideal layout.*
