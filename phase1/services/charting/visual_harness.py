"""
Visual Harness Module.

Playwright-based visual testing infrastructure for pixel-perfect
charting verification with deterministic screenshot comparison.
"""

import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple, Any
from pathlib import Path
from enum import Enum, auto
import base64


class PixelDiffResult(Enum):
    """Result of pixel comparison."""
    
    MATCH = auto()        # Exact match
    MISMATCH = auto()     # Pixels differ
    SIZE_MISMATCH = auto() # Dimensions differ
    MISSING_GOLDEN = auto() # No golden image


@dataclass
class DiffRegion:
    """Region where pixels differ."""
    
    x: int
    y: int
    width: int
    height: int
    pixel_count: int
    max_difference: int  # Max channel difference (0-255)


@dataclass
class PixelDiffReport:
    """
    Detailed pixel comparison report.
    
    Tracks all differences between actual and expected images.
    """
    
    result: PixelDiffResult
    total_pixels: int = 0
    differing_pixels: int = 0
    diff_percentage: float = 0.0
    max_channel_diff: int = 0
    
    actual_hash: str = ""
    expected_hash: str = ""
    
    actual_size: Tuple[int, int] = (0, 0)
    expected_size: Tuple[int, int] = (0, 0)
    
    diff_regions: List[DiffRegion] = field(default_factory=list)
    
    # Paths
    actual_path: str = ""
    expected_path: str = ""
    diff_path: str = ""
    
    @property
    def is_match(self) -> bool:
        """Check if images match."""
        return self.result == PixelDiffResult.MATCH
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "result": self.result.name,
            "total_pixels": self.total_pixels,
            "differing_pixels": self.differing_pixels,
            "diff_percentage": self.diff_percentage,
            "max_channel_diff": self.max_channel_diff,
            "actual_hash": self.actual_hash,
            "expected_hash": self.expected_hash,
            "actual_size": list(self.actual_size),
            "expected_size": list(self.expected_size),
            "diff_regions": [
                {
                    "x": r.x,
                    "y": r.y,
                    "width": r.width,
                    "height": r.height,
                    "pixel_count": r.pixel_count,
                    "max_difference": r.max_difference,
                }
                for r in self.diff_regions
            ],
        }


@dataclass
class BrowserConfig:
    """
    Deterministic browser configuration.
    
    Settings for pixel-perfect rendering across environments.
    """
    
    # Viewport
    width: int = 1280
    height: int = 800
    device_pixel_ratio: float = 2.0
    
    # Browser settings
    headless: bool = True
    browser_type: str = "chromium"
    
    # Determinism settings
    disable_gpu: bool = True
    font_render_hinting: str = "none"
    force_color_profile: str = "srgb"
    disable_animations: bool = True
    
    # Timeouts
    default_timeout_ms: int = 30000
    screenshot_timeout_ms: int = 10000
    
    def to_launch_args(self) -> List[str]:
        """Get browser launch arguments."""
        args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu-compositing",
        ]
        
        if self.disable_gpu:
            args.append("--disable-gpu")
        
        if self.font_render_hinting:
            args.append(f"--font-render-hinting={self.font_render_hinting}")
        
        if self.force_color_profile:
            args.append(f"--force-color-profile={self.force_color_profile}")
        
        if self.disable_animations:
            args.extend([
                "--disable-smooth-scrolling",
                "--wm-window-animations-disabled",
            ])
        
        return args
    
    def to_viewport_dict(self) -> Dict[str, Any]:
        """Get viewport configuration dict."""
        return {
            "width": self.width,
            "height": self.height,
            "deviceScaleFactor": self.device_pixel_ratio,
        }


@dataclass
class ScreenshotConfig:
    """Screenshot capture configuration."""
    
    full_page: bool = False
    clip: Optional[Dict[str, int]] = None  # {"x": 0, "y": 0, "width": 100, "height": 100}
    omit_background: bool = False
    
    # Format
    type: str = "png"
    quality: Optional[int] = None  # Only for jpeg
    
    # Timing
    wait_for_load: bool = True
    wait_for_animations: bool = True
    animation_wait_ms: int = 100


