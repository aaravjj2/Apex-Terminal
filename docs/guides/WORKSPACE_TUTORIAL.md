# Customizing Workspaces

> Build the perfect multi-panel layout tailored to your workflow.

Apex Terminal uses `react-resizable-panels` to give you full control over your workspace. Create multiple layouts, switch between them instantly, and share configurations with your team.

---

## Table of Contents

1. [Understanding Workspaces](#understanding-workspaces)
2. [Creating a New Workspace](#creating-a-new-workspace)
3. [Adding and Removing Panels](#adding-and-removing-panels)
4. [Resizing with Drag](#resizing-with-drag)
5. [Saving Layouts](#saving-layouts)
6. [Switching Workspaces](#switching-workspaces)
7. [Importing and Exporting](#importing-and-exporting)
8. [Preset Layouts](#preset-layouts)
9. [Tips](#tips)

---

## Understanding Workspaces

A workspace is a named arrangement of panels. Each panel holds a specific module:

| Panel Type | Content |
|------------|---------|
| Chart | Price chart with indicators and drawings |
| Watchlist | Symbol list with real-time quotes |
| Order Blotter | Active and filled orders |
| Options Chain | Options analytics and strategy builder |
| Screener | Stock screener results |
| News | News feed with sentiment indicators |
| Portfolio | Holdings and allocation view |
| Risk | Risk metrics dashboard |
| Terminal | Bloomberg-style command output |

You can have multiple workspaces saved and switch between them without losing any panel state.

---

## Creating a New Workspace

1. Click the **workspace dropdown** in the top bar (shows current workspace name).
2. Select **+ New Workspace**.
3. Name it (e.g., "Day Trading", "Swing Analysis", "Options Desk").
4. The new workspace starts with a default single-chart layout.
5. Customize by adding panels and arranging them.

![New Workspace](../assets/screenshots/workspace-new.png)

---

## Adding and Removing Panels

### Adding Panels

1. Right-click any panel header or empty area.
2. Select **Add Panel → [Panel Type]**.
3. Choose the split direction: **Right**, **Below**, **Left**, or **Above**.
4. The new panel appears adjacent to the clicked panel.

Alternatively, use the command bar: `Ctrl+K` → type `add panel [type]`.

### Removing Panels

1. Right-click the panel header.
2. Select **Close Panel**.
3. Adjacent panels expand to fill the space.

> **Note:** The last remaining panel cannot be closed. At least one panel must exist in a workspace.

---

## Resizing with Drag

Panels are separated by draggable borders:

1. Hover over the border between two panels — the cursor changes to a resize handle.
2. Click and drag to adjust the split ratio.
3. Release to set the new size.

The `react-resizable-panels` library ensures smooth resizing with minimum/maximum size constraints so panels remain usable.

Double-click a border to reset the split to 50/50.

> **Tip:** Hold `Shift` while dragging to resize in larger increments (snap to 10% steps).

---

## Saving Layouts

Layouts auto-save when you make changes. You can also explicitly save:

1. Click the workspace dropdown → **Save** (or `Ctrl+S`).
2. To save as a new workspace, select **Save As** and provide a new name.

Saved layouts include: panel arrangement, sizes, panel types, panel-specific settings (e.g., which symbol is loaded in each chart, which indicators are active).

Layouts persist in IndexedDB across browser sessions.

---

## Switching Workspaces

1. Click the workspace dropdown to see all saved workspaces.
2. Click a workspace name to switch. The transition is instant.
3. Use keyboard shortcuts `Ctrl+Shift+1` through `Ctrl+Shift+9` for quick access to workspaces by position.

The previous workspace state is preserved — switching back restores it exactly.

![Workspace Switcher](../assets/screenshots/workspace-switcher.png)

---

## Importing and Exporting

Share workspace configurations with colleagues or back them up:

### Exporting

1. Click workspace dropdown → **Export**.
2. Choose the workspace to export.
3. A JSON file downloads containing the full layout definition.

### Importing

1. Click workspace dropdown → **Import**.
2. Select a JSON file from your system.
3. The imported workspace appears in your list.

> **Tip:** Store workspace JSON files in version control for team-wide standardization.

---

## Preset Layouts

Apex Terminal ships with curated presets:

| Preset | Description |
|--------|-------------|
| **Trader** | Chart + watchlist + blotter + time & sales |
| **Analyst** | Multi-chart (2×2) + screener + news |
| **Options Desk** | Chart + options chain + payoff diagram + Greeks |
| **Portfolio Manager** | Portfolio + risk + allocation + benchmark |
| **Scanner** | Screener + scanner results + chart + alerts |
| **Bloomberg** | Full terminal mode with command output panels |

Access presets from the workspace dropdown → **Presets**. They provide a starting point you can customize further.

---

## Tips

- **Create workflow-specific workspaces** — a day trading layout differs from a portfolio review layout.
- **Use keyboard shortcuts** to switch instantly during fast-moving markets.
- **Export backups** before major reorganizations so you can restore if needed.
- **Minimize chart indicators per panel** — if you need many indicators, use multi-chart layouts instead of overcrowding one chart.
- **Name workspaces clearly** — "Morning Scan", "Earnings Review", "End of Day" help you context-switch efficiently.

---

*Next: [Bloomberg Commands](BLOOMBERG_COMMANDS.md) for keyboard-driven terminal workflows.*
