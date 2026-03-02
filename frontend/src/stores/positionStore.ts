import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PositionSide = 'long' | 'short';

export interface StopLossConfig {
  enabled: boolean;
  price: number;
  type: 'fixed' | 'trailing' | 'atr';
  trailingPercent?: number;
  atrMultiplier?: number;
}

export interface TakeProfitConfig {
  enabled: boolean;
  price: number;
  type: 'fixed' | 'risk_multiple';
  riskMultiple?: number;
  partialClose?: { percent: number; price: number }[];
}

export interface PositionEvent {
  id: string;
  positionId: string;
  type: 'opened' | 'closed' | 'added' | 'reduced' | 'reversed' | 'stop_triggered' | 'tp_triggered' | 'dividend' | 'split';
  timestamp: number;
  quantity: number;
  price: number;
  realizedPnl: number;
  details: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  name: string;
  side: PositionSide;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  previousClose: number;

  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  dailyPnl: number;
  dailyPnlPct: number;
  totalPnl: number;

  marketValue: number;
  costBasis: number;
  weight: number;

  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;

  sector: string;
  assetType: string;
  exchange: string;
  currency: string;
  beta: number;

  openedAt: number;
  lastUpdatedAt: number;
  tags: string[];
}

export interface ClosedPosition {
  id: string;
  symbol: string;
  name: string;
  side: PositionSide;
  quantity: number;
  avgEntryPrice: number;
  avgExitPrice: number;

  realizedPnl: number;
  realizedPnlPct: number;
  totalCommission: number;
  totalSlippage: number;
  netPnl: number;

  holdingPeriodDays: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;

  sector: string;
  openedAt: number;
  closedAt: number;
  closeReason: string;
  tags: string[];
}

export interface DailyPnlEntry {
  date: string;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  trades: number;
}

export interface PositionGroupStats {
  key: string;
  label: string;
  positionCount: number;
  marketValue: number;
  weight: number;
  unrealizedPnl: number;
  dailyPnl: number;
}

export interface AggregateStats {
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  totalRealizedPnl: number;
  totalDailyPnl: number;
  totalDailyPnlPct: number;
  positionCount: number;
  longCount: number;
  shortCount: number;
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  grossExposure: number;
  longShortRatio: number;
  weightedBeta: number;
  largestPosition: string;
  bestPerformer: string;
  worstPerformer: string;
}

// ─── Store State ────────────────────────────────────────────────────────────

interface PositionStoreState {
  positions: Record<string, OpenPosition>;
  closedPositions: ClosedPosition[];
  events: PositionEvent[];
  dailyPnl: DailyPnlEntry[];
  aggregateStats: AggregateStats;

