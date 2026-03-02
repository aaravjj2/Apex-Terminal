import type {
  Commodity, FuturesContract, FuturesCurve, BasisAnalysis, RollYield,
  ConvenienceYield, CrackSpread, CrushSpread, SparkSpread,
  SeasonalPattern, InventoryData, COTData, SupplyDemandModel,
  CommodityIndex, WeatherImpact, SpreadQuote, SpreadType,
} from './types';
import { CurveShape, SeasonalPeriod, COTCategory } from './types';

// ── Futures curve construction ────────────────────────────────────────
export function buildFuturesCurve(
  commodity: string,
  contracts: FuturesContract[],
  spotPrice: number,
): FuturesCurve {
  const sorted = [...contracts].sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  if (sorted.length < 2) {
    return { commodity, contracts: sorted, spotPrice, shape: CurveShape.FLAT, annualizedContango: 0 };
  }

  // Identify shape from front vs back
  const front = sorted[0].price;
  const back = sorted[sorted.length - 1].price;
  const daySpan = sorted[sorted.length - 1].daysToExpiry - sorted[0].daysToExpiry;

  let contangoCount = 0, backwardationCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price > sorted[i - 1].price) contangoCount++;
    else if (sorted[i].price < sorted[i - 1].price) backwardationCount++;
  }

  let shape: CurveShape;
  if (contangoCount > 0 && backwardationCount > 0) shape = CurveShape.MIXED;
  else if (contangoCount > backwardationCount) shape = CurveShape.CONTANGO;
  else if (backwardationCount > contangoCount) shape = CurveShape.BACKWARDATION;
  else shape = CurveShape.FLAT;

  const annualizedContango = daySpan > 0
    ? ((back / front) - 1) * (365 / daySpan)
    : 0;

  return { commodity, contracts: sorted, spotPrice, shape, annualizedContango };
}

// ── Roll yield calculation ────────────────────────────────────────────
export function calculateRollYield(
  frontMonth: FuturesContract,
  nextMonth: FuturesContract,
): RollYield {
  const daysInRoll = nextMonth.daysToExpiry - frontMonth.daysToExpiry;
  const rollYieldPercent = (frontMonth.price - nextMonth.price) / nextMonth.price;
  const annualizedRollYield = daysInRoll > 0
    ? rollYieldPercent * (365 / daysInRoll)
    : 0;

  return {
    commodity: frontMonth.commodity,
    frontMonth,
    nextMonth,
    rollYieldPercent,
    annualizedRollYield,
    daysInRoll,
  };
}

// ── Basis analysis ────────────────────────────────────────────────────
export function analyzeBasis(
  commodity: string,
  spotPrice: number,
  nearFuturesPrice: number,
  historicalBasis: number[],
): BasisAnalysis {
  const basis = spotPrice - nearFuturesPrice;
  const basisPercent = nearFuturesPrice !== 0 ? basis / nearFuturesPrice : 0;

  const n = historicalBasis.length;
  const mean = n > 0 ? historicalBasis.reduce((s, v) => s + v, 0) / n : 0;
  const variance = n > 1
    ? historicalBasis.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    : 0;
  const std = Math.sqrt(variance);
  const zScore = std > 0 ? (basis - mean) / std : 0;

  return { commodity, spotPrice, nearFuturesPrice, basis, basisPercent, historicalBasisMean: mean, basisZScore: zScore };
}

// ── Convenience yield estimation ──────────────────────────────────────
export function estimateConvenienceYield(
  spotPrice: number,
  futuresPrice: number,
  riskFreeRate: number,
  storageCost: number,
  timeToExpiry: number,
): ConvenienceYield {
  // F = S * exp((r + s - c) * T)  →  c = r + s - ln(F/S)/T
  const convenienceYield = timeToExpiry > 0
    ? riskFreeRate + storageCost - Math.log(futuresPrice / spotPrice) / timeToExpiry
    : 0;

  return {
    commodity: '',
    spotPrice,
    futuresPrice,
    riskFreeRate,
    storageCost,
    timeToExpiry,
    convenienceYield,
  };
}

