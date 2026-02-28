"""
chart_annotations.py — Chart Annotations & Drawings REST API
=============================================================
Full CRUD for chart drawings, annotations, groups, undo/redo,
and analytics. Per-chart engine instances keyed by chart_id.

Endpoints:
    POST   /api/v1/chart-annotations/{chart_id}/drawings         → Create drawing
    GET    /api/v1/chart-annotations/{chart_id}/drawings         → List drawings
    GET    /api/v1/chart-annotations/{chart_id}/drawings/{id}    → Get drawing
    PUT    /api/v1/chart-annotations/{chart_id}/drawings/{id}    → Update drawing
    DELETE /api/v1/chart-annotations/{chart_id}/drawings/{id}    → Delete drawing
    DELETE /api/v1/chart-annotations/{chart_id}/drawings         → Delete all
    POST   /api/v1/chart-annotations/{chart_id}/drawings/{id}/duplicate → Duplicate
    POST   /api/v1/chart-annotations/{chart_id}/undo             → Undo
    POST   /api/v1/chart-annotations/{chart_id}/redo             → Redo
    POST   /api/v1/chart-annotations/{chart_id}/groups           → Create group
    PUT    /api/v1/chart-annotations/{chart_id}/groups/{gid}     → Update group
    DELETE /api/v1/chart-annotations/{chart_id}/groups/{gid}/drawings/{did} → Remove from group
    PUT    /api/v1/chart-annotations/{chart_id}/groups/{gid}/visibility → Toggle visibility
    POST   /api/v1/chart-annotations/{chart_id}/export           → Export JSON
    POST   /api/v1/chart-annotations/{chart_id}/import           → Import JSON
    POST   /api/v1/chart-annotations/{chart_id}/export/pine      → Export Pine Script
    GET    /api/v1/chart-annotations/{chart_id}/analytics/clusters       → Price clusters
    GET    /api/v1/chart-annotations/{chart_id}/analytics/trend-summary  → Trend summary
    GET    /api/v1/chart-annotations/{chart_id}/analytics/type-stats     → Drawing type stats
    GET    /api/v1/chart-annotations/{chart_id}/analytics/support-resistance → S/R from drawings
    POST   /api/v1/chart-annotations/{chart_id}/snap             → Snap point to bar data
    POST   /api/v1/chart-annotations/{chart_id}/enrich           → Enrich/compute drawing props
    GET    /api/v1/chart-annotations/geometry/distance            → Point distance
    GET    /api/v1/chart-annotations/geometry/intersection        → Line intersection
    POST   /api/v1/chart-annotations/fibonacci/retracement       → Fib retracement levels
    POST   /api/v1/chart-annotations/fibonacci/extension         → Fib extension levels
    POST   /api/v1/chart-annotations/fibonacci/fan               → Fib fan lines
    POST   /api/v1/chart-annotations/fibonacci/arcs              → Fib arcs
    POST   /api/v1/chart-annotations/fibonacci/time-zones        → Fib time zones
    POST   /api/v1/chart-annotations/pitchfork/andrews           → Andrews' Pitchfork
    POST   /api/v1/chart-annotations/pitchfork/schiff            → Schiff Pitchfork
    POST   /api/v1/chart-annotations/pitchfork/modified-schiff   → Modified Schiff
    POST   /api/v1/chart-annotations/gann/fan                    → Gann Fan
    POST   /api/v1/chart-annotations/gann/box                    → Gann Box
    POST   /api/v1/chart-annotations/gann/square-of-nine         → Gann Square of Nine
    GET    /api/v1/chart-annotations/capabilities                → List capabilities
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from phase1.services.chart_annotations_engine import (
    ChartAnnotationsEngine, Annotation, Point, DrawingStyle,
    FibonacciConfig, RiskRewardConfig, DrawingType, LineStyle,
    AnchorType, SnapMode, GeometryUtils, FibonacciCalculator,
    PitchforkCalculator, GannCalculator, SnapEngine, DrawingAnalytics,
)

router = APIRouter(prefix="/api/v1/chart-annotations", tags=["Chart Annotations"])


# ─── Engine Store ────────────────────────────────────────────────────────────
# One engine per chart_id, lazily created.
_engines: Dict[str, ChartAnnotationsEngine] = {}


def _get_engine(chart_id: str) -> ChartAnnotationsEngine:
    if chart_id not in _engines:
        _engines[chart_id] = ChartAnnotationsEngine()
    return _engines[chart_id]


# ─── Pydantic Models ────────────────────────────────────────────────────────

class PointModel(BaseModel):
    x: float = 0
    y: float = 0
    bar_index: Optional[int] = None
    timestamp: Optional[float] = None


class DrawingStyleModel(BaseModel):
    color: str = "#f5a623"
    width: float = 1.0
    line_style: str = "solid"
    fill_color: Optional[str] = None
    fill_opacity: float = 0.1
    font_size: float = 12.0
    font_family: str = "IBM Plex Mono"
    show_label: bool = True
    show_price: bool = True


class FibConfigModel(BaseModel):
    levels: List[float] = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    show_levels: bool = True
    show_prices: bool = True
    show_percents: bool = True
    extend_left: bool = False
    extend_right: bool = False


class RiskRewardModel(BaseModel):
    entry_price: float
    stop_loss: float
    take_profit: float
    quantity: float = 1.0
    risk_reward_ratio: Optional[float] = None


class CreateDrawingRequest(BaseModel):
    drawing_type: str
    points: List[PointModel]
    style: Optional[DrawingStyleModel] = None
    text: Optional[str] = None
    locked: bool = False
    visible: bool = True
    layer: int = 0
    symbol: Optional[str] = None
    timeframe: Optional[str] = None
    fib_config: Optional[FibConfigModel] = None
    risk_reward: Optional[RiskRewardModel] = None
    computed: Optional[Dict[str, Any]] = None


class UpdateDrawingRequest(BaseModel):
    points: Optional[List[PointModel]] = None
    style: Optional[DrawingStyleModel] = None
    text: Optional[str] = None
    locked: Optional[bool] = None
    visible: Optional[bool] = None
    layer: Optional[int] = None
    fib_config: Optional[FibConfigModel] = None
    risk_reward: Optional[RiskRewardModel] = None


class CreateGroupRequest(BaseModel):
    name: str
    annotation_ids: Optional[List[str]] = None


class AddToGroupRequest(BaseModel):
    annotation_id: str


class ExportRequest(BaseModel):
    drawing_types: Optional[List[str]] = None


class ImportRequest(BaseModel):
    data: Dict[str, Any]


class SnapRequest(BaseModel):
    point: PointModel
    bars: List[Dict[str, Any]]
    mode: str = "bar"


class ThreePointModel(BaseModel):
    p1: PointModel
    p2: PointModel
    p3: PointModel


class TwoPointModel(BaseModel):
    high_price: float
    low_price: float


class BarDataModel(BaseModel):
    bars: List[Dict[str, Any]]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _point_model_to_point(pm: PointModel) -> Point:
    return Point(x=pm.x, y=pm.y, bar_index=pm.bar_index, timestamp=pm.timestamp)


def _style_model_to_style(sm: DrawingStyleModel) -> DrawingStyle:
    return DrawingStyle(
        color=sm.color, width=sm.width,
        line_style=LineStyle(sm.line_style) if sm.line_style in [e.value for e in LineStyle] else LineStyle.SOLID,
        fill_color=sm.fill_color, fill_opacity=sm.fill_opacity,
        font_size=sm.font_size, font_family=sm.font_family,
        show_label=sm.show_label, show_price=sm.show_price,
    )


def _fib_model_to_config(fm: FibConfigModel) -> FibonacciConfig:
    return FibonacciConfig(
        levels=fm.levels, show_levels=fm.show_levels,
        show_prices=fm.show_prices, show_percents=fm.show_percents,
        extend_left=fm.extend_left, extend_right=fm.extend_right,
    )


def _rr_model_to_config(rm: RiskRewardModel) -> RiskRewardConfig:
    return RiskRewardConfig(
        entry_price=rm.entry_price, stop_loss=rm.stop_loss,
        take_profit=rm.take_profit, quantity=rm.quantity,
        risk_reward_ratio=rm.risk_reward_ratio,
    )


def _build_annotation(req: CreateDrawingRequest) -> Annotation:
    try:
        dt = DrawingType(req.drawing_type)
    except ValueError:
        raise HTTPException(400, f"Unknown drawing_type: {req.drawing_type}")
    points = [_point_model_to_point(p) for p in req.points]
    style = _style_model_to_style(req.style) if req.style else DrawingStyle()
    fib = _fib_model_to_config(req.fib_config) if req.fib_config else None
    rr = _rr_model_to_config(req.risk_reward) if req.risk_reward else None
    return Annotation(
        drawing_type=dt, points=points, style=style,
        text=req.text or "", locked=req.locked, visible=req.visible,
        layer=req.layer, symbol=req.symbol or "",
        timeframe=req.timeframe or "", fib_config=fib,
        risk_reward=rr, computed=req.computed or {},
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  CRUD Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{chart_id}/drawings")
def create_drawing(chart_id: str, req: CreateDrawingRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    ann = _build_annotation(req)
    created = engine.create(ann)
    return {"status": "ok", "drawing": created.to_dict()}


@router.get("/{chart_id}/drawings")
def list_drawings(
    chart_id: str,
    drawing_type: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    visible_only: bool = Query(False),
) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    dt = DrawingType(drawing_type) if drawing_type else None
    drawings = engine.get_all(drawing_type=dt, symbol=symbol, timeframe=timeframe)
    if visible_only:
        drawings = [d for d in drawings if d.visible]
    return {
        "count": len(drawings),
        "drawings": [d.to_dict() for d in drawings],
    }


@router.get("/{chart_id}/drawings/{drawing_id}")
def get_drawing(chart_id: str, drawing_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    ann = engine.get(drawing_id)
    if not ann:
        raise HTTPException(404, f"Drawing {drawing_id} not found")
    return {"drawing": ann.to_dict()}


@router.put("/{chart_id}/drawings/{drawing_id}")
def update_drawing(chart_id: str, drawing_id: str, req: UpdateDrawingRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    existing = engine.get(drawing_id)
    if not existing:
        raise HTTPException(404, f"Drawing {drawing_id} not found")
    if existing.locked:
        raise HTTPException(409, "Drawing is locked")
    updates: Dict[str, Any] = {}
    if req.points is not None:
        updates['points'] = [_point_model_to_point(p) for p in req.points]
    if req.style is not None:
        updates['style'] = _style_model_to_style(req.style)
    if req.text is not None:
        updates['text'] = req.text
    if req.locked is not None:
        updates['locked'] = req.locked
    if req.visible is not None:
        updates['visible'] = req.visible
    if req.layer is not None:
        updates['layer'] = req.layer
    if req.fib_config is not None:
        updates['fib_config'] = _fib_model_to_config(req.fib_config)
    if req.risk_reward is not None:
        updates['risk_reward'] = _rr_model_to_config(req.risk_reward)
    updated = engine.update(drawing_id, **updates)
    if not updated:
        raise HTTPException(500, "Update failed")
    return {"status": "ok", "drawing": updated.to_dict()}


@router.delete("/{chart_id}/drawings/{drawing_id}")
def delete_drawing(chart_id: str, drawing_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    success = engine.delete(drawing_id)
    if not success:
        raise HTTPException(404, f"Drawing {drawing_id} not found")
    return {"status": "ok", "deleted": drawing_id}


@router.delete("/{chart_id}/drawings")
def delete_all_drawings(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    count = engine.count
    engine.delete_all()
    return {"status": "ok", "deleted_count": count}


@router.post("/{chart_id}/drawings/{drawing_id}/duplicate")
def duplicate_drawing(chart_id: str, drawing_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    dup = engine.duplicate(drawing_id)
    if not dup:
        raise HTTPException(404, f"Drawing {drawing_id} not found")
    return {"status": "ok", "drawing": dup.to_dict()}


# ═══════════════════════════════════════════════════════════════════════════════
#  Undo / Redo
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{chart_id}/undo")
def undo(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    action = engine.undo()
    if not action:
        return {"status": "nothing_to_undo"}
    return {"status": "ok", "action": action}


@router.post("/{chart_id}/redo")
def redo(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    action = engine.redo()
    if not action:
        return {"status": "nothing_to_redo"}
    return {"status": "ok", "action": action}


# ═══════════════════════════════════════════════════════════════════════════════
#  Groups
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{chart_id}/groups")
def create_group(chart_id: str, req: CreateGroupRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    group = engine.create_group(name=req.name, annotation_ids=req.annotation_ids)
    return {"status": "ok", "group": {"id": group.id, "name": group.name, "annotations": group.annotations}}


@router.put("/{chart_id}/groups/{group_id}")
def add_to_group(chart_id: str, group_id: str, req: AddToGroupRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    success = engine.add_to_group(group_id, req.annotation_id)
    if not success:
        raise HTTPException(404, "Group or annotation not found")
    return {"status": "ok"}


@router.delete("/{chart_id}/groups/{group_id}/drawings/{drawing_id}")
def remove_from_group(chart_id: str, group_id: str, drawing_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    success = engine.remove_from_group(group_id, drawing_id)
    if not success:
        raise HTTPException(404, "Group or annotation not found")
    return {"status": "ok"}


@router.put("/{chart_id}/groups/{group_id}/visibility")
def toggle_group_visibility(chart_id: str, group_id: str, visible: bool = Query(...)) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    engine.toggle_group_visibility(group_id, visible)
    return {"status": "ok", "visible": visible}


# ═══════════════════════════════════════════════════════════════════════════════
#  Export / Import
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{chart_id}/export")
def export_drawings(chart_id: str, req: Optional[ExportRequest] = None) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    dt_filter = None
    if req and req.drawing_types:
        dt_filter = [DrawingType(dt) for dt in req.drawing_types]
    return engine.export_json(drawing_types=dt_filter)


@router.post("/{chart_id}/import")
def import_drawings(chart_id: str, req: ImportRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    count = engine.import_json(req.data)
    return {"status": "ok", "imported_count": count}


@router.post("/{chart_id}/export/pine")
def export_pine_script(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    script = engine.export_pine_script()
    return {"script": script}


# ═══════════════════════════════════════════════════════════════════════════════
#  Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{chart_id}/analytics/clusters")
def price_clusters(
    chart_id: str,
    num_clusters: int = Query(5),
    min_distance: float = Query(0.5),
) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    return {"clusters": engine.analytics_price_clusters(num_clusters, min_distance)}


@router.get("/{chart_id}/analytics/trend-summary")
def trend_summary(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    return {"summary": engine.analytics_trend_summary()}


@router.get("/{chart_id}/analytics/type-stats")
def type_stats(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    return {"stats": engine.analytics_type_stats()}


@router.get("/{chart_id}/analytics/support-resistance")
def support_resistance(chart_id: str) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    return {"levels": engine.analytics_support_resistance()}


# ═══════════════════════════════════════════════════════════════════════════════
#  Snap & Enrich
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{chart_id}/snap")
def snap_point(chart_id: str, req: SnapRequest) -> Dict[str, Any]:
    point = _point_model_to_point(req.point)
    bars = req.bars
    try:
        mode = SnapMode(req.mode)
    except ValueError:
        mode = SnapMode.BAR
    if mode == SnapMode.BAR:
        result = SnapEngine.snap_to_bar(point, bars)
    elif mode == SnapMode.OHLC:
        result = SnapEngine.snap_to_ohlc(point, bars)
    elif mode == SnapMode.ROUND:
        result = SnapEngine.snap_to_round(point)
    elif mode == SnapMode.MAGNETIC:
        result = SnapEngine.magnetic_snap(point, bars)
    else:
        result = point
    return {"snapped": result.to_dict()}


@router.post("/{chart_id}/enrich")
def enrich_drawing(chart_id: str, req: CreateDrawingRequest) -> Dict[str, Any]:
    engine = _get_engine(chart_id)
    ann = _build_annotation(req)
    enriched = engine._enrich(ann)
    return {"drawing": enriched.to_dict()}


# ═══════════════════════════════════════════════════════════════════════════════
#  Geometry Utilities (stateless, no chart_id)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/geometry/distance")
def geometry_distance(
    x1: float = Query(...), y1: float = Query(...),
    x2: float = Query(...), y2: float = Query(...),
) -> Dict[str, float]:
    d = GeometryUtils.distance(Point(x=x1, y=y1), Point(x=x2, y=y2))
    return {"distance": d}


@router.get("/geometry/intersection")
def geometry_intersection(
    # Line 1: (x1,y1)-(x2,y2), Line 2: (x3,y3)-(x4,y4)
    x1: float = Query(...), y1: float = Query(...),
    x2: float = Query(...), y2: float = Query(...),
    x3: float = Query(...), y3: float = Query(...),
    x4: float = Query(...), y4: float = Query(...),
) -> Dict[str, Any]:
    p1, p2 = Point(x=x1, y=y1), Point(x=x2, y=y2)
    p3, p4 = Point(x=x3, y=y3), Point(x=x4, y=y4)
    l1 = GeometryUtils.line_equation(p1, p2)
    l2 = GeometryUtils.line_equation(p3, p4)
    result = GeometryUtils.line_intersection(l1, l2)
    if result is None:
        return {"intersection": None, "parallel": True}
    return {"intersection": {"x": result.x, "y": result.y}, "parallel": False}


@router.get("/geometry/angle")
def geometry_angle(
    x1: float = Query(...), y1: float = Query(...),
    x2: float = Query(...), y2: float = Query(...),
) -> Dict[str, float]:
    return {"angle_degrees": GeometryUtils.angle_degrees(Point(x=x1, y=y1), Point(x=x2, y=y2))}


@router.get("/geometry/midpoint")
def geometry_midpoint(
    x1: float = Query(...), y1: float = Query(...),
    x2: float = Query(...), y2: float = Query(...),
) -> Dict[str, float]:
    m = GeometryUtils.midpoint(Point(x=x1, y=y1), Point(x=x2, y=y2))
    return {"x": m.x, "y": m.y}


@router.get("/geometry/bounding-box")
def geometry_bounding_box(points: str = Query(..., description="Comma-sep x1,y1,x2,y2,...")) -> Dict[str, Any]:
    coords = [float(v) for v in points.split(",")]
    pts = [Point(x=coords[i], y=coords[i + 1]) for i in range(0, len(coords), 2)]
    bb = GeometryUtils.bounding_box(pts)
    return {"min_x": bb[0], "min_y": bb[1], "max_x": bb[2], "max_y": bb[3]}


# ═══════════════════════════════════════════════════════════════════════════════
#  Fibonacci Calculators (stateless)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/fibonacci/retracement")
def fibonacci_retracement(req: TwoPointModel) -> Dict[str, Any]:
    levels = FibonacciCalculator.retracement_levels(req.high_price, req.low_price)
    return {"levels": levels}


@router.post("/fibonacci/extension")
def fibonacci_extension(req: TwoPointModel) -> Dict[str, Any]:
    levels = FibonacciCalculator.extension_levels(req.high_price, req.low_price)
    return {"levels": levels}


class FibFanRequest(BaseModel):
    p1: PointModel
    p2: PointModel
    levels: Optional[List[float]] = None


@router.post("/fibonacci/fan")
def fibonacci_fan(req: FibFanRequest) -> Dict[str, Any]:
    p1 = _point_model_to_point(req.p1)
    p2 = _point_model_to_point(req.p2)
    lvls = req.levels or [0.236, 0.382, 0.5, 0.618, 0.786]
    lines = FibonacciCalculator.fan_lines(p1, p2, lvls)
    return {"fan_lines": [{"level": l["level"], "end": {"x": l["end"].x, "y": l["end"].y}} for l in lines]}


class FibArcsRequest(BaseModel):
    center: PointModel
    radius_price: float
    levels: Optional[List[float]] = None


@router.post("/fibonacci/arcs")
def fibonacci_arcs(req: FibArcsRequest) -> Dict[str, Any]:
    center = _point_model_to_point(req.center)
    lvls = req.levels or [0.236, 0.382, 0.5, 0.618, 0.786]
    arcs = FibonacciCalculator.arcs(center, req.radius_price, lvls)
    return {"arcs": arcs}


class FibTimeZonesRequest(BaseModel):
    start_bar: int
    length: int


@router.post("/fibonacci/time-zones")
def fibonacci_time_zones(req: FibTimeZonesRequest) -> Dict[str, Any]:
    zones = FibonacciCalculator.time_zones(req.start_bar, req.length)
    return {"zones": zones}


# ═══════════════════════════════════════════════════════════════════════════════
#  Pitchfork Calculators (stateless)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/pitchfork/andrews")
def pitchfork_andrews(req: ThreePointModel) -> Dict[str, Any]:
    p1 = _point_model_to_point(req.p1)
    p2 = _point_model_to_point(req.p2)
    p3 = _point_model_to_point(req.p3)
    result = PitchforkCalculator.andrews(p1, p2, p3)
    return {"lines": _serialize_line_dicts(result)}


@router.post("/pitchfork/schiff")
def pitchfork_schiff(req: ThreePointModel) -> Dict[str, Any]:
    p1 = _point_model_to_point(req.p1)
    p2 = _point_model_to_point(req.p2)
    p3 = _point_model_to_point(req.p3)
    result = PitchforkCalculator.schiff(p1, p2, p3)
    return {"lines": _serialize_line_dicts(result)}


@router.post("/pitchfork/modified-schiff")
def pitchfork_modified_schiff(req: ThreePointModel) -> Dict[str, Any]:
    p1 = _point_model_to_point(req.p1)
    p2 = _point_model_to_point(req.p2)
    p3 = _point_model_to_point(req.p3)
    result = PitchforkCalculator.modified_schiff(p1, p2, p3)
    return {"lines": _serialize_line_dicts(result)}


def _serialize_line_dicts(lines: list) -> list:
    """Serialize pitchfork line dicts (contain Point objects) to JSON-safe."""
    out = []
    for line in lines:
        entry: Dict[str, Any] = {"label": line.get("label", "")}
        if "start" in line:
            entry["start"] = {"x": line["start"].x, "y": line["start"].y}
        if "end" in line:
            entry["end"] = {"x": line["end"].x, "y": line["end"].y}
        out.append(entry)
    return out


# ═══════════════════════════════════════════════════════════════════════════════
#  Gann Calculators (stateless)
# ═══════════════════════════════════════════════════════════════════════════════

class GannFanRequest(BaseModel):
    origin: PointModel
    price_range: float
    time_range: float


@router.post("/gann/fan")
def gann_fan(req: GannFanRequest) -> Dict[str, Any]:
    origin = _point_model_to_point(req.origin)
    lines = GannCalculator.fan(origin, req.price_range, req.time_range)
    return {"lines": [
        {"angle": l["angle"], "label": l["label"],
         "end": {"x": l["end"].x, "y": l["end"].y}}
        for l in lines
    ]}


class GannBoxRequest(BaseModel):
    p1: PointModel
    p2: PointModel
    subdivisions: int = 4


@router.post("/gann/box")
def gann_box(req: GannBoxRequest) -> Dict[str, Any]:
    p1 = _point_model_to_point(req.p1)
    p2 = _point_model_to_point(req.p2)
    result = GannCalculator.box(p1, p2, req.subdivisions)
    return result  # Already JSON-serializable (nested lists/dicts)


class GannSonRequest(BaseModel):
    center_price: float
    num_rings: int = 5


@router.post("/gann/square-of-nine")
def gann_square_of_nine(req: GannSonRequest) -> Dict[str, Any]:
    levels = GannCalculator.square_of_nine(req.center_price, req.num_rings)
    return {"levels": levels}


# ═══════════════════════════════════════════════════════════════════════════════
#  Capabilities
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/capabilities")
def capabilities() -> Dict[str, Any]:
    return {
        "drawing_types": [dt.value for dt in DrawingType],
        "line_styles": [ls.value for ls in LineStyle],
        "anchor_types": [at.value for at in AnchorType],
        "snap_modes": [sm.value for sm in SnapMode],
        "features": [
            "CRUD drawings per chart",
            "Undo/redo (100-depth stack)",
            "Drawing groups with visibility toggle",
            "JSON export/import",
            "Pine Script export",
            "Fibonacci retracement, extension, fan, arcs, time zones",
            "Pitchfork (Andrews, Schiff, Modified Schiff)",
            "Gann fan, box, square of nine",
            "Snap engine (bar, OHLC, round, magnetic)",
            "Geometry utilities (distance, intersection, angle, midpoint, bounding box)",
            "Drawing analytics (price clusters, trend summary, type stats, S/R)",
            "Auto-enrichment (computed properties for each drawing type)",
        ],
        "endpoint_count": 38,
    }
