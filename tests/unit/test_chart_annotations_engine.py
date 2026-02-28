"""
test_chart_annotations_engine.py — Comprehensive tests for ChartAnnotationsEngine
==================================================================================
Tests: CRUD, undo/redo, Fibonacci, Pitchfork, Gann, Geometry, Analytics, Export/Import
"""

import json
import math
import pytest
import numpy as np
import pandas as pd

from phase1.services.chart_annotations_engine import (
    ChartAnnotationsEngine, Annotation, Point, DrawingStyle, DrawingType,
    FibonacciConfig, RiskRewardConfig, AnnotationGroup,
    GeometryUtils, FibonacciCalculator, PitchforkCalculator, GannCalculator,
    SnapEngine, DrawingAnalytics, LineStyle, AnchorType, SnapMode,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def engine():
    return ChartAnnotationsEngine()


@pytest.fixture
def sample_bars():
    """Create sample bar DataFrame for snap tests."""
    n = 100
    times = [1700000000 + i * 60 for i in range(n)]
    rng = np.random.RandomState(42)
    prices = 100 + np.cumsum(rng.randn(n) * 0.5)
    return pd.DataFrame({
        'time': times,
        'open': prices,
        'high': prices + rng.rand(n) * 2,
        'low': prices - rng.rand(n) * 2,
        'close': prices + rng.randn(n) * 0.3,
        'volume': rng.randint(100, 10000, n),
    })


def make_annotation(
    drawing_type: DrawingType = DrawingType.TREND_LINE,
    symbol: str = 'AAPL',
    points: list = None,
    **kwargs,
) -> Annotation:
    pts = points or [
        Point(time=1700000000, price=150.0),
        Point(time=1700003600, price=155.0),
    ]
    return Annotation(
        drawing_type=drawing_type,
        symbol=symbol,
        points=pts,
        **kwargs,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Test GeometryUtils
# ═══════════════════════════════════════════════════════════════════════════════

class TestGeometryUtils:
    def test_line_equation(self):
        a, b, c = GeometryUtils.line_equation((0, 0), (1, 1))
        # ax + by + c = 0 for y=x → a=1, b=-1, c=0
        assert abs(a - 1) < 1e-10
        assert abs(b - (-1)) < 1e-10
        assert abs(c) < 1e-10

    def test_line_intersection(self):
        # x=0.5 and y=0.5 lines
        pt = GeometryUtils.line_intersection((0, 0), (1, 1), (0, 1), (1, 0))
        assert pt is not None
        assert abs(pt[0] - 0.5) < 1e-6
        assert abs(pt[1] - 0.5) < 1e-6

    def test_line_intersection_parallel(self):
        pt = GeometryUtils.line_intersection((0, 0), (1, 1), (0, 1), (1, 2))
        assert pt is None

    def test_point_to_line_distance(self):
        d = GeometryUtils.point_to_line_distance((0, 1), (0, 0), (1, 0))
        assert abs(d - 1.0) < 1e-10

    def test_project_point_onto_line(self):
        proj = GeometryUtils.project_point_onto_line((1, 1), (0, 0), (2, 0))
        assert abs(proj[0] - 1) < 1e-10
        assert abs(proj[1]) < 1e-10

    def test_midpoint(self):
        mid = GeometryUtils.midpoint((0, 0), (4, 6))
        assert mid == (2, 3)

    def test_distance(self):
        d = GeometryUtils.distance((0, 0), (3, 4))
        assert abs(d - 5.0) < 1e-10

    def test_angle_degrees(self):
        angle = GeometryUtils.angle_degrees((0, 0), (1, 1))
        assert abs(angle - 45) < 1e-6

    def test_slope(self):
        s = GeometryUtils.slope((0, 0), (2, 4))
        assert s == 2.0

    def test_slope_vertical(self):
        s = GeometryUtils.slope((1, 0), (1, 5))
        assert s is None

    def test_line_at_x(self):
        y = GeometryUtils.line_at_x((0, 0), (2, 4), 1)
        assert abs(y - 2.0) < 1e-10

    def test_parallel_line(self):
        p1, p2 = GeometryUtils.parallel_line((0, 0), (10, 0), 1.0)
        assert abs(p1[1] - 1.0) < 1e-10
        assert abs(p2[1] - 1.0) < 1e-10

    def test_point_in_rectangle(self):
        assert GeometryUtils.point_in_rectangle((1, 1), (0, 0), (2, 2)) is True
        assert GeometryUtils.point_in_rectangle((3, 3), (0, 0), (2, 2)) is False

    def test_point_in_ellipse(self):
        assert GeometryUtils.point_in_ellipse((0, 0), (0, 0), 1, 1) is True
        assert GeometryUtils.point_in_ellipse((2, 0), (0, 0), 1, 1) is False

    def test_polygon_area(self):
        # Unit square
        area = GeometryUtils.points_to_polygon_area([(0, 0), (1, 0), (1, 1), (0, 1)])
        assert abs(area - 1.0) < 1e-10

    def test_bounding_box(self):
        bb = GeometryUtils.bounding_box([(1, 2), (3, 4), (0, 5)])
        assert bb == ((0, 2), (3, 5))

    def test_circle_points(self):
        pts = GeometryUtils.circle_points((0, 0), 1.0, 4)
        assert len(pts) == 4
        # First point should be at angle=0 → (1, 0)
        assert abs(pts[0][0] - 1.0) < 1e-10
        assert abs(pts[0][1]) < 1e-10

    def test_arc_points(self):
        pts = GeometryUtils.arc_points((0, 0), 1.0, 0, 90, 4)
        assert len(pts) == 5  # inclusive of both endpoints


# ═══════════════════════════════════════════════════════════════════════════════
#  Test FibonacciCalculator
# ═══════════════════════════════════════════════════════════════════════════════

class TestFibonacciCalculator:
    def test_retracement_levels(self):
        levels = FibonacciCalculator.retracement_levels(100, 50)
        assert len(levels) == 7
        # Level 0 = 100 (top), level 1.0 = 50 (bottom) for 'down'
        assert levels[0]['level'] == 0
        assert abs(levels[0]['price'] - 100) < 1e-4
        assert levels[-1]['level'] == 1.0
        assert abs(levels[-1]['price'] - 50) < 1e-4
        # 50% level
        mid = [l for l in levels if l['level'] == 0.5][0]
        assert abs(mid['price'] - 75) < 1e-4

    def test_retracement_up(self):
        levels = FibonacciCalculator.retracement_levels(100, 50, direction='up')
        assert abs(levels[0]['price'] - 50) < 1e-4
        assert abs(levels[-1]['price'] - 100) < 1e-4

    def test_extension_levels(self):
        ext = FibonacciCalculator.extension_levels(100, 150, 120)
        # From C=120, direction = up (C > A), diff=50
        assert len(ext) > 0
        # 100% extension from C: 120 + 50 = 170
        lvl_100 = [l for l in ext if l['level'] == 1.0][0]
        assert abs(lvl_100['price'] - 170) < 1e-4

    def test_fan_lines(self):
        fans = FibonacciCalculator.fan_lines(0, 100, 100, 200)
        assert len(fans) == 5
        for f in fans:
            assert 'level' in f
            assert 'start' in f
            assert 'end' in f

    def test_arcs(self):
        arcs = FibonacciCalculator.arcs(0, 100, 10, 110)
        assert len(arcs) == 6
        for a in arcs:
            assert a['radius'] > 0

    def test_time_zones(self):
        zones = FibonacciCalculator.time_zones(1700000000, 86400, 10)
        assert len(zones) == 10
        assert zones[0]['fib_number'] == 1

    def test_channel_levels(self):
        result = FibonacciCalculator.channel_levels(
            (0, 0), (100, 100), (0, 50),
        )
        assert 'base_line' in result
        assert 'lines' in result
        assert 'channel_width' in result
        assert len(result['lines']) == 7

    def test_circles(self):
        circles = FibonacciCalculator.circles(0, 100, 10, 110)
        assert len(circles) == 8
        for c in circles:
            assert c['radius'] > 0


# ═══════════════════════════════════════════════════════════════════════════════
#  Test PitchforkCalculator
# ═══════════════════════════════════════════════════════════════════════════════

class TestPitchforkCalculator:
    def test_andrews(self):
        result = PitchforkCalculator.andrews((0, 100), (50, 80), (50, 120))
        assert result['type'] == 'andrews'
        assert 'median' in result
        assert 'upper_line' in result
        assert 'lower_line' in result

    def test_schiff(self):
        result = PitchforkCalculator.schiff((0, 100), (50, 80), (50, 120))
        assert result['type'] == 'schiff'
        # Handle should be shifted
        assert result['handle']['x'] != 0  # shifted from original

    def test_modified_schiff(self):
        result = PitchforkCalculator.modified_schiff((0, 100), (50, 80), (50, 120))
        assert result['type'] == 'modified_schiff'

    def test_inside(self):
        result = PitchforkCalculator.inside((0, 100), (50, 80), (50, 120))
        assert result['type'] == 'inside'


# ═══════════════════════════════════════════════════════════════════════════════
#  Test GannCalculator
# ═══════════════════════════════════════════════════════════════════════════════

class TestGannCalculator:
    def test_fan(self):
        result = GannCalculator.fan(0, 100, 100, 200)
        assert 'lines' in result
        assert '1x1' in result['lines']
        assert result['direction'] == 'up'

    def test_box(self):
        result = GannCalculator.box(0, 100, 100, 200, subdivisions=4)
        assert len(result['h_lines']) == 5
        assert len(result['v_lines']) == 5
        assert len(result['diagonals']) == 2

    def test_square_of_nine(self):
        result = GannCalculator.square_of_nine(100, levels=5)
        assert len(result) == 11  # -5 to +5
        # Level 0 should be close to 100
        center = [r for r in result if r['level'] == 0][0]
        assert abs(center['price'] - 100) < 1


# ═══════════════════════════════════════════════════════════════════════════════
#  Test SnapEngine
# ═══════════════════════════════════════════════════════════════════════════════

class TestSnapEngine:
    def test_snap_to_bar(self, sample_bars):
        snapped = SnapEngine.snap_to_bar(1700000030, sample_bars)
        assert snapped is not None
        # Should snap to either time 0 or time 60
        assert snapped in [1700000000, 1700000060]

    def test_snap_to_bar_empty(self):
        result = SnapEngine.snap_to_bar(123, pd.DataFrame())
        assert result is None

    def test_snap_to_ohlc(self, sample_bars):
        t, p = SnapEngine.snap_to_ohlc(1700000000, 100, sample_bars)
        assert t == 1700000000
        # Price should be one of OHLC values

    def test_snap_to_round(self):
        assert SnapEngine.snap_to_round(150.37, 0.25) == 150.25
        assert SnapEngine.snap_to_round(150.37, 1.0) == 150.0
        assert SnapEngine.snap_to_round(150.6, 0.5) == 150.5

    def test_magnetic_snap(self, sample_bars):
        ann = make_annotation(points=[Point(time=1700000000, price=100.5)])
        t, p = SnapEngine.magnetic_snap(
            1700000001, 100.6, sample_bars, [ann],
            snap_distance_price=0.5, snap_distance_time=10,
        )
        # Should snap to the existing annotation point
        assert t == 1700000000
        assert p == 100.5


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Point & DrawingStyle
# ═══════════════════════════════════════════════════════════════════════════════

class TestDataClasses:
    def test_point_roundtrip(self):
        p = Point(time=1700000000, price=150.5, bar_index=42)
        d = p.to_dict()
        p2 = Point.from_dict(d)
        assert p2.time == p.time
        assert p2.price == p.price
        assert p2.bar_index == p.bar_index

    def test_drawing_style_roundtrip(self):
        s = DrawingStyle(color='#ff0000', line_width=2, line_style=LineStyle.DASHED)
        d = s.to_dict()
        s2 = DrawingStyle.from_dict(d)
        assert s2.color == '#ff0000'
        assert s2.line_width == 2
        assert s2.line_style == LineStyle.DASHED

    def test_risk_reward_config(self):
        rr = RiskRewardConfig(
            entry_price=100, stop_loss=95, take_profit=115,
            quantity=100, account_size=100000, risk_percent=1,
        )
        assert rr.risk_amount == 500
        assert rr.reward_amount == 1500
        assert abs(rr.risk_reward_ratio - 3.0) < 1e-6
        assert rr.position_size_by_risk == 200  # $1000 max risk / $5 per share

    def test_annotation_roundtrip(self):
        ann = make_annotation(text='Test line')
        d = ann.to_dict()
        ann2 = Annotation.from_dict(d)
        assert ann2.drawing_type == DrawingType.TREND_LINE
        assert ann2.symbol == 'AAPL'
        assert ann2.text == 'Test line'
        assert len(ann2.points) == 2


# ═══════════════════════════════════════════════════════════════════════════════
#  Test ChartAnnotationsEngine CRUD
# ═══════════════════════════════════════════════════════════════════════════════

class TestEngineCRUD:
    def test_create(self, engine):
        ann = make_annotation()
        result = engine.create(ann)
        assert result.id == ann.id
        assert engine.count == 1

    def test_get(self, engine):
        ann = make_annotation()
        engine.create(ann)
        got = engine.get(ann.id)
        assert got is not None
        assert got.id == ann.id

    def test_get_nonexistent(self, engine):
        assert engine.get('nonexistent') is None

    def test_get_all(self, engine):
        engine.create(make_annotation(symbol='AAPL'))
        engine.create(make_annotation(symbol='GOOG'))
        engine.create(make_annotation(symbol='AAPL'))
        assert len(engine.get_all()) == 3
        assert len(engine.get_all(symbol='AAPL')) == 2
        assert len(engine.get_all(symbol='GOOG')) == 1

    def test_get_all_filters(self, engine):
        engine.create(make_annotation(drawing_type=DrawingType.TREND_LINE))
        engine.create(make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE,
                                       points=[Point(time=1700000000, price=150)]))
        engine.create(make_annotation(drawing_type=DrawingType.TREND_LINE))
        assert len(engine.get_all(drawing_type=DrawingType.TREND_LINE)) == 2
        assert len(engine.get_all(drawing_type=DrawingType.HORIZONTAL_LINE)) == 1

    def test_update(self, engine):
        ann = make_annotation()
        engine.create(ann)
        engine.update(ann.id, {'text': 'Updated'})
        updated = engine.get(ann.id)
        assert updated.text == 'Updated'

    def test_update_points(self, engine):
        ann = make_annotation()
        engine.create(ann)
        new_points = [{'time': 1700000000, 'price': 160}]
        engine.update(ann.id, {'points': new_points})
        updated = engine.get(ann.id)
        assert len(updated.points) == 1
        assert updated.points[0].price == 160

    def test_delete(self, engine):
        ann = make_annotation()
        engine.create(ann)
        assert engine.delete(ann.id) is True
        assert engine.count == 0

    def test_delete_nonexistent(self, engine):
        assert engine.delete('xxx') is False

    def test_delete_all(self, engine):
        engine.create(make_annotation(symbol='AAPL'))
        engine.create(make_annotation(symbol='GOOG'))
        engine.create(make_annotation(symbol='AAPL'))
        count = engine.delete_all(symbol='AAPL')
        assert count == 2
        assert engine.count == 1

    def test_duplicate(self, engine):
        ann = make_annotation(text='Original')
        engine.create(ann)
        dup = engine.duplicate(ann.id)
        assert dup is not None
        assert dup.id != ann.id
        assert dup.symbol == ann.symbol
        assert engine.count == 2

    def test_create_from_dict(self, engine):
        data = {
            'drawing_type': 'horizontal_line',
            'symbol': 'TSLA',
            'points': [{'time': 1700000000, 'price': 200}],
        }
        ann = engine.create_from_dict(data)
        assert ann.drawing_type == DrawingType.HORIZONTAL_LINE
        assert ann.symbol == 'TSLA'


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Undo / Redo
# ═══════════════════════════════════════════════════════════════════════════════

class TestUndoRedo:
    def test_undo_create(self, engine):
        ann = make_annotation()
        engine.create(ann)
        assert engine.count == 1
        engine.undo()
        assert engine.count == 0

    def test_redo_create(self, engine):
        ann = make_annotation()
        engine.create(ann)
        engine.undo()
        assert engine.count == 0
        engine.redo()
        assert engine.count == 1

    def test_undo_delete(self, engine):
        ann = make_annotation()
        engine.create(ann)
        engine.delete(ann.id)
        assert engine.count == 0
        engine.undo()
        assert engine.count == 1

    def test_undo_update(self, engine):
        ann = make_annotation(text='Original')
        engine.create(ann)
        engine.update(ann.id, {'text': 'Changed'})
        assert engine.get(ann.id).text == 'Changed'
        engine.undo()
        assert engine.get(ann.id).text == 'Original'

    def test_undo_empty(self, engine):
        assert engine.undo() is None

    def test_redo_empty(self, engine):
        assert engine.redo() is None

    def test_undo_count(self, engine):
        engine.create(make_annotation())
        engine.create(make_annotation())
        assert engine.undo_count == 2


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Enrichment (Computed Properties)
# ═══════════════════════════════════════════════════════════════════════════════

class TestEnrichment:
    def test_trend_line_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.TREND_LINE,
            points=[Point(time=0, price=100), Point(time=100, price=150)],
        )
        engine.create(ann)
        c = ann.computed
        assert c['direction'] == 'up'
        assert c['length_price'] == 50
        assert abs(c['slope'] - 0.5) < 1e-6

    def test_horizontal_line_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.HORIZONTAL_LINE,
            points=[Point(time=0, price=150)],
        )
        engine.create(ann)
        assert ann.computed['price'] == 150

    def test_fib_retracement_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.FIB_RETRACEMENT,
            points=[Point(time=0, price=200), Point(time=100, price=100)],
        )
        engine.create(ann)
        levels = ann.computed['levels']
        assert len(levels) == 7
        # 0% = 200, 100% = 100
        assert abs(levels[0]['price'] - 200) < 1e-4

    def test_fib_extension_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.FIB_EXTENSION,
            points=[
                Point(time=0, price=100),
                Point(time=50, price=150),
                Point(time=100, price=120),
            ],
        )
        engine.create(ann)
        levels = ann.computed['levels']
        assert len(levels) > 0

    def test_pitchfork_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.ANDREWS_PITCHFORK,
            points=[
                Point(time=0, price=100),
                Point(time=50, price=80),
                Point(time=50, price=120),
            ],
        )
        engine.create(ann)
        assert ann.computed['type'] == 'andrews'
        assert 'median' in ann.computed

    def test_gann_fan_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.GANN_FAN,
            points=[Point(time=0, price=100), Point(time=100, price=200)],
        )
        engine.create(ann)
        assert 'lines' in ann.computed
        assert '1x1' in ann.computed['lines']

    def test_gann_box_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.GANN_BOX,
            points=[Point(time=0, price=100), Point(time=100, price=200)],
        )
        engine.create(ann)
        assert 'h_lines' in ann.computed
        assert 'diagonals' in ann.computed

    def test_rectangle_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.RECTANGLE,
            points=[Point(time=0, price=100), Point(time=100, price=200)],
        )
        engine.create(ann)
        assert ann.computed['width'] == 100
        assert ann.computed['height'] == 100

    def test_price_range_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.PRICE_RANGE,
            points=[Point(time=0, price=100), Point(time=100, price=110)],
        )
        engine.create(ann)
        assert abs(ann.computed['price_diff'] - 10) < 1e-4
        assert abs(ann.computed['percent_change'] - 10) < 1e-2

    def test_risk_reward_computed(self, engine):
        ann = make_annotation(
            drawing_type=DrawingType.RISK_REWARD,
            points=[Point(time=0, price=100)],
        )
        ann.risk_reward = RiskRewardConfig(
            entry_price=100, stop_loss=95, take_profit=115, quantity=200,
        )
        engine.create(ann)
        assert ann.computed['risk_amount'] == 1000
        assert ann.computed['reward_amount'] == 3000
        assert abs(ann.computed['risk_reward_ratio'] - 3.0) < 1e-6


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Groups
# ═══════════════════════════════════════════════════════════════════════════════