// ── Cost of carry model ───────────────────────────────────────────────
export function costOfCarryPrice(
  spotPrice: number,
  riskFreeRate: number,
  storageCostRate: number,
  insuranceRate: number,
  convenienceYield: number,
  timeToExpiry: number,
): number {
  return spotPrice * Math.exp((riskFreeRate + storageCostRate + insuranceRate - convenienceYield) * timeToExpiry);
}

// ── Seasonality analysis ──────────────────────────────────────────────
export function analyzeSeasonality(
  commodity: string,
  dailyPrices: number[],
  tradingDaysPerYear = 252,
  yearsOfData?: number,
): SeasonalPattern {
  const dailyReturns: number[] = [];
  for (let i = 1; i < dailyPrices.length; i++) {
    dailyReturns.push((dailyPrices[i] - dailyPrices[i - 1]) / dailyPrices[i - 1]);
  }

  const months = 12;
  const daysPerMonth = Math.floor(tradingDaysPerYear / months);
  const years = yearsOfData ?? Math.floor(dailyReturns.length / tradingDaysPerYear);

  const monthlyReturns: number[][] = Array.from({ length: months }, () => []);

  for (let y = 0; y < years; y++) {
    for (let m = 0; m < months; m++) {
      const start = y * tradingDaysPerYear + m * daysPerMonth;
      const end = Math.min(start + daysPerMonth, dailyReturns.length);
      if (start >= dailyReturns.length) break;

      let periodReturn = 0;
      for (let d = start; d < end; d++) {
        periodReturn += dailyReturns[d] ?? 0;
      }
      monthlyReturns[m].push(periodReturn);
    }
  }

  const averageReturns = monthlyReturns.map(mr =>
    mr.length > 0 ? mr.reduce((s, v) => s + v, 0) / mr.length : 0,
  );
  const medianReturns = monthlyReturns.map(mr => {
    if (mr.length === 0) return 0;
    const sorted = [...mr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  });
  const winRate = monthlyReturns.map(mr =>
    mr.length > 0 ? mr.filter(r => r > 0).length / mr.length : 0,
  );

  // Seasonal index: normalized so mean = 100
  const totalAvg = averageReturns.reduce((s, v) => s + v, 0) / months;
  const seasonalIndex = averageReturns.map(r =>
    totalAvg !== 0 ? (r / totalAvg) * 100 : 100,
  );

  const currentMonth = new Date().getMonth();
  const currentPeriodReturn = averageReturns[currentMonth] ?? 0;

  return {
    commodity,
    period: SeasonalPeriod.MONTHLY,
    averageReturns,
    medianReturns,
    winRate,
    currentPeriodReturn,
    seasonalIndex,
    yearsOfData: years,
  };
}

// ── Crack spread (crude → products) ───────────────────────────────────
export function calculateCrackSpread(
  crudePrice: number,       // $/barrel
  gasolinePrice: number,    // $/gallon
  heatingOilPrice: number,  // $/gallon
): CrackSpread {
  // 1 barrel = 42 gallons
  const gasolinePerBarrel = gasolinePrice * 42;
  const heatingOilPerBarrel = heatingOilPrice * 42;

  // 3:2:1 crack: 3 barrels crude → 2 barrels gasoline + 1 barrel heating oil
  const spread321 = (2 * gasolinePerBarrel + 1 * heatingOilPerBarrel - 3 * crudePrice) / 3;
  // 2:1:1 crack
  const spread21 = (gasolinePerBarrel + heatingOilPerBarrel - 2 * crudePrice) / 2;

  return {
    crudePrice,
    gasolinePrice,
    heatingOilPrice,
    spread321,
    spread21,
    gasolineCrack: gasolinePerBarrel - crudePrice,
    heatingOilCrack: heatingOilPerBarrel - crudePrice,
    marginPerBarrel: spread321,
  };
}

// ── Crush spread (soybeans) ───────────────────────────────────────────
export function calculateCrushSpread(
  soybeanPrice: number,     // cents/bushel
  soybeanMealPrice: number, // $/short ton
  soybeanOilPrice: number,  // cents/pound
): CrushSpread {
  // 1 bushel soybeans → ~48 lbs meal + ~11 lbs oil
  // Board crush: Meal value ($/ton * tons per bushel) + Oil value - Soybean cost
  const mealValuePerBushel = soybeanMealPrice * (48 / 2000);  // 48 lbs / 2000 lbs per short ton
  const oilValuePerBushel = soybeanOilPrice * 11;              // 11 lbs oil per bushel

  const grossProcessingMargin = mealValuePerBushel + oilValuePerBushel - soybeanPrice / 100;
  const boardCrush = grossProcessingMargin;

  return {
    soybeanPrice,
    soybeanMealPrice,
    soybeanOilPrice,
    grossProcessingMargin,
    boardCrush,
  };
}

// ── Spark spread (natural gas → power) ────────────────────────────────
export function calculateSparkSpread(
  natGasPrice: number,       // $/MMBtu
  electricityPrice: number,  // $/MWh
  heatRate = 7000,           // BTU/kWh (plant efficiency)
  carbonPrice?: number,      // $/ton CO2
): SparkSpread {
  // Spark spread = Electricity price - Heat rate × Gas price / 1000
  const fuelCost = heatRate * natGasPrice / 1000;
  const sparkSpread = electricityPrice - fuelCost;

  let cleanSpark: number | undefined;
  if (carbonPrice !== undefined) {
    // Natural gas emits ~0.05 tons CO2 per MMBtu → per MWh = heatRate/1000 * 0.05
    const carbonCost = (heatRate / 1000) * 0.05 * carbonPrice;
    cleanSpark = sparkSpread - carbonCost;
  }

  return {
    natGasPrice,
    electricityPrice,
    heatRate,
    sparkSpread,
    cleanSpark,
    carbonPrice,
  };
}

// ── Calendar spread analysis ──────────────────────────────────────────
export function analyzeCalendarSpread(
  nearContract: FuturesContract,
  farContract: FuturesContract,
  historicalSpreads: number[],
): SpreadQuote & { zScore: number; percentile: number } {
  const spreadValue = nearContract.price - farContract.price;

  const n = historicalSpreads.length;
  const mean = n > 0 ? historicalSpreads.reduce((s, v) => s + v, 0) / n : 0;
  const std = n > 1
    ? Math.sqrt(historicalSpreads.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1))
    : 0;
  const zScore = std > 0 ? (spreadValue - mean) / std : 0;

  const sorted = [...historicalSpreads].sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= spreadValue).length;
  const percentile = n > 0 ? rank / n : 0.5;

  return {
    type: 'CALENDAR' as SpreadType,
    leg1Symbol: nearContract.symbol,
    leg2Symbol: farContract.symbol,
    leg1Price: nearContract.price,
    leg2Price: farContract.price,
    spreadValue,
    ratio: farContract.price > 0 ? nearContract.price / farContract.price : 0,
    zScore,
    percentile,
  };
}

