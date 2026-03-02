import type { LiquidityPool, AMMType, DeFiProtocol } from './types';

// ── Constant Product AMM (Uniswap v2 style) ──────────────────────────
export function constantProductPrice(
  reserve0: number,
  reserve1: number,
  amountIn: number,
  fee = 0.003,
  zeroToOne = true,
): { amountOut: number; priceImpact: number; effectivePrice: number; fee: number } {
  const amountInAfterFee = amountIn * (1 - fee);
  const feeAmount = amountIn * fee;

  let amountOut: number;
  if (zeroToOne) {
    // x * y = k  →  (x + dx)(y - dy) = k  →  dy = y * dx / (x + dx)
    amountOut = (reserve1 * amountInAfterFee) / (reserve0 + amountInAfterFee);
  } else {
    amountOut = (reserve0 * amountInAfterFee) / (reserve1 + amountInAfterFee);
  }

  const spotPrice = zeroToOne ? reserve1 / reserve0 : reserve0 / reserve1;
  const effectivePrice = amountIn > 0 ? amountOut / amountIn : spotPrice;
  const priceImpact = spotPrice > 0 ? Math.abs(effectivePrice - spotPrice) / spotPrice : 0;

  return { amountOut, priceImpact, effectivePrice, fee: feeAmount };
}

// ── Constant Sum AMM ──────────────────────────────────────────────────
export function constantSumPrice(
  reserve0: number,
  reserve1: number,
  amountIn: number,
  fee = 0.003,
  zeroToOne = true,
): { amountOut: number; priceImpact: number; depleted: boolean } {
  const amountInAfterFee = amountIn * (1 - fee);
  const targetReserve = zeroToOne ? reserve1 : reserve0;

  // Constant sum: x + y = k → 1:1 exchange until depleted
  const amountOut = Math.min(amountInAfterFee, targetReserve);
  const depleted = amountInAfterFee >= targetReserve;

  return { amountOut, priceImpact: 0, depleted };
}

// ── Curve StableSwap invariant ────────────────────────────────────────
// Solves: An^n * sum(x_i) + D = A * D * n^n + D^(n+1) / (n^n * prod(x_i))
function stableSwapGetD(
  reserves: number[],
  amplification: number,
): number {
  const n = reserves.length;
  const sum = reserves.reduce((s, x) => s + x, 0);
  if (sum === 0) return 0;

  let D = sum;
  const Ann = amplification * n;

  for (let iter = 0; iter < 256; iter++) {
    let D_P = D;
    for (const x of reserves) {
      D_P = D_P * D / (n * (x > 0 ? x : 1));
    }
    const prevD = D;
    D = (Ann * sum + D_P * n) * D / ((Ann - 1) * D + (n + 1) * D_P);
    if (Math.abs(D - prevD) <= 1) break;
  }

  return D;
}

function stableSwapGetY(
  reserves: number[],
  i: number,
  j: number,
  newReserveI: number,
  amplification: number,
): number {
  const n = reserves.length;
  const D = stableSwapGetD(reserves, amplification);
  const Ann = amplification * n;

  let c = D;
  let S = 0;

  for (let k = 0; k < n; k++) {
    const x = k === i ? newReserveI : reserves[k];
    if (k !== j) {
      S += x;
      c = c * D / (n * x);
    }
  }
  c = c * D / (Ann * n);
  const b = S + D / Ann;

  // Newton's method for y
  let y = D;
  for (let iter = 0; iter < 256; iter++) {
    const yPrev = y;
    y = (y * y + c) / (2 * y + b - D);
    if (Math.abs(y - yPrev) <= 1) break;
  }

  return y;
}

export function stableSwapPrice(
  reserves: number[],
  tokenIn: number,
  tokenOut: number,
  amountIn: number,
  amplification: number,
  fee = 0.0004,
): { amountOut: number; priceImpact: number; effectivePrice: number } {
  const amountInAfterFee = amountIn * (1 - fee);
  const newReserveIn = reserves[tokenIn] + amountInAfterFee;
  const newReserveOut = stableSwapGetY(reserves, tokenIn, tokenOut, newReserveIn, amplification);
  const amountOut = reserves[tokenOut] - newReserveOut;

  const spotPrice = reserves[tokenOut] > 0 ? reserves[tokenIn] / reserves[tokenOut] : 1;
  const effectivePrice = amountIn > 0 ? amountOut / amountIn : 1;
  const priceImpact = Math.abs(effectivePrice - 1 / spotPrice) * spotPrice;

  return { amountOut: Math.max(amountOut, 0), priceImpact, effectivePrice };
}

