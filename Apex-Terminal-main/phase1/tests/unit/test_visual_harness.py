"""
Tests for Visual Harness Module.

Tests pixel comparison, golden image storage, and visual test running.
"""

import pytest
import tempfile
import os
from pathlib import Path

from services.charting.visual_harness import (
    PixelDiffResult,
    DiffRegion,
    PixelDiffReport,
    BrowserConfig,
    ScreenshotConfig,
    PixelComparator,
    GoldenImage,
    GoldenStore,
    VisualTestResult,
    VisualTestRunner,
    create_visual_harness,
)


# ============================================================================
# Helper Functions
# ============================================================================

def create_test_png(width: int = 100, height: int = 100, color: tuple = (255, 0, 0, 255)) -> bytes:
    """Create a test PNG image."""
    try:
        from PIL import Image
        import io
        
        img = Image.new("RGBA", (width, height), color)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()
    except ImportError:
        # Return minimal PNG
        return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00d\x00\x00\x00d\x08\x02\x00\x00\x00\xff\x80\x02\x03'


# ============================================================================
# PixelDiffResult Tests
# ============================================================================

class TestPixelDiffResult:
    """Tests for PixelDiffResult enum."""
    
    def test_all_results_exist(self):
        """Test all result types exist."""
        assert PixelDiffResult.MATCH is not None
        assert PixelDiffResult.MISMATCH is not None
        assert PixelDiffResult.SIZE_MISMATCH is not None
        assert PixelDiffResult.MISSING_GOLDEN is not None


# ============================================================================
# DiffRegion Tests
# ============================================================================

class TestDiffRegion:
    """Tests for DiffRegion class."""
    
    def test_create_region(self):
        """Test creating diff region."""
        region = DiffRegion(
            x=10,
            y=20,
            width=50,
            height=30,
            pixel_count=100,
            max_difference=128,
        )
        
        assert region.x == 10
        assert region.y == 20
        assert region.width == 50
        assert region.height == 30
        assert region.pixel_count == 100
        assert region.max_difference == 128


# ============================================================================
# PixelDiffReport Tests
# ============================================================================

class TestPixelDiffReport:
    """Tests for PixelDiffReport class."""
    
    def test_match_report(self):
        """Test match report."""
        report = PixelDiffReport(
            result=PixelDiffResult.MATCH,
            total_pixels=10000,
            differing_pixels=0,
        )
        
        assert report.is_match
        assert report.differing_pixels == 0
    
    def test_mismatch_report(self):
        """Test mismatch report."""
        report = PixelDiffReport(
            result=PixelDiffResult.MISMATCH,
            total_pixels=10000,
            differing_pixels=100,
            diff_percentage=1.0,
        )
        
        assert not report.is_match
        assert report.diff_percentage == 1.0
    
    def test_to_dict(self):
        """Test converting to dict."""
        report = PixelDiffReport(
            result=PixelDiffResult.MATCH,
            total_pixels=10000,
            actual_hash="abc123",
            expected_hash="abc123",
        )
        
        d = report.to_dict()
        
        assert d["result"] == "MATCH"
        assert d["total_pixels"] == 10000
        assert d["actual_hash"] == "abc123"
    
    def test_report_with_regions(self):
        """Test report with diff regions."""
        regions = [
            DiffRegion(x=0, y=0, width=10, height=10, pixel_count=50, max_difference=200),
        ]
        
        report = PixelDiffReport(
            result=PixelDiffResult.MISMATCH,
            diff_regions=regions,
        )
        
        d = report.to_dict()
        assert len(d["diff_regions"]) == 1


# ============================================================================
# BrowserConfig Tests
# ============================================================================

class TestBrowserConfig:
    """Tests for BrowserConfig class."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = BrowserConfig()
        
        assert config.width == 1280
        assert config.height == 800
        assert config.device_pixel_ratio == 2.0
        assert config.headless is True
    
    def test_launch_args(self):
        """Test getting launch arguments."""
        config = BrowserConfig(
            disable_gpu=True,
            font_render_hinting="none",
            force_color_profile="srgb",
        )
        
        args = config.to_launch_args()
        
        assert "--disable-gpu" in args
        assert "--font-render-hinting=none" in args
        assert "--force-color-profile=srgb" in args
    
    def test_viewport_dict(self):
        """Test viewport dictionary."""
        config = BrowserConfig(
            width=1920,
            height=1080,
            device_pixel_ratio=1.5,
        )
        
        viewport = config.to_viewport_dict()
        
        assert viewport["width"] == 1920
        assert viewport["height"] == 1080
        assert viewport["deviceScaleFactor"] == 1.5


# ============================================================================
# ScreenshotConfig Tests
# ============================================================================

class TestScreenshotConfig:
    """Tests for ScreenshotConfig class."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = ScreenshotConfig()
        
        assert config.full_page is False
        assert config.type == "png"
        assert config.wait_for_load is True
    
    def test_custom_config(self):
        """Test custom configuration."""
        config = ScreenshotConfig(
            full_page=True,
            clip={"x": 0, "y": 0, "width": 500, "height": 500},
            type="jpeg",
            quality=90,
        )
        
        assert config.full_page is True
        assert config.clip["width"] == 500
        assert config.quality == 90