  selectedPositionId: string | null;
  groupBy: 'none' | 'sector' | 'type' | 'side' | 'tag';
  sortField: keyof OpenPosition;
  sortDirection: 'asc' | 'desc';
  filterSide: PositionSide | 'all';
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyAggregateStats(): AggregateStats {
  return {
    totalMarketValue: 0, totalCostBasis: 0, totalUnrealizedPnl: 0, totalUnrealizedPnlPct: 0,
    totalRealizedPnl: 0, totalDailyPnl: 0, totalDailyPnlPct: 0,
    positionCount: 0, longCount: 0, shortCount: 0,
    longExposure: 0, shortExposure: 0, netExposure: 0, grossExposure: 0,
    longShortRatio: 0, weightedBeta: 0,
    largestPosition: '', bestPerformer: '', worstPerformer: '',
  };
}

function recalcAggregate(positions: Record<string, OpenPosition>): AggregateStats {
  const all = Object.values(positions);
  if (all.length === 0) return emptyAggregateStats();

  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalUnrealizedPnl = 0;
  let totalDailyPnl = 0;
  let longExposure = 0;
  let shortExposure = 0;
  let weightedBetaSum = 0;
  let largestVal = 0;
  let largestSym = '';
  let bestPnlPct = -Infinity;
  let bestSym = '';
  let worstPnlPct = Infinity;
  let worstSym = '';

  for (const p of all) {
    totalMarketValue += p.marketValue;
    totalCostBasis += p.costBasis;
    totalUnrealizedPnl += p.unrealizedPnl;
    totalDailyPnl += p.dailyPnl;
    weightedBetaSum += p.beta * p.marketValue;

    if (p.side === 'long') longExposure += p.marketValue;
    else shortExposure += p.marketValue;

    if (p.marketValue > largestVal) { largestVal = p.marketValue; largestSym = p.symbol; }
    if (p.unrealizedPnlPct > bestPnlPct) { bestPnlPct = p.unrealizedPnlPct; bestSym = p.symbol; }
    if (p.unrealizedPnlPct < worstPnlPct) { worstPnlPct = p.unrealizedPnlPct; worstSym = p.symbol; }
  }

  const grossExposure = longExposure + shortExposure;

  return {
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct: totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0,
    totalRealizedPnl: 0,
    totalDailyPnl,
    totalDailyPnlPct: totalMarketValue > 0 ? (totalDailyPnl / (totalMarketValue - totalDailyPnl)) * 100 : 0,
    positionCount: all.length,
    longCount: all.filter((p) => p.side === 'long').length,
    shortCount: all.filter((p) => p.side === 'short').length,
    longExposure,
    shortExposure,
    netExposure: longExposure - shortExposure,
    grossExposure,
    longShortRatio: shortExposure > 0 ? longExposure / shortExposure : longExposure > 0 ? Infinity : 0,
    weightedBeta: grossExposure > 0 ? weightedBetaSum / grossExposure : 0,
    largestPosition: largestSym,
    bestPerformer: bestSym,
    worstPerformer: worstSym,
  };
}

function recalcPositionPnl(p: OpenPosition): void {
  const direction = p.side === 'long' ? 1 : -1;
  p.marketValue = p.quantity * p.currentPrice;
  p.costBasis = p.quantity * p.avgEntryPrice;
  p.unrealizedPnl = direction * p.quantity * (p.currentPrice - p.avgEntryPrice);
  p.unrealizedPnlPct = p.avgEntryPrice > 0 ? (p.unrealizedPnl / p.costBasis) * 100 : 0;
  p.dailyPnl = direction * p.quantity * (p.currentPrice - p.previousClose);
  p.dailyPnlPct = p.previousClose > 0 ? ((p.currentPrice - p.previousClose) / p.previousClose) * 100 * direction : 0;
  p.totalPnl = p.unrealizedPnl + p.realizedPnl;
  p.lastUpdatedAt = Date.now();
}

// ─── Actions ────────────────────────────────────────────────────────────────

interface PositionStoreActions {
  openPosition: (params: {
    symbol: string; name: string; side: PositionSide; quantity: number; price: number;
    sector?: string; assetType?: string; exchange?: string; beta?: number; tags?: string[];
  }) => string;
  closePosition: (positionId: string, exitPrice: number, reason?: string) => ClosedPosition | null;
  addToPosition: (positionId: string, quantity: number, price: number) => void;
  reducePosition: (positionId: string, quantity: number, price: number) => number;
  reversePosition: (positionId: string, price: number) => void;

  setStopLoss: (positionId: string, config: Partial<StopLossConfig>) => void;
  setTakeProfit: (positionId: string, config: Partial<TakeProfitConfig>) => void;
  clearStopLoss: (positionId: string) => void;
  clearTakeProfit: (positionId: string) => void;

  updatePrice: (symbol: string, currentPrice: number, previousClose?: number) => void;
  updatePrices: (updates: { symbol: string; price: number; previousClose?: number }[]) => void;

  updateWeights: () => void;

  selectPosition: (id: string | null) => void;
  setGroupBy: (groupBy: PositionStoreState['groupBy']) => void;
  setSortField: (field: keyof OpenPosition) => void;
  toggleSortDirection: () => void;
  setFilterSide: (side: PositionSide | 'all') => void;