// ── Impermanent loss for various AMM types ────────────────────────────
export function impermanentLossConstantProduct(
  priceRatio: number,
): number {
  // IL = 2√r / (1+r) - 1
  if (priceRatio <= 0) return -1;
  return 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
}

export function impermanentLossConcentrated(
  priceRatio: number,
  lowerTick: number,
  upperTick: number,
): number {
  // Concentrated liquidity IL amplified by range
  const sqrtPa = Math.sqrt(lowerTick);
  const sqrtPb = Math.sqrt(upperTick);
  const sqrtP = Math.sqrt(priceRatio);

  if (sqrtP < sqrtPa || sqrtP > sqrtPb) return -1; // out of range

  const L = 1 / (sqrtP - sqrtPa);
  const x = L * (sqrtPb - sqrtP) / (sqrtP * sqrtPb);
  const y = L * (sqrtP - sqrtPa);

  const holdValue = priceRatio * 0.5 + 0.5; // assuming 50/50 start
  const lpValue = x * priceRatio + y;

  return holdValue > 0 ? lpValue / holdValue - 1 : 0;
}

export function impermanentLossStableSwap(
  priceRatio: number,
  amplification: number,
): number {
  // Approximate: StableSwap has much lower IL than constant product
  const cpIL = impermanentLossConstantProduct(priceRatio);
  const dampingFactor = 1 / (1 + amplification / 100);
  return cpIL * dampingFactor;
}

// ── Yield farming comparison ──────────────────────────────────────────
export interface YieldFarmAnalysis {
  protocol: string;
  pool: string;
  baseAPY: number;
  rewardAPY: number;
  totalAPY: number;
  impermanentLossEstimate: number;
  netAPY: number;
  riskScore: number;
  capitalEfficiency: number;
}

export function compareYieldFarms(
  farms: {
    protocol: string;
    pool: string;
    baseAPR: number;
    rewardAPR: number;
    tvl: number;
    volume24h: number;
    volatility: number;   // annual vol of the pool tokens
    ammType: AMMType;
    compoundingFreq: number;
  }[],
): YieldFarmAnalysis[] {
  return farms.map(f => {
    const baseAPY = Math.pow(1 + f.baseAPR / f.compoundingFreq, f.compoundingFreq) - 1;
    const rewardAPY = Math.pow(1 + f.rewardAPR / f.compoundingFreq, f.compoundingFreq) - 1;
    const totalAPY = baseAPY + rewardAPY;

    // Estimate IL from volatility (simplified: price moves ~1σ)
    const expectedPriceChange = f.volatility;
    const priceRatio = 1 + expectedPriceChange;
    let ilEstimate: number;
    if (f.ammType === 'STABLE_SWAP') {
      ilEstimate = Math.abs(impermanentLossStableSwap(priceRatio, 100));
    } else {
      ilEstimate = Math.abs(impermanentLossConstantProduct(priceRatio));
    }

    const netAPY = totalAPY - ilEstimate;
    const capitalEfficiency = f.tvl > 0 ? f.volume24h * 365 / f.tvl : 0;

    // Risk score: 1 (low) to 10 (high)
    let riskScore = 3; // base
    if (f.tvl < 1_000_000) riskScore += 2;
    if (f.volatility > 0.8) riskScore += 2;
    if (totalAPY > 1) riskScore += 1; // suspiciously high yields
    if (f.ammType === 'STABLE_SWAP') riskScore -= 1;
    riskScore = Math.max(1, Math.min(10, riskScore));

    return {
      protocol: f.protocol,
      pool: f.pool,
      baseAPY,
      rewardAPY,
      totalAPY,
      impermanentLossEstimate: ilEstimate,
      netAPY,
      riskScore,
      capitalEfficiency,
    };
  }).sort((a, b) => b.netAPY - a.netAPY);
}

