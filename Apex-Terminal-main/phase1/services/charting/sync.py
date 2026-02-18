"""
Multi-Chart Sync Module.

Implements synchronized scrolling, zooming, and crosshair
across multiple chart instances for comparison views.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Callable, Set
from enum import Enum, auto
import threading
from uuid import uuid4

from .chart_wrapper import ChartWrapper
from .scale_engine import ScaleState
from .crosshair import CrosshairState, CrosshairManager


class SyncMode(Enum):
    """Synchronization mode between charts."""
    
    NONE = auto()        # No synchronization
    TIME = auto()        # Time axis only
    PRICE = auto()       # Price axis only
    BOTH = auto()        # Both axes
    CROSSHAIR = auto()   # Crosshair position only
    FULL = auto()        # All synchronization


@dataclass
class SyncEvent:
    """Event for chart synchronization."""
    
    source_chart_id: str
    event_type: str  # "scale", "crosshair", "pan", "zoom"
    timestamp_ms: int
    data: dict = field(default_factory=dict)


@dataclass
class ChartLink:
    """Link configuration between two charts."""
    
    chart_id_a: str
    chart_id_b: str
    mode: SyncMode = SyncMode.BOTH
    enabled: bool = True
    
    def involves(self, chart_id: str) -> bool:
        """Check if this link involves the given chart."""
        return chart_id == self.chart_id_a or chart_id == self.chart_id_b
    
    def get_other(self, chart_id: str) -> Optional[str]:
        """Get the other chart ID in this link."""
        if chart_id == self.chart_id_a:
            return self.chart_id_b
        elif chart_id == self.chart_id_b:
            return self.chart_id_a
        return None


class SyncGroup:
    """
    Group of synchronized charts.
    
    Charts in the same group share scale state and crosshair position
    based on the configured sync mode.
    """
    
    def __init__(self, group_id: Optional[str] = None, mode: SyncMode = SyncMode.BOTH):
        self.group_id = group_id or str(uuid4())
        self.mode = mode
        self._charts: Dict[str, ChartWrapper] = {}
        self._links: List[ChartLink] = []
        self._listeners: List[Callable[[SyncEvent], None]] = []
        self._syncing = False  # Prevent recursion
        self._lock = threading.Lock()
    
    def add_chart(self, chart: ChartWrapper) -> None:
        """
        Add a chart to the sync group.
        
        Args:
            chart: Chart to add
        """
        with self._lock:
            self._charts[chart.chart_id] = chart
            
            # Create links to existing charts
            for existing_id in list(self._charts.keys()):
                if existing_id != chart.chart_id:
                    link = ChartLink(
                        chart_id_a=existing_id,
                        chart_id_b=chart.chart_id,
                        mode=self.mode,
                    )
                    self._links.append(link)
            
            # Register for scale changes
            chart.on_scale_change(lambda state: self._on_chart_scale_change(chart.chart_id, state))
    
    def remove_chart(self, chart_id: str) -> None:
        """
        Remove a chart from the sync group.
        
        Args:
            chart_id: ID of chart to remove
        """
        with self._lock:
            if chart_id in self._charts:
                del self._charts[chart_id]
            
            # Remove links involving this chart
            self._links = [l for l in self._links if not l.involves(chart_id)]
    
    def get_charts(self) -> List[ChartWrapper]:
        """Get all charts in the group."""
        return list(self._charts.values())
    
    def set_mode(self, mode: SyncMode) -> None:
        """Set sync mode for all links."""
        self.mode = mode
        for link in self._links:
            link.mode = mode
    
    def enable_link(self, chart_id_a: str, chart_id_b: str) -> None:
        """Enable synchronization between two charts."""
        for link in self._links:
            if link.involves(chart_id_a) and link.involves(chart_id_b):
                link.enabled = True
                break
    
    def disable_link(self, chart_id_a: str, chart_id_b: str) -> None:
        """Disable synchronization between two charts."""
        for link in self._links:
            if link.involves(chart_id_a) and link.involves(chart_id_b):
                link.enabled = False
                break
    
    def on_sync(self, callback: Callable[[SyncEvent], None]) -> None:
        """Register a sync event listener."""
        self._listeners.append(callback)
    
    def _on_chart_scale_change(self, source_id: str, state: ScaleState) -> None:
        """Handle scale change from a chart."""
        if self._syncing:
            return
        
        with self._lock:
            self._syncing = True
            try:
                event = SyncEvent(
                    source_chart_id=source_id,
                    event_type="scale",
                    timestamp_ms=0,  # TODO: use actual timestamp
                    data={"state": state},
                )
                
                # Propagate to linked charts
                for link in self._links:
                    if not link.enabled or not link.involves(source_id):
                        continue
                    
                    target_id = link.get_other(source_id)
                    if target_id and target_id in self._charts:
                        self._apply_sync(link, self._charts[target_id], state)
                
                # Notify listeners
                for listener in self._listeners:
                    listener(event)
            finally:
                self._syncing = False
    
    def _apply_sync(self, link: ChartLink, target: ChartWrapper, state: ScaleState) -> None:
        """Apply synchronization to target chart."""
        target_state = target.get_scale_state()
        if not target_state:
            return
        
        new_state = ScaleState(
            start_bar_index=state.start_bar_index if link.mode in (SyncMode.TIME, SyncMode.BOTH, SyncMode.FULL) else target_state.start_bar_index,
            end_bar_index=state.end_bar_index if link.mode in (SyncMode.TIME, SyncMode.BOTH, SyncMode.FULL) else target_state.end_bar_index,
            min_price=state.min_price if link.mode in (SyncMode.PRICE, SyncMode.BOTH, SyncMode.FULL) else target_state.min_price,
            max_price=state.max_price if link.mode in (SyncMode.PRICE, SyncMode.BOTH, SyncMode.FULL) else target_state.max_price,
            viewport_width=target_state.viewport_width,
            viewport_height=target_state.viewport_height,
        )
        
        target.set_scale_state(new_state)
    
    def sync_all_to(self, source_chart_id: str) -> None:
        """
        Sync all charts to match the source chart's state.
        
        Args:
            source_chart_id: ID of the chart to sync from
        """
        if source_chart_id not in self._charts:
            return
        
        source = self._charts[source_chart_id]
        state = source.get_scale_state()
        if not state:
            return
        
        with self._lock:
            self._syncing = True
            try:
                for chart_id, chart in self._charts.items():
                    if chart_id != source_chart_id:
                        chart.set_scale_state(state)
            finally:
                self._syncing = False


class CrosshairSync:
    """
    Synchronized crosshair across multiple charts.
    
    When the crosshair moves on one chart, it updates
    the crosshair position on all linked charts.
    """
    
    def __init__(self):
        self._managers: Dict[str, CrosshairManager] = {}
        self._syncing = False
        self._lock = threading.Lock()
    
    def register(self, chart_id: str, manager: CrosshairManager) -> None:
        """Register a crosshair manager."""
        self._managers[chart_id] = manager
        
        # Listen for crosshair changes
        manager.crosshair.on_change(lambda state: self._on_crosshair_change(chart_id, state))
    
    def unregister(self, chart_id: str) -> None:
        """Unregister a crosshair manager."""
        if chart_id in self._managers:
            del self._managers[chart_id]
    
    def _on_crosshair_change(self, source_id: str, state: CrosshairState) -> None:
        """Handle crosshair change from a chart."""
        if self._syncing or not state.visible:
            return
        
        with self._lock:
            self._syncing = True
            try:
                # Propagate to all other charts
                for chart_id, manager in self._managers.items():
                    if chart_id != source_id:
                        # Sync based on bar index / price, not pixel position
                        if state.snapped_bar_index is not None:
                            # Find X for the same bar index
                            chart = manager.chart
                            chart_area = chart.layout.chart_area
                            
                            # Use same bar index
                            x = chart._scale_engine.bar_index_to_x(state.snapped_bar_index) + chart_area.x if chart._scale_engine else state.x
                            
                            # Use same price for Y if available
                            if state.snapped_price is not None and chart._scale_engine:
                                y = chart._scale_engine.price_to_y(state.snapped_price) + chart_area.y
                            else:
                                y = state.y
                            
                            manager.update(x, y)
            finally:
                self._syncing = False
    
    def hide_all(self) -> None:
        """Hide crosshair on all charts."""
        for manager in self._managers.values():
            manager.hide()
    
    def show_at_bar_index(self, bar_index: int, price: Optional[float] = None) -> None:
        """
        Show crosshair at specific bar index on all charts.
        
        Args:
            bar_index: Bar index to show crosshair at
            price: Optional price level
        """
        for manager in self._managers.values():
            chart = manager.chart
            chart_area = chart.layout.chart_area
            
            if chart._scale_engine:
                x = chart._scale_engine.bar_index_to_x(bar_index) + chart_area.x
                
                if price is not None:
                    y = chart._scale_engine.price_to_y(price) + chart_area.y
                else:
                    y = chart_area.y + chart_area.height / 2
                
                manager.update(x, y)


class ChartGrid:
    """
    Grid layout for multiple synchronized charts.
    
    Manages a grid of charts with synchronized scrolling
    and crosshair display.
    """
    
    def __init__(
        self,
        rows: int = 1,
        cols: int = 1,
        sync_mode: SyncMode = SyncMode.TIME,
    ):
        self.rows = rows
        self.cols = cols
        self.sync_mode = sync_mode
        
        self._charts: List[List[Optional[ChartWrapper]]] = [
            [None for _ in range(cols)] for _ in range(rows)
        ]
        self._sync_group = SyncGroup(mode=sync_mode)
        self._crosshair_sync = CrosshairSync()
    
    def set_chart(self, row: int, col: int, chart: ChartWrapper) -> None:
        """
        Set chart at grid position.
        
        Args:
            row: Row index (0-based)
            col: Column index (0-based)
            chart: Chart to place
        """
        if 0 <= row < self.rows and 0 <= col < self.cols:
            # Remove existing chart
            existing = self._charts[row][col]
            if existing:
                self._sync_group.remove_chart(existing.chart_id)
            
            # Add new chart
            self._charts[row][col] = chart
            self._sync_group.add_chart(chart)
    
    def get_chart(self, row: int, col: int) -> Optional[ChartWrapper]:
        """Get chart at grid position."""
        if 0 <= row < self.rows and 0 <= col < self.cols:
            return self._charts[row][col]
        return None
    
    def get_all_charts(self) -> List[ChartWrapper]:
        """Get all charts in the grid."""
        charts = []
        for row in self._charts:
            for chart in row:
                if chart:
                    charts.append(chart)
        return charts
    
    def register_crosshair(self, row: int, col: int, manager: CrosshairManager) -> None:
        """Register crosshair manager for a chart position."""
        chart = self.get_chart(row, col)
        if chart:
            self._crosshair_sync.register(chart.chart_id, manager)
    
    def sync_all(self) -> None:
        """Sync all charts to the first chart."""
        first_chart = None
        for row in self._charts:
            for chart in row:
                if chart:
                    first_chart = chart
                    break
            if first_chart:
                break
        
        if first_chart:
            self._sync_group.sync_all_to(first_chart.chart_id)
    
    def set_sync_mode(self, mode: SyncMode) -> None:
        """Set synchronization mode for all charts."""
        self.sync_mode = mode
        self._sync_group.set_mode(mode)
    
    def resize(self, rows: int, cols: int) -> None:
        """
        Resize the grid.
        
        Args:
            rows: New row count
            cols: New column count
        """
        new_charts = [
            [None for _ in range(cols)] for _ in range(rows)
        ]
        
        # Copy existing charts
        for r in range(min(rows, self.rows)):
            for c in range(min(cols, self.cols)):
                new_charts[r][c] = self._charts[r][c]
        
        self._charts = new_charts
        self.rows = rows
        self.cols = cols
    
    @property
    def sync_group(self) -> SyncGroup:
        """Get the sync group."""
        return self._sync_group
    
    @property
    def crosshair_sync(self) -> CrosshairSync:
        """Get the crosshair sync."""
        return self._crosshair_sync


def create_comparison_view(
    symbols: List[str],
    sync_mode: SyncMode = SyncMode.TIME,
) -> ChartGrid:
    """
    Create a comparison view for multiple symbols.
    
    Args:
        symbols: List of symbol names
        sync_mode: Synchronization mode
    
    Returns:
        Configured ChartGrid
    """
    count = len(symbols)
    
    # Determine grid layout
    if count == 1:
        rows, cols = 1, 1
    elif count == 2:
        rows, cols = 1, 2
    elif count <= 4:
        rows, cols = 2, 2
    elif count <= 6:
        rows, cols = 2, 3
    else:
        rows, cols = 3, 3
    
    grid = ChartGrid(rows=rows, cols=cols, sync_mode=sync_mode)
    
    # Create charts
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx < count:
                chart = ChartWrapper(chart_id=f"chart-{symbols[idx]}")
                grid.set_chart(r, c, chart)
                idx += 1
    
    return grid


class SyncStateManager:
    """
    Manages serialization and restoration of sync state.
    
    Allows saving and loading the complete state of
    synchronized chart groups.
    """
    
    @staticmethod
    def serialize_group(group: SyncGroup) -> dict:
        """Serialize sync group state."""
        charts_state = {}
        for chart_id, chart in group._charts.items():
            state = chart.get_scale_state()
            if state:
                charts_state[chart_id] = {
                    "start_bar_index": state.start_bar_index,
                    "end_bar_index": state.end_bar_index,
                    "min_price": state.min_price,
                    "max_price": state.max_price,
                    "viewport_width": state.viewport_width,
                    "viewport_height": state.viewport_height,
                }
        
        links_state = [
            {
                "chart_id_a": link.chart_id_a,
                "chart_id_b": link.chart_id_b,
                "mode": link.mode.name,
                "enabled": link.enabled,
            }
            for link in group._links
        ]
        
        return {
            "group_id": group.group_id,
            "mode": group.mode.name,
            "charts": charts_state,
            "links": links_state,
        }
    
    @staticmethod
    def restore_group(group: SyncGroup, data: dict) -> None:
        """Restore sync group state from serialized data."""
        # Restore chart states
        for chart_id, state_data in data.get("charts", {}).items():
            if chart_id in group._charts:
                state = ScaleState(
                    start_bar_index=state_data["start_bar_index"],
                    end_bar_index=state_data["end_bar_index"],
                    min_price=state_data["min_price"],
                    max_price=state_data["max_price"],
                    viewport_width=state_data["viewport_width"],
                    viewport_height=state_data["viewport_height"],
                )
                group._charts[chart_id].set_scale_state(state)
        
        # Restore link states
        for link_data in data.get("links", []):
            for link in group._links:
                if (link.chart_id_a == link_data["chart_id_a"] and
                    link.chart_id_b == link_data["chart_id_b"]):
                    link.mode = SyncMode[link_data["mode"]]
                    link.enabled = link_data["enabled"]
                    break
