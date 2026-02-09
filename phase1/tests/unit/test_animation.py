"""
Tests for Viewport & Animation Module.

Tests easing functions, viewport state, animations, and gestures.
"""

import pytest
import math

from services.charting.animation import (
    EasingType,
    AnimationConfig,
    ViewportState,
    AnimationFrame,
    Animation,
    AnimationQueue,
    GestureState,
    ViewportAnimator,
    FrameScheduler,
    AnimationRecorder,
    ease_linear,
    ease_in,
    ease_out,
    ease_in_out,
    ease_out_cubic,
    ease_in_out_cubic,
    get_easing_function,
)


# ============================================================================
# Easing Function Tests
# ============================================================================

class TestEasingFunctions:
    """Tests for easing functions."""
    
    def test_ease_linear(self):
        """Test linear easing."""
        assert ease_linear(0.0) == 0.0
        assert ease_linear(0.5) == 0.5
        assert ease_linear(1.0) == 1.0
    
    def test_ease_in(self):
        """Test ease in."""
        assert ease_in(0.0) == 0.0
        assert ease_in(1.0) == 1.0
        # Ease in should be slower at start
        assert ease_in(0.5) < 0.5
    
    def test_ease_out(self):
        """Test ease out."""
        assert ease_out(0.0) == 0.0
        assert ease_out(1.0) == 1.0
        # Ease out should be faster at start
        assert ease_out(0.5) > 0.5
    
    def test_ease_in_out(self):
        """Test ease in-out."""
        assert ease_in_out(0.0) == 0.0
        assert ease_in_out(1.0) == 1.0
        assert ease_in_out(0.5) == 0.5
    
    def test_ease_out_cubic(self):
        """Test ease out cubic."""
        assert ease_out_cubic(0.0) == 0.0
        assert ease_out_cubic(1.0) == 1.0
        assert ease_out_cubic(0.5) > 0.5
    
    def test_ease_in_out_cubic(self):
        """Test ease in-out cubic."""
        assert ease_in_out_cubic(0.0) == 0.0
        assert ease_in_out_cubic(1.0) == 1.0
        assert ease_in_out_cubic(0.5) == 0.5
    
    def test_get_easing_function(self):
        """Test getting easing function by type."""
        fn = get_easing_function(EasingType.LINEAR)
        assert fn == ease_linear
        
        fn = get_easing_function(EasingType.EASE_OUT_CUBIC)
        assert fn == ease_out_cubic


# ============================================================================
# AnimationConfig Tests
# ============================================================================