// ── Liquidity pool analytics ──────────────────────────────────────────
export function analyzePoolMetrics(
  pool: LiquidityPool,
  priceHistory: { price0: number; price1: number }[],
): {
  feeAPR: number;
  volumeToTVL: number;
  avgTradeSize: number;
  priceCorrelation: number;
  ilRealized: number;
} {
  const feeAPR = pool.totalValueLocked > 0
    ? (pool.fees24h * 365) / pool.totalValueLocked
    : 0;

  const volumeToTVL = pool.totalValueLocked > 0
    ? pool.volume24h / pool.totalValueLocked
    : 0;

  // Avg trade size estimate
  const estimatedTrades = pool.fees24h / (pool.volume24h * 0.003 || 1);
  const avgTradeSize = estimatedTrades > 0 ? pool.volume24h / estimatedTrades : 0;

  // Price correlation from history
  const n = priceHistory.length;
  if (n < 2) return { feeAPR, volumeToTVL, avgTradeSize, priceCorrelation: 0, ilRealized: 0 };

  const r0 = priceHistory.map((p, i) => i > 0 ? (p.price0 - priceHistory[i - 1].price0) / priceHistory[i - 1].price0 : 0).slice(1);
  const r1 = priceHistory.map((p, i) => i > 0 ? (p.price1 - priceHistory[i - 1].price1) / priceHistory[i - 1].price1 : 0).slice(1);

  const m0 = r0.reduce((s, v) => s + v, 0) / r0.length;
  const m1 = r1.reduce((s, v) => s + v, 0) / r1.length;
  let cov = 0, v0 = 0, v1 = 0;
  for (let i = 0; i < r0.length; i++) {
    const d0 = r0[i] - m0, d1 = r1[i] - m1;
    cov += d0 * d1; v0 += d0 * d0; v1 += d1 * d1;
  }
  const denom = Math.sqrt(v0 * v1);
  const priceCorrelation = denom > 0 ? cov / denom : 0;

  // Realized IL
  const startRatio = priceHistory[0].price1 > 0 ? priceHistory[0].price0 / priceHistory[0].price1 : 1;
  const endRatio = priceHistory[n - 1].price1 > 0 ? priceHistory[n - 1].price0 / priceHistory[n - 1].price1 : 1;
  const priceRatioChange = startRatio > 0 ? endRatio / startRatio : 1;
  const ilRealized = impermanentLossConstantProduct(priceRatioChange);

  return { feeAPR, volumeToTVL, avgTradeSize, priceCorrelation, ilRealized };
}

// ── Protocol revenue analysis ─────────────────────────────────────────
export function analyzeProtocolRevenue(
  protocols: DeFiProtocol[],
): {
  totalRevenue24h: number;
  revenuePerTVL: Record<string, number>;
  bestRevenueEfficiency: string;
  priceToSales: Record<string, number>;
} {
  const totalRevenue24h = protocols.reduce((s, p) => s + p.revenue24h, 0);
  const revenuePerTVL: Record<string, number> = {};
  const priceToSales: Record<string, number> = {};

  for (const p of protocols) {
    revenuePerTVL[p.name] = p.tvl > 0 ? (p.revenue24h * 365) / p.tvl : 0;
    if (p.token && p.tokenPrice && p.revenue24h > 0) {
      const annualizedRevenue = p.revenue24h * 365;
      // P/S using fully-diluted mcap proxy
      priceToSales[p.name] = p.tokenPrice > 0 ? (p.tvl * 0.1) / annualizedRevenue : 0;
    }
  }

  const bestRevenueEfficiency = Object.entries(revenuePerTVL)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';

  return { totalRevenue24h, revenuePerTVL, bestRevenueEfficiency, priceToSales };
}

// ── Token emission schedule ───────────────────────────────────────────
export function modelTokenEmissions(
  totalSupply: number,
  currentCirculating: number,
  monthlyEmission: number,
  halvingIntervalMonths: number,
  projectionMonths: number,
): { months: number[]; circulating: number[]; inflationRate: number[]; fullyDilutedDate: number } {
  const months: number[] = [];
  const circulating: number[] = [];
  const inflationRate: number[] = [];

  let circ = currentCirculating;
  let emission = monthlyEmission;
  let monthsSinceHalving = 0;

  for (let m = 0; m < projectionMonths; m++) {
    months.push(m);
    circulating.push(Math.min(circ, totalSupply));
    inflationRate.push(circ > 0 ? (emission * 12) / circ : 0);

    circ += emission;
    monthsSinceHalving++;

    if (halvingIntervalMonths > 0 && monthsSinceHalving >= halvingIntervalMonths) {
      emission /= 2;
      monthsSinceHalving = 0;
    }

    if (circ >= totalSupply) {
      circ = totalSupply;
      emission = 0;
    }
  }

  // Estimate fully diluted date
  let fdMonths = 0;
  let fdCirc = currentCirculating;
  let fdEmission = monthlyEmission;
  let fdHalving = 0;
  while (fdCirc < totalSupply && fdMonths < 1200) {
    fdCirc += fdEmission;
    fdHalving++;
    fdMonths++;
    if (halvingIntervalMonths > 0 && fdHalving >= halvingIntervalMonths) {
      fdEmission /= 2;
      fdHalving = 0;
    }
  }

  return { months, circulating, inflationRate, fullyDilutedDate: fdMonths };
}

