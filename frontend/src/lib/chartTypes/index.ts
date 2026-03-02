// ─── Renko ──────────────────────────────────────────────────────────────────
export {
  generateRenkoBricks,
  findSupportResistance as renkoSupportResistance,
  identifyTrends as renkoTrends,
  renkoSMA,
  renkoEMA,
  brickVolumeProfile,
  averageBrickVolume,
  type OHLCVBar,
  type RenkoBrick,
  type RenkoConfig,
  type RenkoSupportResistance,
  type RenkoTrend,
  type BrickSizeMode,
  type RenkoMode,
  DEFAULT_RENKO_CONFIG,
} from './renko';

// ─── Point & Figure ─────────────────────────────────────────────────────────
export {
  generatePnFColumns,
  detectPatterns,
  verticalCount,
  horizontalCount,
  computeTrendLines,
  bullishPercent,
  recentBullishPercent,
  type PnFColumn,
  type PnFConfig,
  type PnFPattern,
  type PnFPatternType,
  type PnFMark,
  type PnFTrendLine,
  DEFAULT_PNF_CONFIG,
} from './pointAndFigure';

// ─── Kagi ───────────────────────────────────────────────────────────────────
export {
  generateKagiLines,
  findShoulders,
  findWaists,
  analyzeKagiTrends,
  kagiVolumeByWeight,
  kagiVolumeByDirection,
  generateSignals as kagiSignals,
  type KagiSegment,
  type KagiConfig,
  type KagiShoulder,
  type KagiWaist,
  type KagiTrend,
  type KagiLineWeight,
  type KagiSignal,
  type ReversalMode,
  DEFAULT_KAGI_CONFIG,
} from './kagi';

// ─── Line Break ─────────────────────────────────────────────────────────────
export {
  generateLineBreakBlocks,
  detectReversals as lineBreakReversals,
  consecutiveBlocks,
  findSupportResistance as lineBreakSupportResistance,
  trendStrength as lineBreakTrendStrength,
  blockStatistics,
  type LineBreakBlock,
  type LineBreakConfig,
  type LineBreakReversal,
  type LineBreakSupportResistance,
  DEFAULT_LINEBREAK_CONFIG,
} from './lineBreak';

// ─── Heikin-Ashi ────────────────────────────────────────────────────────────
export {
  computeHeikinAshi,
  detectTrend as haDetectTrend,
  detectAllTrends as haDetectAllTrends,
  findIndecisionCandles,
  isDojiLike,
  computeSmoothedHA,
  trendStrengthSeries as haTrendStrengthSeries,
  detectColorChanges,
  haStatistics,
  type HACandle,
  type HATrendState,
  type HATrendInfo,
  type HASmoothedCandle,
  type HAColorChange,
} from './heikinAshi';

// ─── Range Bar ──────────────────────────────────────────────────────────────
export {
  generateRangeBars,
  volumeProfile as rangeBarVolumeProfile,
  averageVolumePerBar as rangeBarAverageVolume,
  timingAnalysis,
  identifyTrends as rangeBarTrends,
  activityAnalysis,
  type RangeBarCandle,
  type RangeBarConfig,
  type RangeBarTrend,
  type RangeBarTimingStats,
  type RangeSizeMode,
  DEFAULT_RANGEBAR_CONFIG,
} from './rangeBar';

// ─── Equivolume ─────────────────────────────────────────────────────────────
export {
  generateEquivolumeBoxes,
  easeOfMovement,
  findPowerBars,
  powerBarRatio,
  volumeWeightedPrice,
  volumeDirectionBias,
  cumulativeEMV,
  widthStatistics,
  type EquivolumeBox,
  type EquivolumeConfig,
  type PowerBarInfo,
  DEFAULT_EQUIVOLUME_CONFIG,
} from './equivolume';