// ── Inter-commodity spread ────────────────────────────────────────────
export function analyzeInterCommoditySpread(
  commodity1: FuturesContract,
  commodity2: FuturesContract,
  ratio: number,
  historicalSpreads: number[],
): SpreadQuote & { zScore: number } {
  const spreadValue = commodity1.price - ratio * commodity2.price;

  const n = historicalSpreads.length;
  const mean = n > 0 ? historicalSpreads.reduce((s, v) => s + v, 0) / n : 0;
  const std = n > 1
    ? Math.sqrt(historicalSpreads.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1))
    : 0;

  return {
    type: 'INTER_COMMODITY' as SpreadType,
    leg1Symbol: commodity1.symbol,
    leg2Symbol: commodity2.symbol,
    leg1Price: commodity1.price,
    leg2Price: commodity2.price,
    spreadValue,
    ratio,
    zScore: std > 0 ? (spreadValue - mean) / std : 0,
  };
}

// ── Inventory tracking & analysis ─────────────────────────────────────
export function analyzeInventory(
  commodity: string,
  currentLevel: number,
  previousLevel: number,
  historicalLevels: number[],
  dailyConsumption: number,
  totalCapacity: number,
): InventoryData {
  const n = historicalLevels.length;
  const weeklyChange = currentLevel - previousLevel;

  // 5-year average and range (assume ~260 weekly readings for 5 years)
  const fiveYearSlice = historicalLevels.slice(-260);
  const fiveYearAverage = fiveYearSlice.length > 0
    ? fiveYearSlice.reduce((s, v) => s + v, 0) / fiveYearSlice.length
    : currentLevel;
  const fiveYearMin = fiveYearSlice.length > 0 ? Math.min(...fiveYearSlice) : currentLevel;
  const fiveYearMax = fiveYearSlice.length > 0 ? Math.max(...fiveYearSlice) : currentLevel;

  const daysOfSupply = dailyConsumption > 0 ? currentLevel / dailyConsumption : Infinity;
  const percentOfCapacity = totalCapacity > 0 ? currentLevel / totalCapacity : 0;

  return {
    commodity,
    currentLevel,
    previousLevel,
    weeklyChange,
    fiveYearAverage,
    fiveYearRange: [fiveYearMin, fiveYearMax],
    daysOfSupply,
    percentOfCapacity,
  };
}

