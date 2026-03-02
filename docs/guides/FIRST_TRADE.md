# Place Your First Trade

> A step-by-step walkthrough from symbol selection to order monitoring.

This guide takes you through the complete workflow of placing a trade in Apex Terminal — selecting a symbol, reading the chart, submitting an order, and tracking it in the blotter.

---

## Table of Contents

1. [Selecting a Symbol](#selecting-a-symbol)
2. [Reading the Chart](#reading-the-chart)
3. [Opening the Order Ticket](#opening-the-order-ticket)
4. [Choosing an Order Type](#choosing-an-order-type)
5. [Setting Quantity and Price](#setting-quantity-and-price)
6. [Reviewing and Submitting](#reviewing-and-submitting)
7. [Monitoring in the Blotter](#monitoring-in-the-blotter)
8. [Tips for New Traders](#tips-for-new-traders)

---

## Selecting a Symbol

There are three ways to load a symbol:

1. **Search bar** — Click the symbol field in the top bar and type a ticker (e.g., `AAPL`). Results appear as you type with exchange and asset class labels.
2. **Command bar** — Press `Ctrl+K`, type the ticker, and press Enter.
3. **Watchlist** — Click any symbol in the sidebar watchlist to load its chart.

![Symbol Search](../assets/screenshots/symbol-search.png)

> **Tip:** The search supports fuzzy matching — typing `MSFT` or `Microsoft` both resolve to the same security.

---

## Reading the Chart

Once a symbol is loaded, the chart displays candlestick data by default. Key elements:

| Element | Location | Description |
|---------|----------|-------------|
| Price axis | Right side | Current and historical price levels |
| Time axis | Bottom | Date/time labels for the visible range |
| Crosshair | Follows cursor | Shows exact price and time at pointer |
| OHLCV legend | Top-left overlay | Open, High, Low, Close, Volume for hovered bar |
| Indicator overlays | Chart area | Any applied technical studies |

Use the scroll wheel to zoom in/out and click-drag to pan. Double-click the price axis to auto-scale.

![Chart Reading](../assets/screenshots/chart-reading.png)

---

## Opening the Order Ticket

Open the order ticket using any of these methods:

- Press `Shift+T` from the chart view
- Right-click the chart and select **New Order**
- Click the **Trade** button in the top bar
- Use the command bar: `Ctrl+K` → type `order`

The order ticket slides in from the right side of the chart panel.

---

## Choosing an Order Type

Apex Terminal supports multiple order types:

| Order Type | When to Use |
|------------|-------------|
| **Market** | Execute immediately at the best available price |
| **Limit** | Set a specific price — fills only at that price or better |
| **Stop** | Triggers a market order when the stop price is reached |
| **Stop-Limit** | Triggers a limit order when the stop price is reached |
| **Bracket** | Limit entry with automatic take-profit and stop-loss |
| **OCO** | One-Cancels-Other — two linked orders, one cancels when the other fills |

Select the order type from the dropdown at the top of the order ticket.

> **Note:** Bracket and OCO orders are under the **Advanced** tab in the order ticket.

---

## Setting Quantity and Price

1. Enter the **quantity** (number of shares/contracts) in the Qty field.
2. For limit or stop orders, set the **price** by typing a value or clicking a price level on the chart.
3. For bracket orders, set the **take-profit** and **stop-loss** distances.
4. The estimated order value appears below the fields in real time.

![Order Ticket](../assets/screenshots/order-ticket.png)

---

## Reviewing and Submitting

Before submitting, the confirmation panel shows:

- Symbol and direction (Buy / Sell)
- Order type and time-in-force
- Quantity and price (or market)
- Estimated cost and fees
- Risk warnings if applicable

Click **Submit Order** to send. A toast notification confirms submission, and the order appears in the blotter.

> **Warning:** Market orders execute immediately. Double-check direction and quantity before confirming.

---

## Monitoring in the Blotter

The order blotter is located below the chart (or in a separate panel, depending on your workspace). It shows:

| Column | Description |
|--------|-------------|
| Symbol | Ticker of the instrument |
| Side | Buy or Sell |
| Type | Order type |
| Qty | Quantity ordered vs. filled |
| Price | Limit price or average fill price |
| Status | Pending, Partial, Filled, Cancelled, Rejected |
| Time | Submission and last update timestamps |

Click any row to view full order details or to cancel/modify a pending order.

![Order Blotter](../assets/screenshots/order-blotter.png)

---

## Tips for New Traders

- **Start with limit orders** — they give you price control unlike market orders.
- **Use bracket orders** to automatically manage risk with built-in stop-loss and take-profit.
- **Check the blotter** after every submission to confirm status.
- **Paper trade first** — switch to simulation mode in Settings → Trading to practice without risk.
- **Review your trades** in the Trade Journal to learn from each decision.

---

*Next: [Chart Tutorial](CHART_TUTORIAL.md) to master the charting tools.*