class TestGroups:
    def test_create_group(self, engine):
        a1 = engine.create(make_annotation())
        a2 = engine.create(make_annotation())
        grp = engine.create_group('Trend Lines', [a1.id, a2.id])
        assert grp.name == 'Trend Lines'
        assert len(grp.annotations) == 2

    def test_add_to_group(self, engine):
        a1 = engine.create(make_annotation())
        grp = engine.create_group('Group')
        assert engine.add_to_group(grp.id, a1.id) is True
        assert a1.group_id == grp.id

    def test_remove_from_group(self, engine):
        a1 = engine.create(make_annotation())
        grp = engine.create_group('Group', [a1.id])
        engine.remove_from_group(grp.id, a1.id)
        assert a1.group_id is None

    def test_toggle_group_visibility(self, engine):
        a1 = engine.create(make_annotation())
        a2 = engine.create(make_annotation())
        grp = engine.create_group('Group', [a1.id, a2.id])
        engine.toggle_group_visibility(grp.id)
        assert a1.visible is False
        assert a2.visible is False
        engine.toggle_group_visibility(grp.id)
        assert a1.visible is True


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Export / Import
# ═══════════════════════════════════════════════════════════════════════════════

class TestExportImport:
    def test_export_json(self, engine):
        engine.create(make_annotation(symbol='AAPL'))
        engine.create(make_annotation(symbol='GOOG'))
        j = engine.export_json()
        data = json.loads(j)
        assert len(data) == 2

    def test_export_json_filtered(self, engine):
        engine.create(make_annotation(symbol='AAPL'))
        engine.create(make_annotation(symbol='GOOG'))
        j = engine.export_json(symbol='AAPL')
        data = json.loads(j)
        assert len(data) == 1

    def test_import_json(self, engine):
        original = ChartAnnotationsEngine()
        original.create(make_annotation())
        original.create(make_annotation())
        j = original.export_json()
        count = engine.import_json(j)
        assert count == 2
        assert engine.count == 2

    def test_export_pine_script(self, engine):
        engine.create(make_annotation(
            drawing_type=DrawingType.HORIZONTAL_LINE,
            points=[Point(time=0, price=150)],
        ))
        pine = engine.export_pine_script()
        assert '//@version=5' in pine
        assert 'hline' in pine