  addDailyPnlEntry: (entry: Omit<DailyPnlEntry, 'trades'> & { trades?: number }) => void;
  clearClosedPositions: () => void;
  clearEvents: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const usePositionStore = create<PositionStoreState & PositionStoreActions>()(
  immer((set, get) => ({
    positions: {},
    closedPositions: [],
    events: [],
    dailyPnl: [],
    aggregateStats: emptyAggregateStats(),
    selectedPositionId: null,
    groupBy: 'none',
    sortField: 'unrealizedPnl' as keyof OpenPosition,
    sortDirection: 'desc' as const,
    filterSide: 'all',

    openPosition: (params) => {
      const id = generateId('pos');
      const now = Date.now();
      const position: OpenPosition = {
        id,
        symbol: params.symbol,
        name: params.name,
        side: params.side,
        quantity: params.quantity,
        avgEntryPrice: params.price,
        currentPrice: params.price,
        previousClose: params.price,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        realizedPnl: 0,
        dailyPnl: 0,
        dailyPnlPct: 0,
        totalPnl: 0,
        marketValue: params.quantity * params.price,
        costBasis: params.quantity * params.price,
        weight: 0,
        stopLoss: { enabled: false, price: 0, type: 'fixed' },
        takeProfit: { enabled: false, price: 0, type: 'fixed' },
        sector: params.sector ?? 'Unknown',
        assetType: params.assetType ?? 'stock',
        exchange: params.exchange ?? '',
        currency: 'USD',
        beta: params.beta ?? 1,
        openedAt: now,
        lastUpdatedAt: now,
        tags: params.tags ?? [],
      };

      set((s) => {
        s.positions[id] = position;
        s.events.push({
          id: generateId('evt'), positionId: id, type: 'opened', timestamp: now,
          quantity: params.quantity, price: params.price, realizedPnl: 0,
          details: `Opened ${params.side} ${params.quantity} ${params.symbol} @ ${params.price}`,
        });
        s.aggregateStats = recalcAggregate(s.positions);
      });

      get().updateWeights();
      return id;
    },

    closePosition: (positionId, exitPrice, reason) => {
      const pos = get().positions[positionId];
      if (!pos) return null;

      const direction = pos.side === 'long' ? 1 : -1;
      const realizedPnl = direction * pos.quantity * (exitPrice - pos.avgEntryPrice);
      const now = Date.now();

      const closed: ClosedPosition = {
        id: pos.id,
        symbol: pos.symbol,
        name: pos.name,
        side: pos.side,
        quantity: pos.quantity,
        avgEntryPrice: pos.avgEntryPrice,
        avgExitPrice: exitPrice,
        realizedPnl,
        realizedPnlPct: pos.costBasis > 0 ? (realizedPnl / pos.costBasis) * 100 : 0,
        totalCommission: 0,
        totalSlippage: 0,
        netPnl: realizedPnl,
        holdingPeriodDays: Math.max(1, Math.floor((now - pos.openedAt) / 86_400_000)),
        maxFavorableExcursion: 0,
        maxAdverseExcursion: 0,
        sector: pos.sector,
        openedAt: pos.openedAt,
        closedAt: now,
        closeReason: reason ?? 'manual',
        tags: pos.tags,
      };

      set((s) => {
        s.closedPositions.unshift(closed);
        delete s.positions[positionId];
        s.events.push({
          id: generateId('evt'), positionId, type: 'closed', timestamp: now,
          quantity: pos.quantity, price: exitPrice, realizedPnl,
          details: `Closed ${pos.side} ${pos.quantity} ${pos.symbol} @ ${exitPrice} PnL: ${realizedPnl.toFixed(2)}`,
        });
        if (s.selectedPositionId === positionId) s.selectedPositionId = null;
        s.aggregateStats = recalcAggregate(s.positions);
      });

      get().updateWeights();
      return closed;
    },

    addToPosition: (positionId, quantity, price) => {
      set((s) => {
        const pos = s.positions[positionId];
        if (!pos) return;
        const totalCost = pos.avgEntryPrice * pos.quantity + price * quantity;
        const totalQty = pos.quantity + quantity;
        pos.avgEntryPrice = totalCost / totalQty;
        pos.quantity = totalQty;
        recalcPositionPnl(pos);
        s.events.push({
          id: generateId('evt'), positionId, type: 'added', timestamp: Date.now(),
          quantity, price, realizedPnl: 0,
          details: `Added ${quantity} @ ${price}, new avg=${pos.avgEntryPrice.toFixed(2)}`,
        });
        s.aggregateStats = recalcAggregate(s.positions);
      });
    },

    reducePosition: (positionId, quantity, price) => {
      const pos = get().positions[positionId];
      if (!pos) return 0;

      const reduceQty = Math.min(quantity, pos.quantity);
      const direction = pos.side === 'long' ? 1 : -1;
      const realizedPnl = direction * reduceQty * (price - pos.avgEntryPrice);

      set((s) => {
        const p = s.positions[positionId];
        if (!p) return;
        p.quantity -= reduceQty;
        p.realizedPnl += realizedPnl;
        recalcPositionPnl(p);

        s.events.push({
          id: generateId('evt'), positionId, type: 'reduced', timestamp: Date.now(),
          quantity: reduceQty, price, realizedPnl,
          details: `Reduced by ${reduceQty} @ ${price}, realized PnL: ${realizedPnl.toFixed(2)}`,
        });

        if (p.quantity <= 0) {
          const closed: ClosedPosition = {
            id: p.id, symbol: p.symbol, name: p.name, side: p.side,
            quantity: reduceQty, avgEntryPrice: p.avgEntryPrice, avgExitPrice: price,
            realizedPnl: p.realizedPnl, realizedPnlPct: p.costBasis > 0 ? (p.realizedPnl / p.costBasis) * 100 : 0,
            totalCommission: 0, totalSlippage: 0, netPnl: p.realizedPnl,
            holdingPeriodDays: Math.max(1, Math.floor((Date.now() - p.openedAt) / 86_400_000)),
            maxFavorableExcursion: 0, maxAdverseExcursion: 0,
            sector: p.sector, openedAt: p.openedAt, closedAt: Date.now(),
            closeReason: 'fully_reduced', tags: p.tags,
          };
          s.closedPositions.unshift(closed);
          delete s.positions[positionId];
          if (s.selectedPositionId === positionId) s.selectedPositionId = null;
        }

        s.aggregateStats = recalcAggregate(s.positions);
      });

      return realizedPnl;
    },

    reversePosition: (positionId, price) => {
      const pos = get().positions[positionId];
      if (!pos) return;
      const qty = pos.quantity;
      const newSide: PositionSide = pos.side === 'long' ? 'short' : 'long';

      get().closePosition(positionId, price, 'reversed');
      get().openPosition({
        symbol: pos.symbol, name: pos.name, side: newSide,
        quantity: qty, price, sector: pos.sector, assetType: pos.assetType,
        exchange: pos.exchange, beta: pos.beta, tags: pos.tags,
      });
    },

    setStopLoss: (positionId, config) => {
      set((s) => {
        const pos = s.positions[positionId];
        if (pos) Object.assign(pos.stopLoss, config, { enabled: true });
      });
    },

    setTakeProfit: (positionId, config) => {
      set((s) => {
        const pos = s.positions[positionId];
        if (pos) Object.assign(pos.takeProfit, config, { enabled: true });
      });
    },

    clearStopLoss: (positionId) => {
      set((s) => {
        const pos = s.positions[positionId];
        if (pos) pos.stopLoss = { enabled: false, price: 0, type: 'fixed' };
      });
    },

    clearTakeProfit: (positionId) => {
      set((s) => {
        const pos = s.positions[positionId];
        if (pos) pos.takeProfit = { enabled: false, price: 0, type: 'fixed' };
      });
    },

    updatePrice: (symbol, currentPrice, previousClose) => {
      set((s) => {
        for (const pos of Object.values(s.positions)) {
          if (pos.symbol !== symbol) continue;
          pos.currentPrice = currentPrice;
          if (previousClose !== undefined) pos.previousClose = previousClose;
          recalcPositionPnl(pos);

          // Check stop loss
          if (pos.stopLoss.enabled) {
            const isHit = pos.side === 'long'
              ? currentPrice <= pos.stopLoss.price
              : currentPrice >= pos.stopLoss.price;
            if (isHit) {
              s.events.push({
                id: generateId('evt'), positionId: pos.id, type: 'stop_triggered',
                timestamp: Date.now(), quantity: pos.quantity, price: currentPrice, realizedPnl: 0,
                details: `Stop loss triggered at ${currentPrice}`,
              });
            }
          }

          // Check take profit
          if (pos.takeProfit.enabled) {
            const isHit = pos.side === 'long'
              ? currentPrice >= pos.takeProfit.price
              : currentPrice <= pos.takeProfit.price;
            if (isHit) {
              s.events.push({
                id: generateId('evt'), positionId: pos.id, type: 'tp_triggered',
                timestamp: Date.now(), quantity: pos.quantity, price: currentPrice, realizedPnl: 0,
                details: `Take profit triggered at ${currentPrice}`,
              });
            }
          }

          // Update trailing stop
          if (pos.stopLoss.enabled && pos.stopLoss.type === 'trailing' && pos.stopLoss.trailingPercent) {
            const trailPct = pos.stopLoss.trailingPercent / 100;
            if (pos.side === 'long') {
              const newStop = currentPrice * (1 - trailPct);
              if (newStop > pos.stopLoss.price) pos.stopLoss.price = newStop;
            } else {
              const newStop = currentPrice * (1 + trailPct);
              if (newStop < pos.stopLoss.price || pos.stopLoss.price === 0) pos.stopLoss.price = newStop;
            }
          }
        }
        s.aggregateStats = recalcAggregate(s.positions);
      });
    },

    updatePrices: (updates) => {
      set((s) => {
        const priceMap = new Map(updates.map((u) => [u.symbol, u]));
        for (const pos of Object.values(s.positions)) {
          const upd = priceMap.get(pos.symbol);
          if (!upd) continue;
          pos.currentPrice = upd.price;
          if (upd.previousClose !== undefined) pos.previousClose = upd.previousClose;
          recalcPositionPnl(pos);
        }
        s.aggregateStats = recalcAggregate(s.positions);
      });
    },

    updateWeights: () => {
      set((s) => {
        const totalMV = Object.values(s.positions).reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
        if (totalMV <= 0) return;
        for (const pos of Object.values(s.positions)) {
          pos.weight = (Math.abs(pos.marketValue) / totalMV) * 100;
        }
      });
    },

    selectPosition: (id) => {
      set((s) => {
        s.selectedPositionId = id;
      });
    },

    setGroupBy: (groupBy) => {
      set((s) => {
        s.groupBy = groupBy;
      });
    },

    setSortField: (field) => {
      set((s) => {
        if (s.sortField === field) {
          s.sortDirection = s.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          s.sortField = field;
          s.sortDirection = 'desc';
        }
      });
    },

    toggleSortDirection: () => {
      set((s) => {
        s.sortDirection = s.sortDirection === 'asc' ? 'desc' : 'asc';
      });
    },

    setFilterSide: (side) => {
      set((s) => {
        s.filterSide = side;
      });
    },

    addDailyPnlEntry: (entry) => {
      set((s) => {
        s.dailyPnl.push({ ...entry, trades: entry.trades ?? 0 });
      });
    },

    clearClosedPositions: () => {
      set((s) => {
        s.closedPositions = [];
      });
    },

    clearEvents: () => {
      set((s) => {
        s.events = [];
      });
    },
  })),
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectPositionsList = (s: PositionStoreState) => Object.values(s.positions);

export const selectPosition = (id: string) => (s: PositionStoreState) =>
  s.positions[id] ?? null;

export const selectPositionBySymbol = (symbol: string) => (s: PositionStoreState) =>
  Object.values(s.positions).find((p) => p.symbol === symbol) ?? null;

export const selectLongPositions = (s: PositionStoreState) =>
  Object.values(s.positions).filter((p) => p.side === 'long');

export const selectShortPositions = (s: PositionStoreState) =>
  Object.values(s.positions).filter((p) => p.side === 'short');

export const selectPositionsByGroup = (s: PositionStoreState): PositionGroupStats[] => {
  const all = Object.values(s.positions);
  if (s.groupBy === 'none') return [];

  const groups = new Map<string, OpenPosition[]>();
  for (const p of all) {
    let key: string;
    switch (s.groupBy) {
      case 'sector': key = p.sector; break;
      case 'type': key = p.assetType; break;
      case 'side': key = p.side; break;
      case 'tag': key = p.tags[0] ?? 'untagged'; break;
      default: key = 'all';
    }
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const totalMV = all.reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
  return Array.from(groups.entries()).map(([key, positions]) => {
    const marketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    return {
      key,
      label: key,
      positionCount: positions.length,
      marketValue,
      weight: totalMV > 0 ? (Math.abs(marketValue) / totalMV) * 100 : 0,
      unrealizedPnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
      dailyPnl: positions.reduce((sum, p) => sum + p.dailyPnl, 0),
    };
  });
};

export const selectEventsByPosition = (positionId: string) => (s: PositionStoreState) =>
  s.events.filter((e) => e.positionId === positionId);

export const selectRecentEvents = (limit = 50) => (s: PositionStoreState) =>
  s.events.slice(-limit);

export const selectSortedPositions = (s: PositionStoreState & PositionStoreActions) => {
  let all = Object.values(s.positions);
  if (s.filterSide !== 'all') all = all.filter((p) => p.side === s.filterSide);

  return all.sort((a, b) => {
    const aVal = a[s.sortField];
    const bVal = b[s.sortField];
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return s.sortDirection === 'asc' ? cmp : -cmp;
  });
};