// ── Flash loan arbitrage detection ────────────────────────────────────
export interface FlashLoanOpportunity {
  path: string[];
  expectedProfit: number;
  gasEstimate: number;
  netProfit: number;
  profitPercent: number;
}

export function detectFlashLoanArbitrage(
  pools: { pair: string; token0: string; token1: string; reserve0: number; reserve1: number; fee: number }[],
  startToken: string,
  amount: number,
  gasCostETH: number,
  ethPrice: number,
): FlashLoanOpportunity[] {
  const opportunities: FlashLoanOpportunity[] = [];
  const gasCostUSD = gasCostETH * ethPrice;

  // Find 2-hop and 3-hop arbitrage paths
  const poolsByToken: Record<string, typeof pools> = {};
  for (const pool of pools) {
    if (!poolsByToken[pool.token0]) poolsByToken[pool.token0] = [];
    if (!poolsByToken[pool.token1]) poolsByToken[pool.token1] = [];
    poolsByToken[pool.token0].push(pool);
    poolsByToken[pool.token1].push(pool);
  }

  function getAmountOut(pool: typeof pools[0], tokenIn: string, amountIn: number): number {
    const isZeroToOne = tokenIn === pool.token0;
    const rIn = isZeroToOne ? pool.reserve0 : pool.reserve1;
    const rOut = isZeroToOne ? pool.reserve1 : pool.reserve0;
    const amtAfterFee = amountIn * (1 - pool.fee);
    return (rOut * amtAfterFee) / (rIn + amtAfterFee);
  }

  // 2-hop paths: startToken → token1 → startToken
  const startPools = poolsByToken[startToken] ?? [];
  for (const pool1 of startPools) {
    const midToken = pool1.token0 === startToken ? pool1.token1 : pool1.token0;
    const amt1 = getAmountOut(pool1, startToken, amount);

    const midPools = poolsByToken[midToken] ?? [];
    for (const pool2 of midPools) {
      if (pool2 === pool1) continue;
      const endToken = pool2.token0 === midToken ? pool2.token1 : pool2.token0;
      if (endToken !== startToken) continue;

      const amt2 = getAmountOut(pool2, midToken, amt1);
      const profit = amt2 - amount;
      const gasEstimate = gasCostUSD * 2; // 2 swaps
      const netProfit = profit - gasEstimate;

      if (netProfit > 0) {
        opportunities.push({
          path: [startToken, midToken, startToken],
          expectedProfit: profit,
          gasEstimate,
          netProfit,
          profitPercent: (netProfit / amount) * 100,
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}

// ── MEV estimation ────────────────────────────────────────────────────
export function estimateMEV(
  pendingTxs: { amountIn: number; pool: string; expectedOut: number; maxSlippage: number }[],
  poolReserves: Record<string, { reserve0: number; reserve1: number; fee: number }>,
): { totalMEV: number; sandwichOpportunities: number; backrunOpportunities: number } {
  let totalMEV = 0;
  let sandwichOpportunities = 0;
  let backrunOpportunities = 0;

  for (const tx of pendingTxs) {
    const pool = poolReserves[tx.pool];
    if (!pool) continue;

    // Sandwich MEV estimate: front-run pushes price, victim gets worse rate, back-run captures diff
    const priceImpact = tx.amountIn / (pool.reserve0 + tx.amountIn);
    const slippageRoom = tx.maxSlippage - priceImpact;

    if (slippageRoom > 0.001) {
      // MEV = extractable from the slippage tolerance
      const mevAmount = tx.expectedOut * slippageRoom * 0.5; // conservative estimate
      totalMEV += mevAmount;
      sandwichOpportunities++;
    }

    // Backrun: if large trade moves price, arb back
    if (priceImpact > 0.005) {
      const arbProfit = pool.reserve1 * priceImpact * 0.3;
      totalMEV += arbProfit;
      backrunOpportunities++;
    }
  }

  return { totalMEV, sandwichOpportunities, backrunOpportunities };
}

// ── Cross-chain bridge analytics ──────────────────────────────────────
export interface BridgeRoute {
  sourceChain: string;
  destChain: string;
  protocol: string;
  fee: number;
  estimatedTime: number;   // minutes
  liquidity: number;
  maxTransfer: number;
}

export function findOptimalBridgeRoute(
  routes: BridgeRoute[],
  amount: number,
  prioritize: 'FEE' | 'SPEED' | 'LIQUIDITY' = 'FEE',
): BridgeRoute[] {
  const viable = routes.filter(r => amount <= r.maxTransfer && r.liquidity >= amount);

  switch (prioritize) {
    case 'FEE':
      return viable.sort((a, b) => a.fee - b.fee);
    case 'SPEED':
      return viable.sort((a, b) => a.estimatedTime - b.estimatedTime);
    case 'LIQUIDITY':
      return viable.sort((a, b) => b.liquidity - a.liquidity);
    default:
      return viable;
  }
}

// ── Lending protocol analytics ────────────────────────────────────────
export interface LendingMetrics {
  protocol: string;
  asset: string;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  supplyAPY: number;
  borrowAPY: number;
  liquidationThreshold: number;
  collateralFactor: number;
  reserveFactor: number;
}

export function calculateLendingRates(
  totalSupply: number,
  totalBorrow: number,
  baseRate: number,
  slope1: number,
  slope2: number,
  optimalUtilization: number,
  reserveFactor: number,
): { utilization: number; borrowAPY: number; supplyAPY: number } {
  const utilization = totalSupply > 0 ? totalBorrow / totalSupply : 0;

  let borrowAPY: number;
  if (utilization <= optimalUtilization) {
    borrowAPY = baseRate + (utilization / optimalUtilization) * slope1;
  } else {
    const excessUtilization = (utilization - optimalUtilization) / (1 - optimalUtilization);
    borrowAPY = baseRate + slope1 + excessUtilization * slope2;
  }

  // Supply APY = borrow APY × utilization × (1 - reserve factor)
  const supplyAPY = borrowAPY * utilization * (1 - reserveFactor);

  return { utilization, borrowAPY, supplyAPY };
}

// ── Collateralization ratio monitoring ────────────────────────────────
export interface CollateralHealth {
  totalCollateralUSD: number;
  totalDebtUSD: number;
  healthFactor: number;
  currentLTV: number;
  maxLTV: number;
  liquidationPrice: number;
  safetyMargin: number;
  atRisk: boolean;
}

export function monitorCollateralization(
  collaterals: { asset: string; amount: number; priceUSD: number; liquidationThreshold: number; ltv: number }[],
  debts: { asset: string; amount: number; priceUSD: number }[],
): CollateralHealth {
  let totalCollateralUSD = 0;
  let weightedThreshold = 0;
  let weightedLTV = 0;

  for (const c of collaterals) {
    const valueUSD = c.amount * c.priceUSD;
    totalCollateralUSD += valueUSD;
    weightedThreshold += c.liquidationThreshold * valueUSD;
    weightedLTV += c.ltv * valueUSD;
  }

  if (totalCollateralUSD > 0) {
    weightedThreshold /= totalCollateralUSD;
    weightedLTV /= totalCollateralUSD;
  }

  const totalDebtUSD = debts.reduce((s, d) => s + d.amount * d.priceUSD, 0);
  const healthFactor = totalDebtUSD > 0
    ? (totalCollateralUSD * weightedThreshold) / totalDebtUSD
    : Infinity;

  const currentLTV = totalCollateralUSD > 0 ? totalDebtUSD / totalCollateralUSD : 0;

  // Liquidation price: price at which health factor = 1
  // Simplified for single-collateral scenario
  const primaryCollateral = collaterals[0];
  const liquidationPrice = primaryCollateral && primaryCollateral.amount > 0 && weightedThreshold > 0
    ? totalDebtUSD / (primaryCollateral.amount * weightedThreshold)
    : 0;

  const safetyMargin = healthFactor > 0 ? 1 - 1 / healthFactor : 0;

  return {
    totalCollateralUSD,
    totalDebtUSD,
    healthFactor,
    currentLTV,
    maxLTV: weightedLTV,
    liquidationPrice,
    safetyMargin,
    atRisk: healthFactor < 1.5,
  };
}
