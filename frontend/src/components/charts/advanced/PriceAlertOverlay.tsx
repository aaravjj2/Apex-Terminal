import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  GripHorizontal,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertCondition = 'crossing_above' | 'crossing_below' | 'crossing';
export type AlertType = 'price' | 'indicator' | 'volume';
export type AlertState = 'active' | 'triggered' | 'expired' | 'disabled';

export interface PriceAlert {
  id: string;
  price: number;
  condition: AlertCondition;
  type: AlertType;
  state: AlertState;
  label?: string;
  soundEnabled: boolean;
  createdAt: number;
  triggeredAt?: number;
  expiresAt?: number;
}

export interface PriceAlertOverlayProps {
  alerts: PriceAlert[];
  currentPrice: number;
  priceRange: { min: number; max: number };
  chartHeight: number;
  chartOffsetTop?: number;
  onCreateAlert?: (price: number, condition: AlertCondition) => void;
  onUpdateAlert?: (id: string, updates: Partial<PriceAlert>) => void;
  onDeleteAlert?: (id: string) => void;
  onToggleSound?: (id: string) => void;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priceToY(
  price: number,
  priceMin: number,
  priceMax: number,
  height: number,
  offsetTop: number
): number {
  const range = priceMax - priceMin;
  if (range === 0) return offsetTop + height / 2;
  return offsetTop + ((priceMax - price) / range) * height;
}

function yToPrice(
  y: number,
  priceMin: number,
  priceMax: number,
  height: number,
  offsetTop: number
): number {
  const range = priceMax - priceMin;
  return priceMax - ((y - offsetTop) / height) * range;
}

const CONDITION_LABELS: Record<AlertCondition, string> = {
  crossing_above: 'Crossing Above',
  crossing_below: 'Crossing Below',
  crossing: 'Crossing',
};

const CONDITION_ICONS: Record<AlertCondition, React.ReactNode> = {
  crossing_above: <ChevronUp size={10} />,
  crossing_below: <ChevronDown size={10} />,
  crossing: <AlertTriangle size={10} />,
};

const STATE_COLORS: Record<AlertState, { line: string; bg: string; text: string }> = {
  active: { line: '#3b82f6', bg: 'bg-blue-900/80', text: 'text-blue-300' },
  triggered: { line: '#f59e0b', bg: 'bg-yellow-900/80', text: 'text-yellow-300' },
  expired: { line: '#525252', bg: 'bg-neutral-800/80', text: 'text-neutral-500' },
  disabled: { line: '#333333', bg: 'bg-neutral-900/80', text: 'text-neutral-600' },
};

// ─── Alert Line ──────────────────────────────────────────────────────────────

const AlertLine: React.FC<{
  alert: PriceAlert;
  y: number;
  containerWidth: number;
  onDragStart: (alertId: string, startY: number) => void;
  onDelete: () => void;
  onToggleSound: () => void;
  onUpdate: (updates: Partial<PriceAlert>) => void;
}> = ({ alert, y, containerWidth, onDragStart, onDelete, onToggleSound, onUpdate }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = STATE_COLORS[alert.state];

  return (
    <div
      className="absolute left-0 right-0 group"
      style={{ top: y - 1 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Dashed line */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${colors.line}, ${colors.line} 6px, transparent 6px, transparent 12px)`,
        }}
      />

      {/* Label badge */}
      <div
        className={`absolute right-2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5
          rounded text-[10px] font-medium ${colors.bg} ${colors.text} border border-neutral-700/50
          shadow-lg cursor-pointer select-none`}
        onMouseDown={(e) => {
          e.preventDefault();
          onDragStart(alert.id, e.clientY);
        }}
      >
        {alert.state === 'triggered' ? (
          <BellRing size={10} className="text-yellow-400" />
        ) : (
          <Bell size={10} />
        )}
        {CONDITION_ICONS[alert.condition]}
        <span>{alert.price.toFixed(2)}</span>
        {alert.label && <span className="text-neutral-500 ml-0.5">· {alert.label}</span>}

        {/* Sound indicator */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSound();
          }}
          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title={alert.soundEnabled ? 'Sound on' : 'Sound off'}
        >
          {alert.soundEnabled ? (
            <Volume2 size={9} className="text-emerald-400" />
          ) : (
            <VolumeX size={9} className="text-neutral-600" />
          )}
        </button>

        {/* Drag handle */}
        <GripHorizontal
          size={10}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500 cursor-grab"
        />

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-red-400"
        >
          <X size={9} />
        </button>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute right-2 z-50 bg-neutral-900/95 border border-neutral-700 rounded-lg
            px-3 py-2 shadow-xl text-xs min-w-[180px] pointer-events-none"
          style={{ top: -70 }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Bell size={10} className={colors.text} />
            <span className="text-white font-medium">{CONDITION_LABELS[alert.condition]}</span>
            <span className={`ml-auto text-[9px] px-1 rounded ${colors.bg} ${colors.text}`}>
              {alert.state}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-neutral-500">Price</span>
            <span className="text-white text-right">{alert.price.toFixed(2)}</span>
            <span className="text-neutral-500">Type</span>
            <span className="text-neutral-300 text-right capitalize">{alert.type}</span>
            <span className="text-neutral-500">Created</span>
            <span className="text-neutral-400 text-right">
              {new Date(alert.createdAt).toLocaleDateString()}
            </span>
            {alert.triggeredAt && (
              <>
                <span className="text-neutral-500">Triggered</span>
                <span className="text-yellow-400 text-right">
                  {new Date(alert.triggeredAt).toLocaleTimeString()}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Create Alert Popup ──────────────────────────────────────────────────────

const CreateAlertPopup: React.FC<{
  price: number;
  y: number;
  onConfirm: (condition: AlertCondition) => void;
  onCancel: () => void;
}> = ({ price, y, onConfirm, onCancel }) => {
  const conditions: AlertCondition[] = ['crossing_above', 'crossing_below', 'crossing'];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="absolute right-16 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ top: y - 20 }}
    >
      <div className="px-3 py-1.5 text-xs text-neutral-400 border-b border-neutral-800">
        Alert at <span className="text-white font-medium">{price.toFixed(2)}</span>
      </div>
      {conditions.map((cond) => (
        <button
          key={cond}
          onClick={() => onConfirm(cond)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300
            hover:bg-neutral-800 transition-colors"
        >
          {CONDITION_ICONS[cond]}
          {CONDITION_LABELS[cond]}
        </button>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PriceAlertOverlay: React.FC<PriceAlertOverlayProps> = ({
  alerts,
  currentPrice,
  priceRange,
  chartHeight,
  chartOffsetTop = 0,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onToggleSound,
  className = '',
}) => {
  const [dragging, setDragging] = useState<{
    alertId: string;
    startY: number;
    startPrice: number;
  } | null>(null);
  const [createPopup, setCreatePopup] = useState<{ price: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const visibleAlerts = useMemo(
    () =>
      alerts.filter(
        (a) => a.price >= priceRange.min && a.price <= priceRange.max
      ),
    [alerts, priceRange]
  );

  const handleDragStart = useCallback(
    (alertId: string, startClientY: number) => {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert) return;
      setDragging({ alertId, startY: startClientY, startPrice: alert.price });
    },
    [alerts]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dy = e.clientY - dragging.startY;
      const pricePerPx = (priceRange.max - priceRange.min) / chartHeight;
      const newPrice = dragging.startPrice - dy * pricePerPx;
      const clamped = Math.max(priceRange.min, Math.min(priceRange.max, newPrice));
      onUpdateAlert?.(dragging.alertId, { price: clamped });
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, priceRange, chartHeight, onUpdateAlert]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onCreateAlert) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const price = yToPrice(y, priceRange.min, priceRange.max, chartHeight, chartOffsetTop);
      setCreatePopup({ price, y });
    },
    [onCreateAlert, priceRange, chartHeight, chartOffsetTop]
  );

  const handleCreateConfirm = useCallback(
    (condition: AlertCondition) => {
      if (!createPopup) return;
      onCreateAlert?.(createPopup.price, condition);
      setCreatePopup(null);
    },
    [createPopup, onCreateAlert]
  );

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      onDoubleClick={(e) => {
        (e.target as HTMLElement).style.pointerEvents = 'auto';
        handleDoubleClick(e);
      }}
      style={{ pointerEvents: createPopup || dragging ? 'auto' : 'none' }}
    >
      {/* Alert lines */}
      {visibleAlerts.map((alert) => {
        const y = priceToY(
          alert.price,
          priceRange.min,
          priceRange.max,
          chartHeight,
          chartOffsetTop
        );

        return (
          <div key={alert.id} style={{ pointerEvents: 'auto' }}>
            <AlertLine
              alert={alert}
              y={y}
              containerWidth={containerRef.current?.clientWidth ?? 0}
              onDragStart={handleDragStart}
              onDelete={() => onDeleteAlert?.(alert.id)}
              onToggleSound={() => onToggleSound?.(alert.id)}
              onUpdate={(updates) => onUpdateAlert?.(alert.id, updates)}
            />
          </div>
        );
      })}

      {/* Create alert popup */}
      {createPopup && (
        <div style={{ pointerEvents: 'auto' }}>
          <CreateAlertPopup
            price={createPopup.price}
            y={createPopup.y}
            onConfirm={handleCreateConfirm}
            onCancel={() => setCreatePopup(null)}
          />
        </div>
      )}

      {/* Create alert hint */}
      {onCreateAlert && visibleAlerts.length === 0 && !createPopup && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded
          bg-neutral-900/60 text-[10px] text-neutral-600 pointer-events-none">
          <Plus size={10} />
          Double-click to create alert
        </div>
      )}
    </div>
  );
};

export default PriceAlertOverlay;