# ═══════════════════════════════════════════════════════════════════════════════
#  Test DrawingAnalytics
# ═══════════════════════════════════════════════════════════════════════════════

class TestDrawingAnalytics:
    def test_find_price_clusters(self):
        anns = [
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100.2)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100.4)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=200)]),
        ]
        clusters = DrawingAnalytics.find_price_clusters(anns, tolerance=0.5)
        assert len(clusters) == 1  # only the 100-area cluster
        assert clusters[0]['count'] == 3

    def test_trend_line_summary(self):
        anns = [
            make_annotation(points=[Point(time=0, price=100), Point(time=1, price=110)]),  # bullish
            make_annotation(points=[Point(time=0, price=110), Point(time=1, price=90)]),   # bearish
            make_annotation(points=[Point(time=0, price=100), Point(time=1, price=100)]),  # horizontal
        ]
        summary = DrawingAnalytics.trend_line_summary(anns)
        assert summary['bullish'] == 1
        assert summary['bearish'] == 1
        assert summary['horizontal'] == 1
        assert summary['total'] == 3

    def test_most_used_types(self):
        anns = [
            make_annotation(drawing_type=DrawingType.TREND_LINE),
            make_annotation(drawing_type=DrawingType.TREND_LINE),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100)]),
        ]
        stats = DrawingAnalytics.most_used_drawing_types(anns)
        assert stats[0]['type'] == 'trend_line'
        assert stats[0]['count'] == 2

    def test_support_resistance_from_drawings(self):
        anns = [
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=90)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=95)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=105)]),
            make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=110)]),
        ]
        sr = DrawingAnalytics.support_resistance_from_drawings(anns, 100)
        assert 95 in sr['support']
        assert 105 in sr['resistance']


# ═══════════════════════════════════════════════════════════════════════════════
#  Test Engine Analytics Integration
# ═══════════════════════════════════════════════════════════════════════════════

class TestEngineAnalytics:
    def test_price_clusters(self, engine):
        engine.create(make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100)]))
        engine.create(make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=100.3)]))
        clusters = engine.price_clusters(tolerance=0.5)
        assert len(clusters) == 1

    def test_trend_summary(self, engine):
        engine.create(make_annotation(points=[Point(time=0, price=100), Point(time=1, price=150)]))
        summary = engine.trend_summary()
        assert summary['bullish'] == 1

    def test_support_resistance(self, engine):
        engine.create(make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=90)]))
        engine.create(make_annotation(drawing_type=DrawingType.HORIZONTAL_LINE, points=[Point(price=110)]))
        sr = engine.support_resistance(100)
        assert len(sr['support']) == 1
        assert len(sr['resistance']) == 1