class PixelComparator:
    """
    Deterministic pixel comparison engine.
    
    Compares images with zero tolerance for pixel-perfect verification.
    """
    
    def __init__(self, tolerance: int = 0):
        """
        Initialize comparator.
        
        Args:
            tolerance: Per-channel tolerance (0 = exact match required)
        """
        self._tolerance = tolerance
    
    def compare(
        self,
        actual_bytes: bytes,
        expected_bytes: bytes,
    ) -> PixelDiffReport:
        """
        Compare two PNG images.
        
        Args:
            actual_bytes: Actual screenshot PNG bytes
            expected_bytes: Expected golden PNG bytes
            
        Returns:
            Detailed diff report
        """
        # Try to use PIL for comparison
        try:
            from PIL import Image
            import io
            
            actual_img = Image.open(io.BytesIO(actual_bytes))
            expected_img = Image.open(io.BytesIO(expected_bytes))
            
            return self._compare_images(actual_img, expected_img)
        except ImportError:
            # Fallback to hash comparison only
            return self._compare_hashes(actual_bytes, expected_bytes)
    
    def _compare_hashes(
        self,
        actual_bytes: bytes,
        expected_bytes: bytes,
    ) -> PixelDiffReport:
        """Hash-based comparison fallback."""
        actual_hash = hashlib.sha256(actual_bytes).hexdigest()
        expected_hash = hashlib.sha256(expected_bytes).hexdigest()
        
        if actual_hash == expected_hash:
            return PixelDiffReport(
                result=PixelDiffResult.MATCH,
                actual_hash=actual_hash,
                expected_hash=expected_hash,
            )
        else:
            return PixelDiffReport(
                result=PixelDiffResult.MISMATCH,
                actual_hash=actual_hash,
                expected_hash=expected_hash,
            )
    
    def _compare_images(
        self,
        actual: "Image.Image",
        expected: "Image.Image",
    ) -> PixelDiffReport:
        """Pixel-by-pixel comparison."""
        actual_hash = hashlib.sha256(actual.tobytes()).hexdigest()
        expected_hash = hashlib.sha256(expected.tobytes()).hexdigest()
        
        # Check size
        if actual.size != expected.size:
            return PixelDiffReport(
                result=PixelDiffResult.SIZE_MISMATCH,
                actual_size=actual.size,
                expected_size=expected.size,
                actual_hash=actual_hash,
                expected_hash=expected_hash,
            )
        
        width, height = actual.size
        total_pixels = width * height
        
        # Quick hash check
        if actual_hash == expected_hash:
            return PixelDiffReport(
                result=PixelDiffResult.MATCH,
                total_pixels=total_pixels,
                actual_size=actual.size,
                expected_size=expected.size,
                actual_hash=actual_hash,
                expected_hash=expected_hash,
            )
        
        # Convert to RGBA
        actual_rgba = actual.convert("RGBA")
        expected_rgba = expected.convert("RGBA")
        
        actual_data = actual_rgba.load()
        expected_data = expected_rgba.load()
        
        differing_pixels = 0
        max_channel_diff = 0
        diff_map = []
        
        for y in range(height):
            for x in range(width):
                actual_pixel = actual_data[x, y]
                expected_pixel = expected_data[x, y]
                
                # Calculate per-channel difference
                channel_diffs = [
                    abs(actual_pixel[i] - expected_pixel[i])
                    for i in range(4)  # RGBA
                ]
                
                max_diff = max(channel_diffs)
                
                if max_diff > self._tolerance:
                    differing_pixels += 1
                    max_channel_diff = max(max_channel_diff, max_diff)
                    diff_map.append((x, y, max_diff))
        
        # Build diff regions
        diff_regions = self._find_diff_regions(diff_map, width, height)
        
        if differing_pixels == 0:
            result = PixelDiffResult.MATCH
        else:
            result = PixelDiffResult.MISMATCH
        
        return PixelDiffReport(
            result=result,
            total_pixels=total_pixels,
            differing_pixels=differing_pixels,
            diff_percentage=(differing_pixels / total_pixels) * 100 if total_pixels > 0 else 0,
            max_channel_diff=max_channel_diff,
            actual_size=actual.size,
            expected_size=expected.size,
            actual_hash=actual_hash,
            expected_hash=expected_hash,
            diff_regions=diff_regions,
        )
    
    def _find_diff_regions(
        self,
        diff_map: List[Tuple[int, int, int]],
        width: int,
        height: int,
    ) -> List[DiffRegion]:
        """Find contiguous regions of difference."""
        if not diff_map:
            return []
        
        # Simple bounding box approach
        xs = [d[0] for d in diff_map]
        ys = [d[1] for d in diff_map]
        max_diffs = [d[2] for d in diff_map]
        
        return [DiffRegion(
            x=min(xs),
            y=min(ys),
            width=max(xs) - min(xs) + 1,
            height=max(ys) - min(ys) + 1,
            pixel_count=len(diff_map),
            max_difference=max(max_diffs),
        )]
    
    def create_diff_image(
        self,
        actual_bytes: bytes,
        expected_bytes: bytes,
    ) -> Optional[bytes]:
        """
        Create visual diff image.
        
        Red pixels indicate differences.
        """
        try:
            from PIL import Image
            import io
            
            actual = Image.open(io.BytesIO(actual_bytes)).convert("RGBA")
            expected = Image.open(io.BytesIO(expected_bytes)).convert("RGBA")
            
            if actual.size != expected.size:
                return None
            
            width, height = actual.size
            diff = Image.new("RGBA", (width, height), (0, 0, 0, 255))
            diff_data = diff.load()
            
            actual_data = actual.load()
            expected_data = expected.load()
            
            for y in range(height):
                for x in range(width):
                    actual_pixel = actual_data[x, y]
                    expected_pixel = expected_data[x, y]
                    
                    if actual_pixel != expected_pixel:
                        # Red for differences
                        diff_data[x, y] = (255, 0, 0, 255)
                    else:
                        # Grayscale for matching
                        gray = int(0.299 * actual_pixel[0] + 0.587 * actual_pixel[1] + 0.114 * actual_pixel[2])
                        diff_data[x, y] = (gray, gray, gray, 255)
            
            buffer = io.BytesIO()
            diff.save(buffer, format="PNG")
            return buffer.getvalue()
        except ImportError:
            return None