// ── Supply/Demand linear model ────────────────────────────────────────
export function modelSupplyDemand(
  commodity: string,
  prices: number[],
  supplyQuantities: number[],
  demandQuantities: number[],
): SupplyDemandModel {
  const n = Math.min(prices.length, supplyQuantities.length, demandQuantities.length);
  if (n < 2) {
    return {
      commodity, supply: 0, demand: 0, surplus: 0,
      priceElasticitySupply: 0, priceElasticityDemand: 0,
      equilibriumPrice: 0, currentPrice: prices[n - 1] ?? 0,
    };
  }

  // OLS: q = a + b*p for both supply and demand
  function ols(p: number[], q: number[]): { a: number; b: number } {
    const len = Math.min(p.length, q.length);
    let sumP = 0, sumQ = 0, sumPQ = 0, sumPP = 0;
    for (let i = 0; i < len; i++) {
      sumP += p[i]; sumQ += q[i]; sumPQ += p[i] * q[i]; sumPP += p[i] * p[i];
    }
    const denom = len * sumPP - sumP * sumP;
    const b = denom !== 0 ? (len * sumPQ - sumP * sumQ) / denom : 0;
    const a = (sumQ - b * sumP) / len;
    return { a, b };
  }

  const supply = ols(prices.slice(0, n), supplyQuantities.slice(0, n));
  const demand = ols(prices.slice(0, n), demandQuantities.slice(0, n));

  // Equilibrium: supply.a + supply.b * P = demand.a + demand.b * P
  const equilibriumPrice = (supply.b - demand.b) !== 0
    ? (demand.a - supply.a) / (supply.b - demand.b)
    : prices[n - 1];

  const currentPrice = prices[n - 1];
  const currentSupply = supply.a + supply.b * currentPrice;
  const currentDemand = demand.a + demand.b * currentPrice;

  // Point elasticity at current price
  const elasticitySupply = currentSupply !== 0 ? (supply.b * currentPrice) / currentSupply : 0;
  const elasticityDemand = currentDemand !== 0 ? (demand.b * currentPrice) / currentDemand : 0;

  return {
    commodity,
    supply: currentSupply,
    demand: currentDemand,
    surplus: currentSupply - currentDemand,
    priceElasticitySupply: elasticitySupply,
    priceElasticityDemand: elasticityDemand,
    equilibriumPrice,
    currentPrice,
  };
}

// ── COT analysis ──────────────────────────────────────────────────────
export function analyzeCOT(
  commodity: string,
  reports: COTData[],
): {
  currentNetSpeculative: number;
  historicalPercentile: number;
  weeklyChange: number;
  commercialHedgingPressure: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
} {
  if (reports.length === 0) {
    return { currentNetSpeculative: 0, historicalPercentile: 0.5, weeklyChange: 0, commercialHedgingPressure: 0, signal: 'NEUTRAL' };
  }

  const latest = reports[reports.length - 1];
  const currentNet = latest.netSpeculative;

  const historicalNets = reports.map(r => r.netSpeculative);
  const sorted = [...historicalNets].sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= currentNet).length;
  const percentile = sorted.length > 0 ? rank / sorted.length : 0.5;

  const weeklyChange = reports.length > 1
    ? currentNet - reports[reports.length - 2].netSpeculative
    : 0;

  const commercials = latest.positions[COTCategory.COMMERCIAL];
  const commercialHedgingPressure = commercials
    ? (commercials.long - commercials.short) / (commercials.long + commercials.short || 1)
    : 0;

  let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (percentile > 0.8) signal = 'BEARISH';      // crowded long → contrarian bearish
  else if (percentile < 0.2) signal = 'BULLISH';  // crowded short → contrarian bullish
  else signal = 'NEUTRAL';

  return { currentNetSpeculative: currentNet, historicalPercentile: percentile, weeklyChange, commercialHedgingPressure, signal };
}

