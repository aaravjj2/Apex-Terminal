"""
Charting Engine - Phase 3.

Deterministic, pixel-accurate charting with:
- Canvas2D renderer
- Scale engine
- Drawing tools
- Multi-chart sync
- Indicator panels
"""

from services.charting.renderer import (
    RendererConfig,
    RenderContext,
    DeterministicRenderer,
    CanvasRenderer,
)
from services.charting.primitives import (
    Point,
    Rect,
    Color,
    LineStyle,
    FillStyle,
)

__all__ = [
    "RendererConfig",
    "RenderContext",
    "DeterministicRenderer",
    "CanvasRenderer",
    "Point",
    "Rect",
    "Color",
    "LineStyle",
    "FillStyle",
]
