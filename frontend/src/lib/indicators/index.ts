// ─── Moving Averages ────────────────────────────────────────────────────────
export {
  sma, ema, wma, dema, tema, hullMA, vwma, kama, alma, frama,
  t3, zeroLagEMA, mcginleyDynamic, triangularMA, rma, smma, lsma,
  vidya, jma, swma, applyMA,
  type MAType, type MAOptions,
} from './movingAverages';

// ─── Momentum ───────────────────────────────────────────────────────────────
export {
  rsi, macd, stochastic, stochasticRSI, cci, williamsR,
  roc, momentum, ultimateOscillator, tsi, cmo, ppo,
  aroonOscillator, coppockCurve, dpo, kst, elderForceIndex,
  balanceOfPower, awesomeOscillator, trix, fisherTransform,
  connorsRSI, choppinessIndex, relativeVigorIndex,
  type OHLCVCandle, type MACDResult, type StochasticResult,
  type StochRSIResult, type TSIResult, type KSTResult,
} from './momentum';

// ─── Volatility ─────────────────────────────────────────────────────────────
export {
  trueRange, atr, bollingerBands, keltnerChannel, donchianChannel,
  historicalVolatility, chaikinVolatility, standardDeviation,
  ulcerIndex, choppinessIndex as choppinessIndexVol, massIndex,
  volatilityStop, vixStyleCalculation, garch11,
  realizedVolatilityCloseToClose, realizedVolatilityParkinson,
  realizedVolatilityGarmanKlass, realizedVolatilityRogersSatchell,
  realizedVolatilityYangZhang, atrPercent, natr,
  bollingerBandWidth, bollingerPercentB, averageDayRange,
  relativeVolatilityIndex, intradayIntensity,
  type BollingerBandsResult, type KeltnerChannelResult,
  type DonchianChannelResult,
} from './volatility';

// ─── Volume ─────────────────────────────────────────────────────────────────
export {
  obv, accumulationDistribution, cmf, mfi, vwap, volumeProfile,
  volumeOscillator, pvt, nvi, pvi, emv, klingerVolumeOscillator,
  volumeRateOfChange, volumeWeightedRSI, adosc, forceIndex,
  volumeSMA, volumeEMA, relativeVolume, anchoredVWAP, twiggsMoneyFlow,
  type VWAPResult, type VolumeProfileLevel, type VolumeProfileResult,
  type KlingerResult,
} from './volume';

// ─── Trend ──────────────────────────────────────────────────────────────────
export {
  adx, aroon, parabolicSAR, supertrend, ichimoku, zigzag,
  standardPivots, fibonacciPivots, woodiePivots, camarillaPivots,
  demarkPivots, vortexIndicator, ttmSqueeze, linearRegressionChannel,
  darvasBox, crossover, crossunder, trendStrength,
  type ADXResult, type AroonResult, type SupertrendResult,
  type IchimokuResult, type PivotPointsResult, type CamarillaPivotResult,
  type DeMarkPivotResult, type VortexResult, type TTMSqueezeResult,
  type LinearRegressionChannelResult, type DarvasBoxResult,
  type ZigZagPoint,
} from './trend';

// ─── Candlestick Patterns ───────────────────────────────────────────────────
export {
  hammer, invertedHammer, hangingMan, shootingStar,
  doji, longLeggedDoji, dragonflyDoji, gravestoneDoji,
  spinningTop, marubozu,
  bullishEngulfing, bearishEngulfing, piercingLine, darkCloudCover,
  bullishHarami, bearishHarami, tweezerTops, tweezerBottoms,
  bullishKicker, bearishKicker,
  morningStar, eveningStar, threeWhiteSoldiers, threeBlackCrows,
  risingThreeMethods, fallingThreeMethods,
  bullishAbandonedBaby, bearishAbandonedBaby,
  threeInsideUp, threeInsideDown, threeOutsideUp, threeOutsideDown,
  scanAllPatterns, scanPatternsAtIndex, filterPatterns,
  allPatternDetectors,
  type PatternMatch, type PatternDirection, type PatternReliability,
  type PatternDetector,
} from './patterns';