// ── Commodity index construction (GSCI-style) ─────────────────────────
export function constructCommodityIndex(
  name: string,
  components: { symbol: string; weight: number; price: number; previousPrice: number; rollYield: number }[],
  riskFreeRate: number,
  baseValue = 100,
): CommodityIndex {
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const normalizedComponents = components.map(c => ({
    symbol: c.symbol,
    weight: c.weight / totalWeight,
    price: c.price,
  }));

  let excessReturn = 0;
  let rollYieldComponent = 0;
  for (const c of components) {
    const w = c.weight / totalWeight;
    const spotReturn = c.previousPrice !== 0 ? (c.price - c.previousPrice) / c.previousPrice : 0;
    excessReturn += w * spotReturn;
    rollYieldComponent += w * c.rollYield;
  }

  const collateralReturn = riskFreeRate / 252; // daily T-bill return
  const totalReturn = excessReturn + collateralReturn;
  const value = baseValue * (1 + totalReturn);

  return {
    name,
    components: normalizedComponents,
    value,
    baseValue,
    totalReturn,
    excessReturn,
    collateralReturn,
    rollYieldComponent,
  };
}

// ── Weather impact analysis (degree day model) ───────────────────────
export function analyzeWeatherImpact(
  commodity: string,
  region: string,
  dailyTemps: number[],     // °F
  normalTemps: number[],    // °F historical normals
  priceElasticity: number,  // price sensitivity per degree-day deviation
): WeatherImpact {
  const n = Math.min(dailyTemps.length, normalTemps.length);
  let hdd = 0, cdd = 0, normalHDD = 0, normalCDD = 0;

  for (let i = 0; i < n; i++) {
    hdd += Math.max(0, 65 - dailyTemps[i]);
    cdd += Math.max(0, dailyTemps[i] - 65);
    normalHDD += Math.max(0, 65 - normalTemps[i]);
    normalCDD += Math.max(0, normalTemps[i] - 65);
  }

  const deviationHDD = hdd - normalHDD;
  const deviationCDD = cdd - normalCDD;
  const totalDeviation = Math.abs(deviationHDD) + Math.abs(deviationCDD);
  const estimatedPriceImpact = totalDeviation * priceElasticity;

  return {
    commodity,
    region,
    heatingDegreeDays: hdd,
    coolingDegreeDays: cdd,
    normalHDD,
    normalCDD,
    deviationHDD,
    deviationCDD,
    estimatedPriceImpact,
  };
}

// ── Storage cost modeling ─────────────────────────────────────────────
export function modelStorageCost(
  spotPrice: number,
  monthlyStorageCost: number,
  insuranceRate: number,
  financingRate: number,
  months: number,
): { totalCost: number; breakEvenFuturesPrice: number; costPerUnit: number; monthlyBreakdown: number[] } {
  const monthlyBreakdown: number[] = [];
  let totalCost = 0;

  for (let m = 1; m <= months; m++) {
    const storage = monthlyStorageCost;
    const insurance = spotPrice * insuranceRate / 12;
    const financing = spotPrice * financingRate / 12;
    const monthlyCost = storage + insurance + financing;
    monthlyBreakdown.push(monthlyCost);
    totalCost += monthlyCost;
  }

  return {
    totalCost,
    breakEvenFuturesPrice: spotPrice + totalCost,
    costPerUnit: totalCost / months,
    monthlyBreakdown,
  };
}