# ============================================================================
# PixelComparator Tests
# ============================================================================

class TestPixelComparator:
    """Tests for PixelComparator class."""
    
    def test_create_comparator(self):
        """Test creating comparator."""
        comparator = PixelComparator(tolerance=0)
        assert comparator is not None
    
    def test_compare_identical_images(self):
        """Test comparing identical images."""
        comparator = PixelComparator(tolerance=0)
        
        img = create_test_png(100, 100, (255, 0, 0, 255))
        
        report = comparator.compare(img, img)
        
        assert report.is_match
    
    def test_compare_different_images(self):
        """Test comparing different images."""
        comparator = PixelComparator(tolerance=0)
        
        img1 = create_test_png(100, 100, (255, 0, 0, 255))
        img2 = create_test_png(100, 100, (0, 255, 0, 255))
        
        report = comparator.compare(img1, img2)
        
        assert not report.is_match
        assert report.result == PixelDiffResult.MISMATCH
    
    def test_compare_different_sizes(self):
        """Test comparing images of different sizes."""
        comparator = PixelComparator()
        
        img1 = create_test_png(100, 100)
        img2 = create_test_png(200, 200)
        
        report = comparator.compare(img1, img2)
        
        assert report.result == PixelDiffResult.SIZE_MISMATCH
    
    def test_compare_with_tolerance(self):
        """Test comparing with tolerance."""
        comparator = PixelComparator(tolerance=10)
        
        # Images with slight difference
        img1 = create_test_png(100, 100, (255, 0, 0, 255))
        img2 = create_test_png(100, 100, (250, 0, 0, 255))  # 5 difference
        
        report = comparator.compare(img1, img2)
        
        # Should match within tolerance
        assert report.is_match
    
    def test_create_diff_image(self):
        """Test creating diff image."""
        comparator = PixelComparator()
        
        img1 = create_test_png(100, 100, (255, 0, 0, 255))
        img2 = create_test_png(100, 100, (0, 255, 0, 255))
        
        diff = comparator.create_diff_image(img1, img2)
        
        assert diff is not None
        assert len(diff) > 0


# ============================================================================
# GoldenStore Tests
# ============================================================================

class TestGoldenStore:
    """Tests for GoldenStore class."""
    
    def test_create_store(self):
        """Test creating store."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            assert store is not None
    
    def test_save_and_get(self):
        """Test saving and retrieving golden."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            img = create_test_png(100, 100)
            store.save("test_image", img)
            
            retrieved = store.get("test_image")
            
            assert retrieved is not None
            assert retrieved == img
    
    def test_get_nonexistent(self):
        """Test getting nonexistent golden."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            retrieved = store.get("nonexistent")
            
            assert retrieved is None
    
    def test_get_info(self):
        """Test getting golden info."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            img = create_test_png(100, 100)
            store.save("test_image", img, metadata={"key": "value"})
            
            info = store.get_info("test_image")
            
            assert info is not None
            assert info.name == "test_image"
            assert info.metadata == {"key": "value"}
    
    def test_delete(self):
        """Test deleting golden."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            img = create_test_png(100, 100)
            store.save("test_image", img)
            
            result = store.delete("test_image")
            
            assert result is True
            assert store.get("test_image") is None
    
    def test_list_all(self):
        """Test listing all goldens."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            store.save("image1", create_test_png())
            store.save("image2", create_test_png())
            store.save("image3", create_test_png())
            
            names = store.list_all()
            
            assert len(names) == 3
            assert "image1" in names
            assert "image2" in names
            assert "image3" in names
    
    def test_exists(self):
        """Test checking existence."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            
            store.save("test_image", create_test_png())
            
            assert store.exists("test_image")
            assert not store.exists("nonexistent")
    
    def test_persistence(self):
        """Test persistence across store instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save with first store
            store1 = GoldenStore(tmpdir)
            img = create_test_png()
            store1.save("persistent_image", img)
            
            # Load with new store
            store2 = GoldenStore(tmpdir)
            retrieved = store2.get("persistent_image")
            
            assert retrieved == img


# ============================================================================
# VisualTestResult Tests
# ============================================================================

