import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { Settings, Eye, EyeOff, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VolumePriceLevel {
  price: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
}

export interface VolumeProfileSession {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  levels: VolumePriceLevel[];
}

export type ProfileMode = 'total' | 'delta' | 'buySell';
export type ProfileRange = 'session' | 'visible' | 'fixed';

export interface VolumeProfileProps {
  sessions: VolumeProfileSession[];
  currentPrice?: number;
  visiblePriceRange?: { min: number; max: number };
  valueAreaPercent?: number;
  mode?: ProfileMode;
  rangeType?: ProfileRange;
  showPOC?: boolean;
  showValueArea?: boolean;
  showDevelopingPOC?: boolean;
  orientation?: 'left' | 'right';
  onPriceClick?: (price: number) => void;
  className?: string;
}

interface ComputedProfile {
  levels: VolumePriceLevel[];
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  maxVolume: number;
  developingPOC: number[];
}

// ─── Computations ────────────────────────────────────────────────────────────

function computeProfile(
  sessions: VolumeProfileSession[],
  valueAreaPct: number,
  priceRange?: { min: number; max: number }
): ComputedProfile {
  const merged = new Map<number, VolumePriceLevel>();

  for (const session of sessions) {
    for (const level of session.levels) {
      if (priceRange && (level.price < priceRange.min || level.price > priceRange.max)) {
        continue;
      }
      const existing = merged.get(level.price);
      if (existing) {
        existing.buyVolume += level.buyVolume;
        existing.sellVolume += level.sellVolume;
        existing.totalVolume += level.totalVolume;
      } else {
        merged.set(level.price, { ...level });
      }
    }
  }

  const levels = [...merged.values()].sort((a, b) => b.price - a.price);
  if (levels.length === 0) {
    return {
      levels: [],
      poc: 0,
      valueAreaHigh: 0,
      valueAreaLow: 0,
      maxVolume: 0,
      developingPOC: [],
    };
  }

  const maxVolume = Math.max(...levels.map((l) => l.totalVolume));
  const pocLevel = levels.reduce((max, l) =>
    l.totalVolume > max.totalVolume ? l : max
  );
  const poc = pocLevel.price;

  // Value Area computation
  const totalVol = levels.reduce((s, l) => s + l.totalVolume, 0);
  const targetVol = totalVol * (valueAreaPct / 100);

  const pocIdx = levels.findIndex((l) => l.price === poc);
  let vaVol = pocLevel.totalVolume;
  let hiIdx = pocIdx;
  let loIdx = pocIdx;

  while (vaVol < targetVol && (hiIdx > 0 || loIdx < levels.length - 1)) {
    const hiVol = hiIdx > 0 ? levels[hiIdx - 1].totalVolume : 0;
    const loVol = loIdx < levels.length - 1 ? levels[loIdx + 1].totalVolume : 0;

    if (hiVol >= loVol && hiIdx > 0) {
      hiIdx--;
      vaVol += levels[hiIdx].totalVolume;
    } else if (loIdx < levels.length - 1) {
      loIdx++;
      vaVol += levels[loIdx].totalVolume;
    } else {
      break;
    }
  }

  const valueAreaHigh = levels[hiIdx].price;
  const valueAreaLow = levels[loIdx].price;

  // Developing POC
  const developingPOC: number[] = [];
  const running = new Map<number, number>();
  for (const session of sessions) {
    for (const level of session.levels) {
      running.set(level.price, (running.get(level.price) ?? 0) + level.totalVolume);
      let maxP = 0;
      let maxV = 0;
      for (const [p, v] of running) {
        if (v > maxV) {
          maxV = v;
          maxP = p;
        }
      }
      developingPOC.push(maxP);
    }
  }

  return { levels, poc, valueAreaHigh, valueAreaLow, maxVolume, developingPOC };
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderProfileCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: ComputedProfile,
  mode: ProfileMode,
  showPOC: boolean,
  showVA: boolean,
  orientation: 'left' | 'right',
  currentPrice?: number
) {
  ctx.clearRect(0, 0, width, height);

  const { levels, poc, valueAreaHigh, valueAreaLow, maxVolume } = profile;
  if (levels.length === 0) {
    ctx.fillStyle = '#737373';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No volume data', width / 2, height / 2);
    return;
  }

  const padding = { top: 10, bottom: 10, left: 50, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const priceMax = levels[0].price;
  const priceMin = levels[levels.length - 1].price;
  const priceRange = priceMax - priceMin || 1;

  const priceToY = (p: number) =>
    padding.top + ((priceMax - p) / priceRange) * chartH;
  const barHeight = Math.max(chartH / levels.length - 1, 1);

  // Value Area shading
  if (showVA) {
    const vaTop = priceToY(valueAreaHigh);
    const vaBottom = priceToY(valueAreaLow);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.fillRect(padding.left, vaTop, chartW, vaBottom - vaTop);
  }

  // Bars
  for (const level of levels) {
    const y = priceToY(level.price) - barHeight / 2;

    if (mode === 'buySell') {
      const buyW = (level.buyVolume / maxVolume) * chartW;
      const sellW = (level.sellVolume / maxVolume) * chartW;

      if (orientation === 'left') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.fillRect(padding.left + chartW - buyW - sellW, y, buyW, barHeight);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(padding.left + chartW - sellW, y, sellW, barHeight);
      } else {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.fillRect(padding.left, y, buyW, barHeight);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.fillRect(padding.left + buyW, y, sellW, barHeight);
      }
    } else if (mode === 'delta') {
      const delta = level.buyVolume - level.sellVolume;
      const absDelta = Math.abs(delta);
      const w = (absDelta / maxVolume) * chartW;
      const color = delta >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
      ctx.fillStyle = color;

      if (orientation === 'left') {
        ctx.fillRect(padding.left + chartW - w, y, w, barHeight);
      } else {
        ctx.fillRect(padding.left, y, w, barHeight);
      }
    } else {
      const w = (level.totalVolume / maxVolume) * chartW;
      const isPOC = level.price === poc;
      ctx.fillStyle = isPOC
        ? 'rgba(59, 130, 246, 0.8)'
        : 'rgba(115, 115, 115, 0.5)';

      if (orientation === 'left') {
        ctx.fillRect(padding.left + chartW - w, y, w, barHeight);
      } else {
        ctx.fillRect(padding.left, y, w, barHeight);
      }
    }
  }

  // POC line
  if (showPOC) {
    const pocY = priceToY(poc);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, pocY);
    ctx.lineTo(padding.left + chartW, pocY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`POC ${poc.toFixed(2)}`, padding.left - 4, pocY + 3);
  }

  // Value Area lines
  if (showVA) {
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#3b82f680';
    ctx.lineWidth = 1;

    const vahY = priceToY(valueAreaHigh);
    ctx.beginPath();
    ctx.moveTo(padding.left, vahY);
    ctx.lineTo(padding.left + chartW, vahY);
    ctx.stroke();

    const valY = priceToY(valueAreaLow);
    ctx.beginPath();
    ctx.moveTo(padding.left, valY);
    ctx.lineTo(padding.left + chartW, valY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#3b82f6';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`VAH ${valueAreaHigh.toFixed(2)}`, padding.left - 4, vahY + 3);
    ctx.fillText(`VAL ${valueAreaLow.toFixed(2)}`, padding.left - 4, valY + 3);
  }

  // Current price
  if (currentPrice !== undefined) {
    const cpY = priceToY(currentPrice);
    if (cpY >= padding.top && cpY <= padding.top + chartH) {
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, cpY);
      ctx.lineTo(padding.left + chartW, cpY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Price axis
  ctx.fillStyle = '#737373';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'right';
  const priceSteps = Math.min(levels.length, 10);
  const stepSize = Math.max(1, Math.floor(levels.length / priceSteps));
  for (let i = 0; i < levels.length; i += stepSize) {
    const y = priceToY(levels[i].price);
    ctx.fillText(levels[i].price.toFixed(2), padding.left - 4, y + 3);
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const VolumeProfile: React.FC<VolumeProfileProps> = ({
  sessions,
  currentPrice,
  visiblePriceRange,
  valueAreaPercent = 70,
  mode: propMode,
  showPOC: propShowPOC = true,
  showValueArea: propShowVA = true,
  showDevelopingPOC: propShowDevPOC = false,
  orientation = 'left',
  onPriceClick,
  className = '',
}) => {
  const [mode, setMode] = useState<ProfileMode>(propMode ?? 'total');
  const [showPOC, setShowPOC] = useState(propShowPOC);
  const [showVA, setShowVA] = useState(propShowVA);
  const [showSettings, setShowSettings] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(
    () => computeProfile(sessions, valueAreaPercent, visiblePriceRange),
    [sessions, valueAreaPercent, visiblePriceRange]
  );

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    renderProfileCanvas(
      ctx,
      size.width,
      size.height,
      profile,
      mode,
      showPOC,
      showVA,
      orientation,
      currentPrice
    );
  }, [size, profile, mode, showPOC, showVA, orientation, currentPrice]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onPriceClick || !canvasRef.current || profile.levels.length === 0) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const padding = { top: 10, bottom: 10 };
      const chartH = size.height - padding.top - padding.bottom;
      const priceMax = profile.levels[0].price;
      const priceMin = profile.levels[profile.levels.length - 1].price;
      const priceRange = priceMax - priceMin || 1;
      const price = priceMax - ((y - padding.top) / chartH) * priceRange;
      onPriceClick(price);
    },
    [onPriceClick, profile, size]
  );

  const modeOptions: { key: ProfileMode; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'buySell', label: 'Buy/Sell' },
    { key: 'delta', label: 'Delta' },
  ];

  return (
    <div className={`flex flex-col h-full bg-neutral-950 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500 font-medium">Volume Profile</span>

        <div className="flex items-center rounded bg-neutral-800 overflow-hidden ml-2">
          {modeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`px-2 py-0.5 text-xs transition-colors ${
                mode === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Stats */}
        {profile.poc > 0 && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-neutral-500">
              POC: <span className="text-blue-400 font-medium">{profile.poc.toFixed(2)}</span>
            </span>
            <span className="text-neutral-500">
              VAH: <span className="text-neutral-300">{profile.valueAreaHigh.toFixed(2)}</span>
            </span>
            <span className="text-neutral-500">
              VAL: <span className="text-neutral-300">{profile.valueAreaLow.toFixed(2)}</span>
            </span>
          </div>
        )}

        <button
          onClick={() => setShowPOC(!showPOC)}
          className={`p-1 rounded text-xs transition-colors ${
            showPOC ? 'text-blue-400 bg-blue-900/30' : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title="Toggle POC"
        >
          {showPOC ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          >
            <Settings size={12} />
          </button>
          {showSettings && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-3 min-w-[180px] text-xs">
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPOC}
                  onChange={(e) => setShowPOC(e.target.checked)}
                  className="accent-blue-500"
                />
                Show POC
              </label>
              <label className="flex items-center gap-2 mb-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVA}
                  onChange={(e) => setShowVA(e.target.checked)}
                  className="accent-blue-500"
                />
                Show Value Area
              </label>
              <div className="text-neutral-500 mt-2">
                Value Area: {valueAreaPercent}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
      </div>
    </div>
  );
};

export default VolumeProfile;
