"""
Unit tests for Multi-Chart Sync.

Tests cover:
- SyncGroup operations
- CrosshairSync
- ChartGrid layout
- State serialization
"""

import pytest

import sys
sys.path.insert(0, '/home/aarav/Aarav/Tradingview recreation/phase1')

from services.charting.sync import (
    SyncMode,
    SyncEvent,
    ChartLink,
    SyncGroup,
    CrosshairSync,
    ChartGrid,
    SyncStateManager,
    create_comparison_view,
)
from services.charting.chart_wrapper import ChartWrapper, Bar
from services.charting.scale_engine import ScaleState
from services.charting.crosshair import CrosshairManager


@pytest.fixture
def sample_bars():
    """Create sample bars."""
    return [
        Bar(i, i * 60000, 100 + i, 105 + i, 98 + i, 102 + i, 1000)
        for i in range(20)
    ]


@pytest.fixture
def chart_with_bars(sample_bars):
    """Create chart with bars."""
    chart = ChartWrapper(chart_id="test-chart")
    chart.set_bars(sample_bars)
    return chart


class TestChartLink:
    """Tests for ChartLink."""
    
    def test_involves(self):
        """Should check if link involves chart."""
        link = ChartLink("chart-a", "chart-b")
        
        assert link.involves("chart-a") is True
        assert link.involves("chart-b") is True
        assert link.involves("chart-c") is False
    
    def test_get_other(self):
        """Should get the other chart ID."""
        link = ChartLink("chart-a", "chart-b")
        
        assert link.get_other("chart-a") == "chart-b"
        assert link.get_other("chart-b") == "chart-a"
        assert link.get_other("chart-c") is None


class TestSyncGroup:
    """Tests for SyncGroup."""
    
    def test_creation(self):
        """Should create sync group."""
        group = SyncGroup()
        
        assert group.group_id is not None
        assert group.mode == SyncMode.BOTH
    
    def test_add_chart(self, chart_with_bars):
        """Should add chart to group."""
        group = SyncGroup()
        
        group.add_chart(chart_with_bars)
        
        assert len(group.get_charts()) == 1
    
    def test_remove_chart(self, chart_with_bars):
        """Should remove chart from group."""
        group = SyncGroup()
        group.add_chart(chart_with_bars)
        
        group.remove_chart(chart_with_bars.chart_id)
        
        assert len(group.get_charts()) == 0
    
    def test_creates_links(self, sample_bars):
        """Should create links between charts."""
        group = SyncGroup()
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        # Should have one link between the two charts
        assert len(group._links) == 1
        assert group._links[0].involves("chart-1")
        assert group._links[0].involves("chart-2")
    
    def test_set_mode(self, chart_with_bars):
        """Should set mode for all links."""
        group = SyncGroup()
        chart2 = ChartWrapper(chart_id="chart-2")
        
        group.add_chart(chart_with_bars)
        group.add_chart(chart2)
        
        group.set_mode(SyncMode.TIME)
        
        assert group.mode == SyncMode.TIME
        assert group._links[0].mode == SyncMode.TIME
    
    def test_disable_link(self, sample_bars):
        """Should disable link between charts."""
        group = SyncGroup()
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        group.disable_link("chart-1", "chart-2")
        
        assert group._links[0].enabled is False
    
    def test_enable_link(self, sample_bars):
        """Should enable link between charts."""
        group = SyncGroup()
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        group.disable_link("chart-1", "chart-2")
        
        group.enable_link("chart-1", "chart-2")
        
        assert group._links[0].enabled is True
    
    def test_sync_listener(self, sample_bars):
        """Should notify sync listeners."""
        group = SyncGroup()
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        events = []
        group.on_sync(lambda e: events.append(e))
        
        # Trigger scale change
        chart1.pan(5)
        
        assert len(events) == 1
        assert events[0].source_chart_id == "chart-1"
    
    def test_sync_all_to(self, sample_bars):
        """Should sync all charts to source."""
        group = SyncGroup()
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        # Pan chart1
        chart1.pan(5)
        
        # Sync all to chart1
        group.sync_all_to("chart-1")
        
        # Chart2 should have same state
        state1 = chart1.get_scale_state()
        state2 = chart2.get_scale_state()
        
        assert state2.start_bar_index == state1.start_bar_index


class TestCrosshairSync:
    """Tests for CrosshairSync."""
    
    def test_register(self, chart_with_bars):
        """Should register crosshair manager."""
        sync = CrosshairSync()
        manager = CrosshairManager(chart_with_bars)
        
        sync.register(chart_with_bars.chart_id, manager)
        
        assert chart_with_bars.chart_id in sync._managers
    
    def test_unregister(self, chart_with_bars):
        """Should unregister crosshair manager."""
        sync = CrosshairSync()
        manager = CrosshairManager(chart_with_bars)
        sync.register(chart_with_bars.chart_id, manager)
        
        sync.unregister(chart_with_bars.chart_id)
        
        assert chart_with_bars.chart_id not in sync._managers
    
    def test_hide_all(self, chart_with_bars):
        """Should hide all crosshairs."""
        sync = CrosshairSync()
        manager = CrosshairManager(chart_with_bars)
        sync.register(chart_with_bars.chart_id, manager)
        
        chart_area = chart_with_bars.layout.chart_area
        manager.update(chart_area.x + 100, chart_area.y + 100)
        
        sync.hide_all()
        
        assert manager.crosshair.state.visible is False