class TestVisualTestResult:
    """Tests for VisualTestResult class."""
    
    def test_passed_result(self):
        """Test passed result."""
        result = VisualTestResult(
            test_name="test_chart",
            passed=True,
            diff_report=PixelDiffReport(result=PixelDiffResult.MATCH),
        )
        
        assert result.passed
        assert result.error is None
    
    def test_failed_result(self):
        """Test failed result."""
        result = VisualTestResult(
            test_name="test_chart",
            passed=False,
            diff_report=PixelDiffReport(result=PixelDiffResult.MISMATCH),
            error="Pixels differ",
        )
        
        assert not result.passed
        assert result.error == "Pixels differ"
    
    def test_to_dict(self):
        """Test converting to dict."""
        result = VisualTestResult(
            test_name="test_chart",
            passed=True,
            diff_report=PixelDiffReport(result=PixelDiffResult.MATCH),
            duration_ms=150.5,
        )
        
        d = result.to_dict()
        
        assert d["test_name"] == "test_chart"
        assert d["passed"] is True
        assert d["duration_ms"] == 150.5


# ============================================================================
# VisualTestRunner Tests
# ============================================================================

class TestVisualTestRunner:
    """Tests for VisualTestRunner class."""
    
    def test_create_runner(self):
        """Test creating runner."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            assert runner is not None
    
    def test_run_test_match(self):
        """Test running test with match."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png(100, 100)
            store.save("chart_test", img)
            
            result = runner.run_test("chart_test", img)
            
            assert result.passed
    
    def test_run_test_mismatch(self):
        """Test running test with mismatch."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            golden = create_test_png(100, 100, (255, 0, 0, 255))
            actual = create_test_png(100, 100, (0, 255, 0, 255))
            
            store.save("chart_test", golden)
            
            result = runner.run_test("chart_test", actual)
            
            assert not result.passed
    
    def test_run_test_missing_golden(self):
        """Test running test with missing golden."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png()
            
            result = runner.run_test("nonexistent", img)
            
            assert not result.passed
            assert "No golden image" in result.error
    
    def test_run_test_update_golden(self):
        """Test running test with update mode."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png()
            
            result = runner.run_test("new_test", img, update_golden=True)
            
            assert result.passed
            assert store.exists("new_test")
    
    def test_get_results(self):
        """Test getting results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png()
            store.save("test1", img)
            store.save("test2", img)
            
            runner.run_test("test1", img)
            runner.run_test("test2", img)
            
            results = runner.get_results()
            
            assert len(results) == 2
    
    def test_get_summary(self):
        """Test getting summary."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png()
            store.save("test1", img)
            
            runner.run_test("test1", img)
            runner.run_test("missing", img)
            
            summary = runner.get_summary()
            
            assert summary["total"] == 2
            assert summary["passed"] == 1
            assert summary["failed"] == 1
    
    def test_clear_results(self):
        """Test clearing results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = GoldenStore(tmpdir)
            runner = VisualTestRunner(store)
            
            img = create_test_png()
            store.save("test1", img)
            runner.run_test("test1", img)
            
            runner.clear_results()
            
            assert len(runner.get_results()) == 0


# ============================================================================
# create_visual_harness Tests
# ============================================================================

class TestCreateVisualHarness:
    """Tests for create_visual_harness function."""
    
    def test_create_harness(self):
        """Test creating harness."""
        with tempfile.TemporaryDirectory() as tmpdir:
            harness = create_visual_harness(tmpdir)
            
            assert harness is not None
    
    def test_create_harness_with_tolerance(self):
        """Test creating harness with tolerance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            harness = create_visual_harness(tmpdir, tolerance=5)
            
            # Comparator should have tolerance
            img1 = create_test_png(100, 100, (255, 0, 0, 255))
            img2 = create_test_png(100, 100, (250, 0, 0, 255))
            
            harness._golden_store.save("test", img1)
            result = harness.run_test("test", img2)
            
            assert result.passed
    
    def test_create_harness_with_browser_config(self):
        """Test creating harness with browser config."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = BrowserConfig(width=1920, height=1080)
            harness = create_visual_harness(tmpdir, browser_config=config)
            
            assert harness._browser_config.width == 1920


# ============================================================================
# GoldenImage Tests
# ============================================================================

class TestGoldenImage:
    """Tests for GoldenImage class."""
    
    def test_create_golden_image(self):
        """Test creating golden image."""
        golden = GoldenImage(
            name="test_chart",
            path="test_chart.png",
            hash="abc123",
            size=(1280, 800),
            created_at="2024-01-01T00:00:00",
        )
        
        assert golden.name == "test_chart"
        assert golden.path == "test_chart.png"
        assert golden.size == (1280, 800)
    
    def test_golden_image_metadata(self):
        """Test golden image with metadata."""
        golden = GoldenImage(
            name="test",
            path="test.png",
            hash="abc",
            size=(100, 100),
            created_at="2024-01-01",
            metadata={"browser": "chromium", "dpr": 2.0},
        )
        
        assert golden.metadata["browser"] == "chromium"
        assert golden.metadata["dpr"] == 2.0