@dataclass
class GoldenImage:
    """Golden image reference."""
    
    name: str
    path: str
    hash: str
    size: Tuple[int, int]
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class GoldenStore:
    """
    Manages golden screenshot references.
    
    Stores and retrieves baseline images for comparison.
    """
    
    def __init__(self, base_path: str):
        """
        Initialize store.
        
        Args:
            base_path: Base directory for golden images
        """
        self._base_path = Path(base_path)
        self._manifest_path = self._base_path / "manifest.json"
        self._manifest: Dict[str, GoldenImage] = {}
        
        self._ensure_directory()
        self._load_manifest()
    
    def _ensure_directory(self) -> None:
        """Ensure base directory exists."""
        self._base_path.mkdir(parents=True, exist_ok=True)
    
    def _load_manifest(self) -> None:
        """Load manifest from disk."""
        if self._manifest_path.exists():
            with open(self._manifest_path) as f:
                data = json.load(f)
                for name, info in data.items():
                    self._manifest[name] = GoldenImage(
                        name=name,
                        path=info["path"],
                        hash=info["hash"],
                        size=tuple(info["size"]),
                        created_at=info["created_at"],
                        metadata=info.get("metadata", {}),
                    )
    
    def _save_manifest(self) -> None:
        """Save manifest to disk."""
        data = {}
        for name, img in self._manifest.items():
            data[name] = {
                "path": img.path,
                "hash": img.hash,
                "size": list(img.size),
                "created_at": img.created_at,
                "metadata": img.metadata,
            }
        
        with open(self._manifest_path, "w") as f:
            json.dump(data, f, indent=2)
    
    def get(self, name: str) -> Optional[bytes]:
        """Get golden image bytes."""
        if name not in self._manifest:
            return None
        
        path = self._base_path / self._manifest[name].path
        if not path.exists():
            return None
        
        return path.read_bytes()
    
    def get_info(self, name: str) -> Optional[GoldenImage]:
        """Get golden image metadata."""
        return self._manifest.get(name)
    
    def save(
        self,
        name: str,
        image_bytes: bytes,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GoldenImage:
        """
        Save golden image.
        
        Args:
            name: Image name/identifier
            image_bytes: PNG bytes
            metadata: Optional metadata
        """
        import datetime
        
        # Calculate hash
        img_hash = hashlib.sha256(image_bytes).hexdigest()
        
        # Determine size
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(image_bytes))
            size = img.size
        except ImportError:
            size = (0, 0)
        
        # Save file
        filename = f"{name}.png"
        path = self._base_path / filename
        path.write_bytes(image_bytes)
        
        # Update manifest
        golden = GoldenImage(
            name=name,
            path=filename,
            hash=img_hash,
            size=size,
            created_at=datetime.datetime.utcnow().isoformat(),
            metadata=metadata or {},
        )
        self._manifest[name] = golden
        self._save_manifest()
        
        return golden
    
    def delete(self, name: str) -> bool:
        """Delete golden image."""
        if name not in self._manifest:
            return False
        
        path = self._base_path / self._manifest[name].path
        if path.exists():
            path.unlink()
        
        del self._manifest[name]
        self._save_manifest()
        
        return True
    
    def list_all(self) -> List[str]:
        """List all golden image names."""
        return list(self._manifest.keys())
    
    def exists(self, name: str) -> bool:
        """Check if golden exists."""
        return name in self._manifest