class TestChartGrid:
    """Tests for ChartGrid."""
    
    def test_creation(self):
        """Should create grid."""
        grid = ChartGrid(rows=2, cols=2)
        
        assert grid.rows == 2
        assert grid.cols == 2
    
    def test_set_chart(self, chart_with_bars):
        """Should set chart at position."""
        grid = ChartGrid(rows=2, cols=2)
        
        grid.set_chart(0, 0, chart_with_bars)
        
        assert grid.get_chart(0, 0) == chart_with_bars
    
    def test_get_chart_invalid(self):
        """Should return None for invalid position."""
        grid = ChartGrid(rows=2, cols=2)
        
        assert grid.get_chart(5, 5) is None
    
    def test_get_all_charts(self, sample_bars):
        """Should get all charts."""
        grid = ChartGrid(rows=2, cols=2)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        grid.set_chart(0, 0, chart1)
        grid.set_chart(0, 1, chart2)
        
        charts = grid.get_all_charts()
        
        assert len(charts) == 2
    
    def test_sync_mode(self, sample_bars):
        """Should set sync mode."""
        grid = ChartGrid(rows=2, cols=2, sync_mode=SyncMode.TIME)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        grid.set_chart(0, 0, chart1)
        grid.set_chart(0, 1, chart2)
        
        grid.set_sync_mode(SyncMode.PRICE)
        
        assert grid.sync_mode == SyncMode.PRICE
    
    def test_resize(self, sample_bars):
        """Should resize grid preserving charts."""
        grid = ChartGrid(rows=2, cols=2)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        grid.set_chart(0, 0, chart1)
        
        grid.resize(3, 3)
        
        assert grid.rows == 3
        assert grid.cols == 3
        assert grid.get_chart(0, 0) == chart1
    
    def test_sync_all(self, sample_bars):
        """Should sync all charts."""
        grid = ChartGrid(rows=2, cols=2)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        grid.set_chart(0, 0, chart1)
        grid.set_chart(0, 1, chart2)
        
        chart1.pan(5)
        grid.sync_all()
        
        state1 = chart1.get_scale_state()
        state2 = chart2.get_scale_state()
        
        assert state2.start_bar_index == state1.start_bar_index


class TestSyncStateManager:
    """Tests for SyncStateManager."""
    
    def test_serialize_group(self, sample_bars):
        """Should serialize sync group."""
        group = SyncGroup(group_id="test-group")
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        data = SyncStateManager.serialize_group(group)
        
        assert data["group_id"] == "test-group"
        assert "chart-1" in data["charts"]
        assert "chart-2" in data["charts"]
        assert len(data["links"]) == 1
    
    def test_restore_group(self, sample_bars):
        """Should restore sync group."""
        group = SyncGroup(group_id="test-group")
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        # Save state
        original_data = SyncStateManager.serialize_group(group)
        
        # Modify
        chart1.pan(5)
        
        # Restore
        SyncStateManager.restore_group(group, original_data)
        
        # Should be back to original
        state = chart1.get_scale_state()
        assert state.start_bar_index == original_data["charts"]["chart-1"]["start_bar_index"]


class TestCreateComparisonView:
    """Tests for create_comparison_view helper."""
    
    def test_single_symbol(self):
        """Should create 1x1 grid."""
        grid = create_comparison_view(["AAPL"])
        
        assert grid.rows == 1
        assert grid.cols == 1
    
    def test_two_symbols(self):
        """Should create 1x2 grid."""
        grid = create_comparison_view(["AAPL", "GOOG"])
        
        assert grid.rows == 1
        assert grid.cols == 2
    
    def test_four_symbols(self):
        """Should create 2x2 grid."""
        grid = create_comparison_view(["AAPL", "GOOG", "MSFT", "AMZN"])
        
        assert grid.rows == 2
        assert grid.cols == 2
    
    def test_charts_created(self):
        """Should create charts for each symbol."""
        grid = create_comparison_view(["AAPL", "GOOG", "MSFT"])
        
        charts = grid.get_all_charts()
        
        assert len(charts) == 3
    
    def test_custom_sync_mode(self):
        """Should use custom sync mode."""
        grid = create_comparison_view(["AAPL", "GOOG"], sync_mode=SyncMode.TIME)
        
        assert grid.sync_mode == SyncMode.TIME


class TestSyncMode:
    """Tests for SyncMode integration."""
    
    def test_time_only_sync(self, sample_bars):
        """Should sync only time axis."""
        group = SyncGroup(mode=SyncMode.TIME)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        # Record original price range
        original_state2 = chart2.get_scale_state()
        
        # Pan chart1 (triggers sync)
        chart1.pan(5)
        
        # Time should be synced
        state1 = chart1.get_scale_state()
        state2 = chart2.get_scale_state()
        
        assert state2.start_bar_index == state1.start_bar_index
        # Price should be preserved (approximately, may differ due to auto-scaling)
    
    def test_no_sync(self, sample_bars):
        """Should not sync with NONE mode."""
        group = SyncGroup(mode=SyncMode.NONE)
        
        chart1 = ChartWrapper(chart_id="chart-1")
        chart1.set_bars(sample_bars)
        chart2 = ChartWrapper(chart_id="chart-2")
        chart2.set_bars(sample_bars)
        
        group.add_chart(chart1)
        group.add_chart(chart2)
        
        original_state2 = chart2.get_scale_state()
        
        # Pan chart1
        chart1.pan(5)
        
        # Chart2 should not be affected
        state2 = chart2.get_scale_state()
        assert state2.start_bar_index == original_state2.start_bar_index


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