class TestAnimationConfig:
    """Tests for AnimationConfig class."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = AnimationConfig()
        
        assert config.duration_ms == 300.0
        assert config.easing == EasingType.EASE_OUT_CUBIC
        assert config.fps == 60
    
    def test_custom_config(self):
        """Test custom configuration."""
        config = AnimationConfig(
            duration_ms=500.0,
            easing=EasingType.LINEAR,
            fps=30,
        )
        
        assert config.duration_ms == 500.0
        assert config.easing == EasingType.LINEAR
        assert config.fps == 30
    
    def test_frame_duration(self):
        """Test frame duration calculation."""
        config = AnimationConfig(fps=60)
        assert config.frame_duration_ms == pytest.approx(1000 / 60)
        
        config = AnimationConfig(fps=30)
        assert config.frame_duration_ms == pytest.approx(1000 / 30)
    
    def test_total_frames(self):
        """Test total frames calculation."""
        config = AnimationConfig(duration_ms=1000, fps=60)
        # int(1000 / 16.666...) = 59
        assert config.total_frames >= 59
        
        config = AnimationConfig(duration_ms=500, fps=60)
        assert config.total_frames >= 29


# ============================================================================
# ViewportState Tests
# ============================================================================

class TestViewportState:
    """Tests for ViewportState class."""
    
    def test_default_state(self):
        """Test default state values."""
        state = ViewportState()
        
        assert state.start_bar == 0.0
        assert state.end_bar == 100.0
        assert state.price_min == 0.0
        assert state.price_max == 100.0
    
    def test_copy(self):
        """Test state copying."""
        state = ViewportState(start_bar=10, end_bar=50)
        copy = state.copy()
        
        assert copy.start_bar == 10
        assert copy.end_bar == 50
        
        # Modify original
        state.start_bar = 20
        assert copy.start_bar == 10  # Copy unchanged
    
    def test_lerp(self):
        """Test linear interpolation."""
        start = ViewportState(start_bar=0, end_bar=100)
        end = ViewportState(start_bar=100, end_bar=200)
        
        # At t=0, should be start
        result = start.lerp(end, 0.0)
        assert result.start_bar == 0
        assert result.end_bar == 100
        
        # At t=1, should be end
        result = start.lerp(end, 1.0)
        assert result.start_bar == 100
        assert result.end_bar == 200
        
        # At t=0.5, should be midpoint
        result = start.lerp(end, 0.5)
        assert result.start_bar == 50
        assert result.end_bar == 150
    
    def test_distance(self):
        """Test distance calculation."""
        state1 = ViewportState(start_bar=0, end_bar=100)
        state2 = ViewportState(start_bar=0, end_bar=100)
        
        assert state1.distance(state2) == 0.0
        
        state3 = ViewportState(start_bar=10, end_bar=110)
        assert state1.distance(state3) > 0
    
    def test_nearly_equal(self):
        """Test near equality."""
        state1 = ViewportState(start_bar=0, end_bar=100)
        state2 = ViewportState(start_bar=0.0001, end_bar=100.0001)
        
        assert state1.nearly_equal(state2)
        
        state3 = ViewportState(start_bar=10, end_bar=110)
        assert not state1.nearly_equal(state3)


# ============================================================================
# Animation Tests
# ============================================================================

class TestAnimation:
    """Tests for Animation class."""
    
    def test_create_animation(self):
        """Test creating animation."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300)
        
        anim = Animation(start, end, config, start_time_ms=0)
        
        assert anim.is_active
        assert not anim.is_completed
    
    def test_progress_at_start(self):
        """Test progress at start."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300, easing=EasingType.LINEAR)
        
        anim = Animation(start, end, config, start_time_ms=0)
        
        progress = anim.get_progress(0)
        assert progress == 0.0
    
    def test_progress_at_end(self):
        """Test progress at end."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300, easing=EasingType.LINEAR)
        start_time = 1000
        
        anim = Animation(start, end, config, start_time_ms=start_time)
        
        # Progress at or past duration should be 1.0
        progress = anim.get_progress(start_time + 400)  # Past end time
        assert progress == 1.0
    
    def test_progress_midway(self):
        """Test progress midway."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300, easing=EasingType.LINEAR)
        start_time = 1000
        
        anim = Animation(start, end, config, start_time_ms=start_time)
        
        progress = anim.get_progress(start_time + 150)
        assert progress == pytest.approx(0.5)
    
    def test_get_state(self):
        """Test getting interpolated state."""
        start = ViewportState(start_bar=0)
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300, easing=EasingType.LINEAR)
        start_time = 1000
        
        anim = Animation(start, end, config, start_time_ms=start_time)
        
        state = anim.get_state(start_time + 150)
        assert state.start_bar == pytest.approx(50)
    
    def test_get_frame(self):
        """Test getting animation frame."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=300, fps=60)
        
        anim = Animation(start, end, config, start_time_ms=0)
        
        frame = anim.get_frame(0)
        assert frame.frame_number == 0
        assert frame.progress == pytest.approx(0.0, abs=0.1)
    
    def test_get_all_frames(self):
        """Test getting all frames."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=100, fps=60)
        
        anim = Animation(start, end, config, start_time_ms=0)
        
        frames = anim.get_all_frames()
        assert len(frames) > 0
        assert frames[-1].is_final
    
    def test_cancel_animation(self):
        """Test canceling animation."""
        start = ViewportState()
        end = ViewportState(start_bar=100)
        config = AnimationConfig()
        
        anim = Animation(start, end, config, start_time_ms=0)
        anim.cancel()
        
        assert not anim.is_active
    
    def test_skip_to_end(self):
        """Test skipping to end."""
        start = ViewportState(start_bar=0)
        end = ViewportState(start_bar=100)
        config = AnimationConfig()
        
        anim = Animation(start, end, config, start_time_ms=0)
        state = anim.skip_to_end()
        
        assert state.start_bar == 100
        assert anim.is_completed


# ============================================================================
# AnimationQueue Tests
# ============================================================================

class TestAnimationQueue:
    """Tests for AnimationQueue class."""
    
    def test_add_animation(self):
        """Test adding animation."""
        queue = AnimationQueue()
        
        anim = Animation(ViewportState(), ViewportState(start_bar=100), AnimationConfig())
        queue.add(anim)
        
        assert queue.is_animating
        assert queue.queue_length == 1
    
    def test_update_returns_state(self):
        """Test update returns state."""
        queue = AnimationQueue()
        
        config = AnimationConfig(duration_ms=100, easing=EasingType.LINEAR)
        start_time = 1000
        anim = Animation(
            ViewportState(start_bar=0),
            ViewportState(start_bar=100),
            config,
            start_time_ms=start_time,
        )
        queue.add(anim)
        
        state = queue.update(start_time + 50)
        assert state is not None
        assert state.start_bar > 0
    
    def test_clear_queue(self):
        """Test clearing queue."""
        queue = AnimationQueue()
        
        anim = Animation(ViewportState(), ViewportState(), AnimationConfig())
        queue.add(anim)
        
        queue.clear()
        
        assert not queue.is_animating
        assert queue.queue_length == 0
    
    def test_empty_queue(self):
        """Test empty queue update."""
        queue = AnimationQueue()
        
        state = queue.update(0)
        assert state is None


# ============================================================================
# ViewportAnimator Tests
# ============================================================================

class TestViewportAnimator:
    """Tests for ViewportAnimator class."""
    
    def test_create_animator(self):
        """Test creating animator."""
        animator = ViewportAnimator()
        assert animator is not None
        assert not animator.is_animating
    
    def test_initial_state(self):
        """Test initial state."""
        initial = ViewportState(start_bar=50)
        animator = ViewportAnimator(initial_state=initial)
        
        assert animator.state.start_bar == 50
    
    def test_animate_to(self):
        """Test animating to target."""
        animator = ViewportAnimator()
        target = ViewportState(start_bar=100)
        
        animator.animate_to(target)
        
        assert animator.is_animating
    
    def test_pan_by(self):
        """Test panning."""
        animator = ViewportAnimator(initial_state=ViewportState(start_bar=0))
        
        animator.pan_by(100, 0, animate=False)
        
        # Bars should have shifted
        assert animator.state.start_bar != 0
    
    def test_zoom_by(self):
        """Test zooming."""
        initial = ViewportState(start_bar=0, end_bar=100)
        animator = ViewportAnimator(initial_state=initial)
        
        animator.zoom_by(2.0, 640, 400, animate=False)
        
        # Range should be narrower
        bar_range = animator.state.end_bar - animator.state.start_bar
        assert bar_range < 100
    
    def test_zoom_to_fit(self):
        """Test zoom to fit range."""
        animator = ViewportAnimator()
        
        animator.zoom_to_fit(10, 50, 100.0, 200.0, animate=False)
        
        assert animator.state.start_bar == 10
        assert animator.state.end_bar == 50
        assert animator.state.price_min == 100.0
        assert animator.state.price_max == 200.0
    
    def test_change_listener(self):
        """Test change listener."""
        animator = ViewportAnimator()
        
        states = []
        animator.on_change(lambda s: states.append(s))
        
        animator.pan_by(10, 0, animate=False)
        
        assert len(states) == 1
    
    def test_start_pan_cancels_animation(self):
        """Test starting pan cancels animation."""
        animator = ViewportAnimator()
        animator.animate_to(ViewportState(start_bar=100))
        
        animator.start_pan(0, 0)
        
        # Animation should be cancelled
        assert not animator.is_animating
    
    def test_pan_gesture(self):
        """Test pan gesture flow."""
        animator = ViewportAnimator()
        initial_bar = animator.state.start_bar
        
        animator.start_pan(0, 0)
        animator.update_pan(100, 0)
        animator.end_pan(apply_momentum=False)
        
        # Should have moved
        assert animator.state.start_bar != initial_bar
    
    def test_stop_all_animations(self):
        """Test stopping all animations."""
        animator = ViewportAnimator()
        animator.animate_to(ViewportState(start_bar=100))
        
        animator.stop_all_animations()
        
        assert not animator.is_animating
    
    def test_get_deterministic_frames(self):
        """Test getting deterministic frames."""
        animator = ViewportAnimator()
        target = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=100, fps=60)
        
        frames = animator.get_deterministic_frames(target, config)
        
        assert len(frames) > 0
        assert frames[-1].is_final


# ============================================================================
# FrameScheduler Tests
# ============================================================================

class TestFrameScheduler:
    """Tests for FrameScheduler class."""
    
    def test_create_scheduler(self):
        """Test creating scheduler."""
        scheduler = FrameScheduler(fps=60)
        
        assert scheduler.fps == 60
        assert scheduler.current_frame == 0
    
    def test_frame_duration(self):
        """Test frame duration."""
        scheduler = FrameScheduler(fps=60)
        assert scheduler.frame_duration_ms == pytest.approx(1000 / 60)
    
    def test_start_scheduler(self):
        """Test starting scheduler."""
        scheduler = FrameScheduler()
        scheduler.start(start_time_ms=1000)
        
        assert scheduler.current_time_ms == 1000
    
    def test_advance_frame(self):
        """Test advancing frame."""
        scheduler = FrameScheduler(fps=60)
        scheduler.start()
        
        scheduler.advance()
        
        assert scheduler.current_frame == 1
    
    def test_advance_by_frames(self):
        """Test advancing by multiple frames."""
        scheduler = FrameScheduler()
        scheduler.start()
        
        scheduler.advance_by(10)
        
        assert scheduler.current_frame == 10
    
    def test_advance_to_time(self):
        """Test advancing to specific time."""
        scheduler = FrameScheduler(fps=60)
        scheduler.start()
        
        frames = scheduler.advance_to_time(1000)  # 1 second
        
        # int(1000 / 16.666...) = 59
        assert scheduler.current_frame >= 59
        assert frames >= 59
    
    def test_stop_and_reset(self):
        """Test stop and reset."""
        scheduler = FrameScheduler()
        scheduler.start()
        scheduler.advance_by(10)
        
        scheduler.reset()
        
        assert scheduler.current_frame == 0


# ============================================================================
# AnimationRecorder Tests
# ============================================================================

class TestAnimationRecorder:
    """Tests for AnimationRecorder class."""
    
    def test_create_recorder(self):
        """Test creating recorder."""
        animator = ViewportAnimator()
        recorder = AnimationRecorder(animator)
        
        assert recorder.frame_count == 0
    
    def test_record_animation(self):
        """Test recording animation."""
        animator = ViewportAnimator()
        recorder = AnimationRecorder(animator)
        
        target = ViewportState(start_bar=100)
        config = AnimationConfig(duration_ms=100, fps=60)
        
        frames = recorder.record_animation(target, config)
        
        assert len(frames) > 0
        # Last frame should be final or we should have recorded enough frames
        assert len(frames) >= config.total_frames or frames[-1].is_final
    
    def test_capture_frame(self):
        """Test capturing single frame."""
        animator = ViewportAnimator()
        recorder = AnimationRecorder(animator)
        
        recorder.start_recording()
        frame = recorder.capture_frame()
        recorder.stop_recording()
        
        assert frame.frame_number == 0
    
    def test_clear_frames(self):
        """Test clearing recorded frames."""
        animator = ViewportAnimator()
        recorder = AnimationRecorder(animator)
        
        recorder.start_recording()
        recorder.capture_frame()
        recorder.stop_recording()
        
        recorder.clear()
        
        assert recorder.frame_count == 0
    
    def test_deterministic_recording(self):
        """Test deterministic recording produces consistent results."""
        config = AnimationConfig(duration_ms=100, fps=60, easing=EasingType.LINEAR)
        
        # First recording
        animator1 = ViewportAnimator(initial_state=ViewportState(start_bar=0))
        recorder1 = AnimationRecorder(animator1)
        frames1 = recorder1.record_animation(ViewportState(start_bar=100), config)
        
        # Second recording
        animator2 = ViewportAnimator(initial_state=ViewportState(start_bar=0))
        recorder2 = AnimationRecorder(animator2)
        frames2 = recorder2.record_animation(ViewportState(start_bar=100), config)
        
        # Should have same number of frames
        assert len(frames1) == len(frames2)
        
        # States should be identical
        for f1, f2 in zip(frames1, frames2):
            assert f1.state.start_bar == pytest.approx(f2.state.start_bar)


# ============================================================================
# GestureState Tests
# ============================================================================

class TestGestureState:
    """Tests for GestureState class."""
    
    def test_default_state(self):
        """Test default gesture state."""
        state = GestureState()
        
        assert state.is_panning is False
        assert state.is_zooming is False
    
    def test_custom_state(self):
        """Test custom gesture state."""
        state = GestureState(
            is_panning=True,
            pan_start_x=100,
            pan_start_y=200,
        )
        
        assert state.is_panning
        assert state.pan_start_x == 100
        assert state.pan_start_y == 200