@dataclass
class VisualTestResult:
    """Result of a visual test."""
    
    test_name: str
    passed: bool
    diff_report: Optional[PixelDiffReport]
    error: Optional[str] = None
    duration_ms: float = 0.0
    
    # Artifacts
    actual_screenshot: Optional[str] = None  # Base64 or path
    diff_image: Optional[str] = None  # Base64 or path
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "test_name": self.test_name,
            "passed": self.passed,
            "diff_report": self.diff_report.to_dict() if self.diff_report else None,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


class VisualTestRunner:
    """
    Runs visual regression tests.
    
    Orchestrates screenshot capture, comparison, and reporting.
    """
    
    def __init__(
        self,
        golden_store: GoldenStore,
        browser_config: Optional[BrowserConfig] = None,
        comparator: Optional[PixelComparator] = None,
    ):
        self._golden_store = golden_store
        self._browser_config = browser_config or BrowserConfig()
        self._comparator = comparator or PixelComparator(tolerance=0)
        self._results: List[VisualTestResult] = []
    
    def run_test(
        self,
        name: str,
        actual_screenshot: bytes,
        update_golden: bool = False,
    ) -> VisualTestResult:
        """
        Run single visual test.
        
        Args:
            name: Test name (matches golden image name)
            actual_screenshot: Current screenshot PNG bytes
            update_golden: If True, update golden instead of comparing
        """
        import time
        start = time.time()
        
        try:
            if update_golden:
                self._golden_store.save(name, actual_screenshot)
                result = VisualTestResult(
                    test_name=name,
                    passed=True,
                    diff_report=None,
                    duration_ms=(time.time() - start) * 1000,
                )
            else:
                expected = self._golden_store.get(name)
                
                if expected is None:
                    # No golden image
                    diff_report = PixelDiffReport(
                        result=PixelDiffResult.MISSING_GOLDEN,
                    )
                    result = VisualTestResult(
                        test_name=name,
                        passed=False,
                        diff_report=diff_report,
                        error=f"No golden image found for '{name}'",
                        duration_ms=(time.time() - start) * 1000,
                    )
                else:
                    diff_report = self._comparator.compare(actual_screenshot, expected)
                    
                    result = VisualTestResult(
                        test_name=name,
                        passed=diff_report.is_match,
                        diff_report=diff_report,
                        duration_ms=(time.time() - start) * 1000,
                    )
                    
                    if not diff_report.is_match:
                        # Generate diff image
                        diff_bytes = self._comparator.create_diff_image(actual_screenshot, expected)
                        if diff_bytes:
                            result.diff_image = base64.b64encode(diff_bytes).decode()
            
            self._results.append(result)
            return result
            
        except Exception as e:
            result = VisualTestResult(
                test_name=name,
                passed=False,
                diff_report=None,
                error=str(e),
                duration_ms=(time.time() - start) * 1000,
            )
            self._results.append(result)
            return result
    
    def get_results(self) -> List[VisualTestResult]:
        """Get all test results."""
        return self._results.copy()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get test summary."""
        passed = sum(1 for r in self._results if r.passed)
        failed = len(self._results) - passed
        
        return {
            "total": len(self._results),
            "passed": passed,
            "failed": failed,
            "pass_rate": (passed / len(self._results) * 100) if self._results else 0,
            "tests": [r.to_dict() for r in self._results],
        }
    
    def clear_results(self) -> None:
        """Clear all results."""
        self._results = []


def create_visual_harness(
    golden_path: str,
    tolerance: int = 0,
    browser_config: Optional[BrowserConfig] = None,
) -> VisualTestRunner:
    """
    Create visual test harness.
    
    Args:
        golden_path: Path to golden images directory
        tolerance: Pixel tolerance (0 = exact match)
        browser_config: Browser configuration
    """
    store = GoldenStore(golden_path)
    comparator = PixelComparator(tolerance=tolerance)
    
    return VisualTestRunner(
        golden_store=store,
        browser_config=browser_config or BrowserConfig(),
        comparator=comparator,
    )
