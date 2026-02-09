"""
Viewport & Animation Module.

Implements smooth pan/zoom transitions and frame interpolation
for deterministic, fluid chart animations.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Callable, Tuple
from enum import Enum, auto
import math
import time


class EasingType(Enum):
    """Animation easing functions."""
    
    LINEAR = auto()
    EASE_IN = auto()
    EASE_OUT = auto()
    EASE_IN_OUT = auto()
    EASE_OUT_CUBIC = auto()
    EASE_IN_OUT_CUBIC = auto()
    SPRING = auto()


@dataclass
class AnimationConfig:
    """Animation configuration."""
    
    duration_ms: float = 300.0
    easing: EasingType = EasingType.EASE_OUT_CUBIC
    fps: int = 60
    
    # Spring parameters (for SPRING easing)
    spring_stiffness: float = 200.0
    spring_damping: float = 20.0
    spring_mass: float = 1.0
    
    @property
    def frame_duration_ms(self) -> float:
        """Duration of single frame in ms."""
        return 1000.0 / self.fps
    
    @property
    def total_frames(self) -> int:
        """Total frames for animation."""
        return max(1, int(self.duration_ms / self.frame_duration_ms))


def ease_linear(t: float) -> float:
    """Linear easing (no easing)."""
    return t


def ease_in(t: float) -> float:
    """Ease in (accelerate)."""
    return t * t


def ease_out(t: float) -> float:
    """Ease out (decelerate)."""
    return 1 - (1 - t) ** 2


def ease_in_out(t: float) -> float:
    """Ease in-out (accelerate then decelerate)."""
    if t < 0.5:
        return 2 * t * t
    return 1 - (-2 * t + 2) ** 2 / 2


def ease_out_cubic(t: float) -> float:
    """Ease out cubic (smooth deceleration)."""
    return 1 - (1 - t) ** 3


def ease_in_out_cubic(t: float) -> float:
    """Ease in-out cubic."""
    if t < 0.5:
        return 4 * t * t * t
    return 1 - (-2 * t + 2) ** 3 / 2


def get_easing_function(easing: EasingType) -> Callable[[float], float]:
    """Get easing function for type."""
    easing_functions = {
        EasingType.LINEAR: ease_linear,
        EasingType.EASE_IN: ease_in,
        EasingType.EASE_OUT: ease_out,
        EasingType.EASE_IN_OUT: ease_in_out,
        EasingType.EASE_OUT_CUBIC: ease_out_cubic,
        EasingType.EASE_IN_OUT_CUBIC: ease_in_out_cubic,
    }
    return easing_functions.get(easing, ease_linear)


@dataclass
class ViewportState:
    """
    Represents viewport state for animation.
    
    Contains all animatable properties.
    """
    
    # Time scale
    start_bar: float = 0.0
    end_bar: float = 100.0
    bar_spacing: float = 10.0
    
    # Price scale
    price_min: float = 0.0
    price_max: float = 100.0
    
    # Scroll offset
    scroll_x: float = 0.0
    scroll_y: float = 0.0
    
    def copy(self) -> "ViewportState":
        """Create a copy."""
        return ViewportState(
            start_bar=self.start_bar,
            end_bar=self.end_bar,
            bar_spacing=self.bar_spacing,
            price_min=self.price_min,
            price_max=self.price_max,
            scroll_x=self.scroll_x,
            scroll_y=self.scroll_y,
        )
    
    def lerp(self, target: "ViewportState", t: float) -> "ViewportState":
        """Linear interpolation to target state."""
        return ViewportState(
            start_bar=self.start_bar + (target.start_bar - self.start_bar) * t,
            end_bar=self.end_bar + (target.end_bar - self.end_bar) * t,
            bar_spacing=self.bar_spacing + (target.bar_spacing - self.bar_spacing) * t,
            price_min=self.price_min + (target.price_min - self.price_min) * t,
            price_max=self.price_max + (target.price_max - self.price_max) * t,
            scroll_x=self.scroll_x + (target.scroll_x - self.scroll_x) * t,
            scroll_y=self.scroll_y + (target.scroll_y - self.scroll_y) * t,
        )
    
    def distance(self, other: "ViewportState") -> float:
        """Calculate distance to another state."""
        return math.sqrt(
            (self.start_bar - other.start_bar) ** 2 +
            (self.end_bar - other.end_bar) ** 2 +
            (self.bar_spacing - other.bar_spacing) ** 2 +
            (self.price_min - other.price_min) ** 2 +
            (self.price_max - other.price_max) ** 2 +
            (self.scroll_x - other.scroll_x) ** 2 +
            (self.scroll_y - other.scroll_y) ** 2
        )
    
    def nearly_equal(self, other: "ViewportState", epsilon: float = 0.001) -> bool:
        """Check if states are nearly equal."""
        return self.distance(other) < epsilon


@dataclass
class AnimationFrame:
    """Single animation frame."""
    
    frame_number: int
    timestamp_ms: float
    state: ViewportState
    progress: float  # 0.0 to 1.0
    is_final: bool = False


class Animation:
    """
    Represents a single viewport animation.
    
    Manages interpolation between start and end states.
    """
    
    def __init__(
        self,
        start_state: ViewportState,
        end_state: ViewportState,
        config: AnimationConfig,
        start_time_ms: Optional[float] = None,
    ):
        self._start = start_state.copy()
        self._end = end_state.copy()
        self._config = config
        self._start_time = start_time_ms or (time.time() * 1000)
        self._easing = get_easing_function(config.easing)
        self._completed = False
        self._cancelled = False
    
    @property
    def is_active(self) -> bool:
        """Check if animation is still active."""
        return not self._completed and not self._cancelled
    
    @property
    def is_completed(self) -> bool:
        """Check if animation completed."""
        return self._completed
    
    @property
    def start_state(self) -> ViewportState:
        """Get start state."""
        return self._start
    
    @property
    def end_state(self) -> ViewportState:
        """Get end state."""
        return self._end
    
    def get_progress(self, current_time_ms: Optional[float] = None) -> float:
        """
        Get animation progress (0.0 to 1.0).
        
        Args:
            current_time_ms: Current time in ms, defaults to now
        """
        if current_time_ms is None:
            current_time_ms = time.time() * 1000
        
        elapsed = current_time_ms - self._start_time
        raw_progress = min(1.0, max(0.0, elapsed / self._config.duration_ms))
        
        return self._easing(raw_progress)
    
    def get_state(self, current_time_ms: Optional[float] = None) -> ViewportState:
        """
        Get interpolated state at current time.
        
        Args:
            current_time_ms: Current time in ms, defaults to now
        """
        progress = self.get_progress(current_time_ms)
        
        if progress >= 1.0:
            self._completed = True
            return self._end.copy()
        
        return self._start.lerp(self._end, progress)
    
    def get_frame(self, frame_number: int) -> AnimationFrame:
        """
        Get animation frame by number.
        
        Uses deterministic timing based on frame number.
        """
        timestamp_ms = self._start_time + (frame_number * self._config.frame_duration_ms)
        progress = self.get_progress(timestamp_ms)
        state = self.get_state(timestamp_ms)
        
        return AnimationFrame(
            frame_number=frame_number,
            timestamp_ms=timestamp_ms,
            state=state,
            progress=progress,
            is_final=(progress >= 1.0),
        )
    
    def get_all_frames(self) -> List[AnimationFrame]:
        """Get all animation frames (deterministic)."""
        frames = []
        for i in range(self._config.total_frames + 1):
            frames.append(self.get_frame(i))
            if frames[-1].is_final:
                break
        return frames
    
    def cancel(self) -> ViewportState:
        """Cancel animation and return current state."""
        self._cancelled = True
        return self.get_state()
    
    def skip_to_end(self) -> ViewportState:
        """Skip to final state."""
        self._completed = True
        return self._end.copy()


class AnimationQueue:
    """
    Queue of animations with sequential execution.
    
    Animations run one after another.
    """
    
    def __init__(self):
        self._queue: List[Animation] = []
        self._current: Optional[Animation] = None
    
    def add(self, animation: Animation) -> None:
        """Add animation to queue."""
        self._queue.append(animation)
        
        if self._current is None:
            self._current = self._queue.pop(0)
    
    def update(self, current_time_ms: Optional[float] = None) -> Optional[ViewportState]:
        """
        Update and return current state.
        
        Returns None if no animations active.
        """
        if self._current is None:
            return None
        
        state = self._current.get_state(current_time_ms)
        
        if self._current.is_completed:
            if self._queue:
                # Start next animation from current state
                next_anim = self._queue.pop(0)
                # Adjust start state to current end state
                self._current = next_anim
            else:
                self._current = None
        
        return state
    
    def clear(self) -> None:
        """Clear all animations."""
        if self._current:
            self._current.cancel()
        self._queue.clear()
        self._current = None
    
    @property
    def is_animating(self) -> bool:
        """Check if any animation is active."""
        return self._current is not None
    
    @property
    def queue_length(self) -> int:
        """Get number of queued animations."""
        return len(self._queue) + (1 if self._current else 0)


@dataclass
class GestureState:
    """State for gesture handling."""
    
    is_panning: bool = False
    is_zooming: bool = False
    pan_start_x: float = 0.0
    pan_start_y: float = 0.0
    zoom_center_x: float = 0.0
    zoom_center_y: float = 0.0
    zoom_start_scale: float = 1.0
    last_velocity_x: float = 0.0
    last_velocity_y: float = 0.0


class ViewportAnimator:
    """
    Manages viewport animations and gestures.
    
    Provides smooth pan/zoom with momentum scrolling.
    """
    
    def __init__(
        self,
        initial_state: Optional[ViewportState] = None,
        config: Optional[AnimationConfig] = None,
    ):
        self._state = initial_state or ViewportState()
        self._config = config or AnimationConfig()
        self._queue = AnimationQueue()
        self._gesture = GestureState()
        self._listeners: List[Callable[[ViewportState], None]] = []
        
        # Momentum settings
        self._momentum_decay = 0.95
        self._momentum_threshold = 0.5
    
    @property
    def state(self) -> ViewportState:
        """Get current viewport state."""
        return self._state.copy()
    
    @property
    def is_animating(self) -> bool:
        """Check if animation is active."""
        return self._queue.is_animating
    
    def on_change(self, callback: Callable[[ViewportState], None]) -> None:
        """Register state change listener."""
        self._listeners.append(callback)
    
    def _notify(self) -> None:
        """Notify listeners of state change."""
        for listener in self._listeners:
            listener(self._state)
    
    def update(self, current_time_ms: Optional[float] = None) -> ViewportState:
        """
        Update animator and return current state.
        
        Call this on each frame.
        """
        if self._queue.is_animating:
            state = self._queue.update(current_time_ms)
            if state:
                self._state = state
                self._notify()
        
        return self._state
    
    def animate_to(
        self,
        target: ViewportState,
        config: Optional[AnimationConfig] = None,
    ) -> Animation:
        """
        Animate to target state.
        
        Returns the created animation.
        """
        cfg = config or self._config
        animation = Animation(self._state, target, cfg)
        self._queue.add(animation)
        return animation
    
    def pan_by(
        self,
        delta_x: float,
        delta_y: float,
        animate: bool = False,
    ) -> None:
        """Pan viewport by delta."""
        target = self._state.copy()
        target.scroll_x += delta_x
        target.scroll_y += delta_y
        
        # Also adjust bar range
        bars_delta = delta_x / max(1, self._state.bar_spacing)
        target.start_bar -= bars_delta
        target.end_bar -= bars_delta
        
        if animate:
            self.animate_to(target)
        else:
            self._state = target
            self._notify()
    
    def zoom_by(
        self,
        scale: float,
        center_x: float,
        center_y: float,
        animate: bool = False,
    ) -> None:
        """Zoom viewport around center point."""
        target = self._state.copy()
        
        # Zoom time scale
        bar_range = target.end_bar - target.start_bar
        new_range = bar_range / scale
        center_bar = (target.start_bar + target.end_bar) / 2
        
        target.start_bar = center_bar - new_range / 2
        target.end_bar = center_bar + new_range / 2
        target.bar_spacing *= scale
        
        # Zoom price scale
        price_range = target.price_max - target.price_min
        new_price_range = price_range / scale
        center_price = (target.price_min + target.price_max) / 2
        
        target.price_min = center_price - new_price_range / 2
        target.price_max = center_price + new_price_range / 2
        
        if animate:
            self.animate_to(target)
        else:
            self._state = target
            self._notify()
    
    def zoom_to_fit(
        self,
        start_bar: int,
        end_bar: int,
        price_min: float,
        price_max: float,
        animate: bool = True,
    ) -> None:
        """Zoom to fit specific range."""
        target = ViewportState(
            start_bar=start_bar,
            end_bar=end_bar,
            price_min=price_min,
            price_max=price_max,
            bar_spacing=self._state.bar_spacing,
        )
        
        if animate:
            self.animate_to(target)
        else:
            self._state = target
            self._notify()
    
    def start_pan(self, x: float, y: float) -> None:
        """Start pan gesture."""
        self._gesture.is_panning = True
        self._gesture.pan_start_x = x
        self._gesture.pan_start_y = y
        self._queue.clear()  # Cancel any running animation
    
    def update_pan(self, x: float, y: float) -> None:
        """Update pan gesture."""
        if not self._gesture.is_panning:
            return
        
        delta_x = x - self._gesture.pan_start_x
        delta_y = y - self._gesture.pan_start_y
        
        # Track velocity
        self._gesture.last_velocity_x = delta_x
        self._gesture.last_velocity_y = delta_y
        
        self.pan_by(delta_x, delta_y, animate=False)
        
        self._gesture.pan_start_x = x
        self._gesture.pan_start_y = y
    
    def end_pan(self, apply_momentum: bool = True) -> None:
        """End pan gesture, optionally with momentum."""
        if not self._gesture.is_panning:
            return
        
        self._gesture.is_panning = False
        
        if apply_momentum and (
            abs(self._gesture.last_velocity_x) > self._momentum_threshold or
            abs(self._gesture.last_velocity_y) > self._momentum_threshold
        ):
            # Apply momentum animation
            target = self._state.copy()
            momentum_factor = 10  # How far momentum carries
            
            target.scroll_x += self._gesture.last_velocity_x * momentum_factor
            target.scroll_y += self._gesture.last_velocity_y * momentum_factor
            
            bars_delta = (self._gesture.last_velocity_x * momentum_factor) / max(1, self._state.bar_spacing)
            target.start_bar -= bars_delta
            target.end_bar -= bars_delta
            
            config = AnimationConfig(duration_ms=500, easing=EasingType.EASE_OUT)
            self.animate_to(target, config)
    
    def start_pinch_zoom(self, center_x: float, center_y: float, scale: float) -> None:
        """Start pinch zoom gesture."""
        self._gesture.is_zooming = True
        self._gesture.zoom_center_x = center_x
        self._gesture.zoom_center_y = center_y
        self._gesture.zoom_start_scale = scale
        self._queue.clear()
    
    def update_pinch_zoom(self, scale: float) -> None:
        """Update pinch zoom gesture."""
        if not self._gesture.is_zooming:
            return
        
        relative_scale = scale / self._gesture.zoom_start_scale
        self.zoom_by(
            relative_scale,
            self._gesture.zoom_center_x,
            self._gesture.zoom_center_y,
            animate=False,
        )
        self._gesture.zoom_start_scale = scale
    
    def end_pinch_zoom(self) -> None:
        """End pinch zoom gesture."""
        self._gesture.is_zooming = False
    
    def stop_all_animations(self) -> None:
        """Stop all animations immediately."""
        self._queue.clear()
    
    def get_deterministic_frames(
        self,
        target: ViewportState,
        config: Optional[AnimationConfig] = None,
    ) -> List[AnimationFrame]:
        """
        Get all frames for animation to target.
        
        For deterministic visual testing.
        """
        cfg = config or self._config
        animation = Animation(self._state, target, cfg, start_time_ms=0)
        return animation.get_all_frames()


class FrameScheduler:
    """
    Deterministic frame scheduler for animations.
    
    Ensures consistent timing across different environments.
    """
    
    def __init__(self, fps: int = 60):
        self._fps = fps
        self._frame_duration_ms = 1000.0 / fps
        self._current_frame = 0
        self._start_time_ms = 0.0
        self._is_running = False
    
    @property
    def fps(self) -> int:
        """Get frames per second."""
        return self._fps
    
    @property
    def frame_duration_ms(self) -> float:
        """Get frame duration in ms."""
        return self._frame_duration_ms
    
    @property
    def current_frame(self) -> int:
        """Get current frame number."""
        return self._current_frame
    
    @property
    def current_time_ms(self) -> float:
        """Get deterministic current time in ms."""
        return self._start_time_ms + (self._current_frame * self._frame_duration_ms)
    
    def start(self, start_time_ms: float = 0.0) -> None:
        """Start scheduler."""
        self._start_time_ms = start_time_ms
        self._current_frame = 0
        self._is_running = True
    
    def advance(self) -> float:
        """Advance to next frame, return new time."""
        if self._is_running:
            self._current_frame += 1
        return self.current_time_ms
    
    def advance_by(self, frames: int) -> float:
        """Advance by multiple frames."""
        if self._is_running:
            self._current_frame += frames
        return self.current_time_ms
    
    def advance_to_time(self, time_ms: float) -> int:
        """Advance to specific time, return frames advanced."""
        target_frame = int((time_ms - self._start_time_ms) / self._frame_duration_ms)
        frames_advanced = target_frame - self._current_frame
        self._current_frame = target_frame
        return frames_advanced
    
    def stop(self) -> None:
        """Stop scheduler."""
        self._is_running = False
    
    def reset(self) -> None:
        """Reset scheduler."""
        self._current_frame = 0
        self._is_running = False


class AnimationRecorder:
    """
    Records animation frames for visual testing.
    
    Captures states at deterministic intervals.
    """
    
    def __init__(self, animator: ViewportAnimator):
        self._animator = animator
        self._scheduler = FrameScheduler()
        self._recorded_frames: List[AnimationFrame] = []
        self._is_recording = False
    
    @property
    def frames(self) -> List[AnimationFrame]:
        """Get recorded frames."""
        return self._recorded_frames.copy()
    
    @property
    def frame_count(self) -> int:
        """Get number of recorded frames."""
        return len(self._recorded_frames)
    
    def start_recording(self) -> None:
        """Start recording frames."""
        self._recorded_frames = []
        self._scheduler.start()
        self._is_recording = True
    
    def capture_frame(self) -> AnimationFrame:
        """Capture current frame."""
        state = self._animator.update(self._scheduler.current_time_ms)
        
        frame = AnimationFrame(
            frame_number=self._scheduler.current_frame,
            timestamp_ms=self._scheduler.current_time_ms,
            state=state,
            progress=0.0,  # Will be set by animation if active
            is_final=not self._animator.is_animating,
        )
        
        self._recorded_frames.append(frame)
        self._scheduler.advance()
        
        return frame
    
    def record_animation(
        self,
        target: ViewportState,
        config: Optional[AnimationConfig] = None,
    ) -> List[AnimationFrame]:
        """
        Record complete animation to target.
        
        Returns all captured frames.
        """
        self.start_recording()
        
        cfg = config or AnimationConfig()
        self._animator.animate_to(target, cfg)
        
        # Capture frames until animation completes
        max_frames = cfg.total_frames + 10  # Safety margin
        for _ in range(max_frames):
            frame = self.capture_frame()
            if frame.is_final:
                break
        
        self.stop_recording()
        return self._recorded_frames
    
    def stop_recording(self) -> None:
        """Stop recording."""
        self._scheduler.stop()
        self._is_recording = False
    
    def clear(self) -> None:
        """Clear recorded frames."""
        self._recorded_frames = []
        self._scheduler.reset()
