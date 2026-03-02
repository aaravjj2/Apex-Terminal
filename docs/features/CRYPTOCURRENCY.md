# Cryptocurrency Analytics & DeFi

Comprehensive crypto market analytics with on-chain metrics, DeFi protocol analysis, yield farming tracking, liquidity pool monitoring, NFT analytics, whale tracking, and exchange flow analysis.

## Table of Contents

- [Overview](#overview)
- [On-Chain Metrics](#on-chain-metrics)
- [DeFi Protocol Analysis](#defi-protocol-analysis)
- [Yield Farming Analytics](#yield-farming-analytics)
- [Liquidity Pool Tracking](#liquidity-pool-tracking)
- [NFT Analytics](#nft-analytics)
- [Whale Tracking](#whale-tracking)
- [Exchange Flows](#exchange-flows)
- [Staking Yields](#staking-yields)

## Overview

The crypto module (`lib/assetClasses/crypto/`) delivers institutional-quality analytics for digital asset markets. It bridges on-chain data, DeFi protocol metrics, and traditional technical analysis within the Apex Terminal framework.

```typescript
import { CryptoAnalyzer } from '@/lib/assetClasses/crypto/analytics';
import { DeFiTracker } from '@/lib/assetClasses/crypto/defi';
import type { CryptoStrategy } from '@/lib/assetClasses/crypto/types';

const analyzer = new CryptoAnalyzer({ chains: ['ethereum', 'solana', 'arbitrum'] });
```

## On-Chain Metrics

Real-time blockchain analytics aggregated across major networks:

```typescript
interface OnChainMetrics {
  activeAddresses: number;
  transactionCount: number;
  avgTransactionFee: number;
  hashRate: number;
  networkValue: number;
  nvtRatio: number;          // Network Value to Transactions
  mvrvRatio: number;         // Market Value to Realized Value
  soprRatio: number;         // Spent Output Profit Ratio
  realizedCap: number;
}

const metrics = await analyzer.getOnChainMetrics('BTC', { period: '24h' });
// NVT > 95th percentile historically signals overvaluation
```

The MVRV Z-Score module flags market cycle tops (Z > 7) and bottoms (Z < 0.1) with 10-year backtested accuracy.

## DeFi Protocol Analysis

Automated analysis of decentralized finance protocols across lending, DEX, and derivatives platforms:

```typescript
const protocolAnalysis = await analyzer.analyzeDeFiProtocol('aave-v3', {
  chain: 'ethereum',
  metrics: ['tvl', 'utilization', 'revenue', 'tokenomics'],
});

// protocolAnalysis.tvl: $12.4B
// protocolAnalysis.utilizationRate: 0.73
// protocolAnalysis.annualizedRevenue: $245M
// protocolAnalysis.tokenMetrics: { fdv, circulatingSupply, emissionSchedule }
```

Cross-protocol comparison dashboards rank protocols by TVL, revenue, P/S ratio, and user growth rate.

## Yield Farming Analytics

Track and compare yield farming opportunities across DeFi protocols with risk-adjusted return metrics:

```typescript
interface FarmOpportunity {
  protocol: string;
  pool: string;
  chain: string;
  baseApy: number;
  rewardApy: number;
  totalApy: number;
  tvl: number;
  impermanentLossRisk: 'low' | 'medium' | 'high';
  auditStatus: 'audited' | 'unaudited';
  riskScore: number;       // 1-10 composite risk rating
}

const farms = await analyzer.scanYieldFarms({
  minApy: 5,
  maxRiskScore: 6,
  chains: ['ethereum', 'arbitrum'],
  minTvl: 1_000_000,
});
```

Impermanent loss calculators model P&L scenarios for LP positions under various price movement assumptions.

## Liquidity Pool Tracking

Monitor DEX liquidity pools with depth analysis and fee revenue tracking:

```typescript
const pool = await analyzer.trackLiquidityPool({
  dex: 'uniswap-v3',
  pair: 'ETH/USDC',
  feeLevel: 500,   // 0.05%
});

// pool.depth: bid/ask depth at various price levels
// pool.volume24h: $145M
// pool.feeRevenue24h: $72,500
// pool.concentratedLiquidityMap: tick-level liquidity distribution
```

Concentrated liquidity heatmaps visualize capital allocation across price ranges for Uniswap V3 and similar AMMs.

## NFT Analytics

Market-wide and collection-level NFT analytics:

```typescript
const nftAnalysis = await analyzer.analyzeNFTCollection('cryptopunks', {
  metrics: ['floorPrice', 'volume', 'holders', 'washTrading', 'rarity'],
});

// nftAnalysis.floorPrice: 48.5 ETH
// nftAnalysis.uniqueHolders: 3,421
// nftAnalysis.washTradingPercent: 12.3%
// nftAnalysis.rarityDistribution: statistical rarity scores per trait
```

Wash trading detection uses graph analysis of wallet clustering and transaction timing patterns.

## Whale Tracking

Monitor large wallet movements and accumulation/distribution patterns:

```typescript
const whaleActivity = await analyzer.trackWhales('ETH', {
  minBalance: 10_000,          // minimum ETH holdings
  trackExchangeDeposits: true,
  alertOnLargeTransfers: true,
  lookbackHours: 24,
});

// whaleActivity.netFlow: -45,200 ETH (net outflow from exchanges)
// whaleActivity.largeTransfers: [{ from, to, amount, timestamp, type }]
// whaleActivity.accumulationScore: 0.78 (strong accumulation)
```

Smart money scoring ranks wallets by historical trading performance, identifying consistently profitable addresses.

## Exchange Flows

Track net flows between exchanges and private wallets as a supply/demand signal:

```typescript
interface ExchangeFlowData {
  exchange: string;
  netFlow24h: number;
  inflowCount: number;
  outflowCount: number;
  reserveBalance: number;
  reserveChange7d: number;
}

const flows = await analyzer.getExchangeFlows('BTC');
// Aggregate across Binance, Coinbase, Kraken, OKX, Bybit
// Sustained outflows historically precede supply squeezes
```

Exchange reserve alerts trigger when reserves drop below the 30-day moving average by a configurable threshold.

## Staking Yields

Compare staking yields and validator economics across proof-of-stake networks:

```typescript
const stakingData = await analyzer.getStakingYields({
  assets: ['ETH', 'SOL', 'ATOM', 'DOT', 'AVAX'],
  includeValidatorMetrics: true,
  includeLiquidStaking: true,
});

// Per asset: nominalYield, realYield (adjusted for inflation),
//   lockupPeriod, slashingRisk, validatorCount, nakamotoCoefficient
```

Real yield calculations subtract token inflation from nominal staking returns, providing accurate income metrics. Liquid staking derivatives (stETH, mSOL) are tracked with their peg stability and redemption mechanics.

| Function | Description |
|---|---|
| `getOnChainMetrics(asset, opts)` | Fetches on-chain analytics |
| `analyzeDeFiProtocol(protocol, opts)` | Protocol-level DeFi analysis |
| `scanYieldFarms(filters)` | Scans yield farming opportunities |
| `trackLiquidityPool(opts)` | Monitors DEX liquidity pools |
| `analyzeNFTCollection(slug, opts)` | Collection-level NFT analytics |
| `trackWhales(asset, opts)` | Whale wallet monitoring |
| `getExchangeFlows(asset)` | Exchange flow analysis |
| `getStakingYields(opts)` | Cross-chain staking yield comparison |
