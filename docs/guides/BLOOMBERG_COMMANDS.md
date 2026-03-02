# Bloomberg Command Reference

> Master keyboard-driven workflows with Apex Terminal's command line interface.

Apex Terminal includes a Bloomberg-style command bar for rapid navigation, security lookup, and function execution — all without touching the mouse. Activate it with `Ctrl+K`.

---

## Table of Contents

1. [Opening the Command Bar](#opening-the-command-bar)
2. [Command Syntax](#command-syntax)
3. [Security Lookup](#security-lookup)
4. [Navigation Commands](#navigation-commands)
5. [Function Codes](#function-codes)
6. [Keyboard-Driven Workflows](#keyboard-driven-workflows)
7. [Multi-Panel Configuration](#multi-panel-configuration)
8. [Creating Command Aliases](#creating-command-aliases)
9. [Tips](#tips)

---

## Opening the Command Bar

Press `Ctrl+K` from anywhere in the application. The command bar appears as an overlay at the top of the screen with a blinking cursor.

![Command Bar](../assets/screenshots/command-bar.png)

- Start typing immediately — no need to click.
- Press `Escape` to dismiss without executing.
- Press `Enter` to execute the typed command.
- Use `↑` / `↓` arrows to navigate command history.

---

## Command Syntax

Commands follow this general format:

```
[SYMBOL] [FUNCTION] [ARGUMENTS]
```

Examples:

| Input | Action |
|-------|--------|
| `AAPL` | Load AAPL chart |
| `AAPL GP` | Open AAPL price graph |
| `MSFT DES` | Show MSFT company description |
| `SPY OPT` | Open SPY options chain |
| `screen` | Open the stock screener |
| `portfolio` | Navigate to portfolio view |

The parser is fuzzy — partial matches and abbreviations are supported.

---

## Security Lookup

Type a ticker or company name to search:

- `AAPL` — direct ticker match
- `Apple` — fuzzy name match, shows candidates
- `TSLA US Equity` — Bloomberg-style qualified name
- `ES1!` — futures front month
- `EURUSD` — forex pair

Results appear in a dropdown. Press `Enter` to select the top result, or use arrows to choose.

> **Tip:** Type `?` after a ticker to see all available functions for that security (e.g., `AAPL ?`).

---

## Navigation Commands

| Command | Action |
|---------|--------|
| `chart` or `gp` | Switch to chart view |
| `watchlist` or `wl` | Open watchlist panel |
| `blotter` or `orders` | Open order blotter |
| `portfolio` or `port` | Open portfolio view |
| `risk` | Open risk analytics |
| `screener` or `screen` | Open stock screener |
| `scanner` | Open real-time scanner |
| `news` | Open news feed |
| `calendar` or `eco` | Open economic calendar |
| `options` or `opt` | Open options chain |
| `backtest` or `bt` | Open backtester |
| `alerts` | Open alert manager |
| `journal` | Open trade journal |
| `settings` | Open settings |
| `theme dark` | Switch to dark theme |
| `theme light` | Switch to light theme |
| `theme midnight` | Switch to midnight theme |

---

## Function Codes

Bloomberg-inspired function codes for detailed analysis:

| Code | Full Name | Description |
|------|-----------|-------------|
| `GP` | Graph Price | Load price chart for a symbol |
| `DES` | Description | Company overview and fundamentals |
| `FA` | Financial Analysis | Income statement, balance sheet, cash flow |
| `OPT` | Options | Options chain and analytics |
| `RV` | Relative Value | Peer comparison metrics |
| `COMP` | Comparison | Multi-security overlay chart |
| `HDS` | Holdings | Institutional ownership data |
| `DVA` | Dividend Analysis | Dividend history and yield |
| `ERN` | Earnings | Earnings history and estimates |
| `NEWS` | News | Symbol-specific news feed |
| `TECH` | Technicals | Technical indicator summary |

Combine with a symbol: `AAPL FA`, `MSFT ERN`, `SPY COMP`.

---

## Keyboard-Driven Workflows

### Vim-Style Sequences

Apex Terminal supports Vim-inspired key sequences for power users:

| Sequence | Action |
|----------|--------|
| `g g` | Jump to top of current list/table |
| `G` | Jump to bottom |
| `j` / `k` | Move down / up in lists |
| `l` / `h` | Expand / collapse tree items |
| `/` | Focus search within current panel |
| `n` / `N` | Next / previous search result |
| `q` | Close current panel or dialog |
| `z z` | Center current selection in view |

### Quick Actions

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command bar |
| `Shift+T` | Open order ticket |
| `Ctrl+Shift+N` | New workspace |
| `Ctrl+,` | Open settings |
| `Ctrl+.` | Toggle sidebar |
| `F11` | Toggle fullscreen |

---

## Multi-Panel Configuration

Use the command bar to configure workspace panels:

| Command | Action |
|---------|--------|
| `layout 2x2` | Switch to 2×2 grid layout |
| `layout 1x3` | Switch to 1×3 layout |
| `add panel chart` | Add a chart panel |
| `add panel news` | Add a news panel |
| `close panel` | Close the active panel |
| `workspace [name]` | Switch to a named workspace |
| `workspace save` | Save current workspace |

> **Tip:** Chain commands with `;` — e.g., `layout 2x2; AAPL; panel2 MSFT` to set up a comparison view rapidly.

---

## Creating Command Aliases

Define shortcuts for frequently used command sequences:

1. Open **Settings → Commands → Aliases**.
2. Click **Add Alias**.
3. Enter a short name and the full command it expands to.

| Alias | Expands To |
|-------|-----------|
| `fang` | `COMP META AAPL AMZN NFLX GOOG` |
| `myscreen` | `screener load "My Value Screen"` |
| `eod` | `workspace "End of Day"; portfolio` |

Type the alias in the command bar and it executes the full command.

---

## Tips

- **Use the command bar for everything** — it's faster than clicking through menus.
- **Learn the function codes** — they mirror Bloomberg conventions, making transition easier.
- **Build aliases for your daily routine** — morning scan, midday review, end-of-day wrap-up.
- **Command history persists** — press `↑` to recall recent commands.
- **Tab completion works** — type partial commands and press `Tab` to autocomplete.

---

*Next: [API Quickstart](API_QUICKSTART.md) to integrate programmatically.*
