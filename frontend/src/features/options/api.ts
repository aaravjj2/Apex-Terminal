/**
 * Options Analytics API Client
 */

import type {
  OptionsChain,
  IVAnalytics,
  VolatilitySkew,
  TermStructure,
  PutCallRatio,
  StrategyTemplate,
  StrategyAnalysis,
  StrategyAnalyzeRequest,
  CoveredCallRequest,
  IronCondorRequest,
  StraddleRequest,
  VerticalSpreadRequest,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

class OptionsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = `${baseUrl}/api/v1/options`;
  }

  /**
   * Get options chain for a symbol
   */
  async getChain(symbol: string, expiration?: string): Promise<OptionsChain> {
    const params = expiration ? `?expiration=${expiration}` : '';
    const response = await fetch(`${this.baseUrl}/chain/${symbol}${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch options chain: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapChainResponse(data);
  }

  /**
   * Get IV analytics for a symbol
   */
  async getIVAnalytics(symbol: string, lookbackDays = 252): Promise<IVAnalytics> {
    const response = await fetch(
      `${this.baseUrl}/iv/${symbol}?lookback_days=${lookbackDays}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch IV analytics: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapIVResponse(data);
  }

  /**
   * Get volatility skew for a symbol and expiration
   */
  async getSkew(symbol: string, expiration: string): Promise<VolatilitySkew> {
    const response = await fetch(
      `${this.baseUrl}/skew/${symbol}/${expiration}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch skew: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapSkewResponse(data);
  }

  /**
   * Get IV term structure
   */
  async getTermStructure(symbol: string): Promise<TermStructure> {
    const response = await fetch(`${this.baseUrl}/term-structure/${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch term structure: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapTermStructureResponse(data);
  }

  /**
   * Get Put/Call ratio
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio> {
    const response = await fetch(`${this.baseUrl}/pcr/${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch PCR: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapPCRResponse(data);
  }

  // Strategy endpoints
  
  /**
   * Get all strategy templates
   */
  async getStrategyTemplates(): Promise<StrategyTemplate[]> {
    const response = await fetch(`${this.baseUrl}/strategies/templates`);
    if (!response.ok) {
      throw new Error(`Failed to fetch strategy templates: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map(this.mapTemplateResponse);
  }

  /**
   * Analyze a custom strategy
   */
  async analyzeStrategy(request: StrategyAnalyzeRequest): Promise<StrategyAnalysis> {
    const response = await fetch(`${this.baseUrl}/strategies/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legs: request.legs.map(leg => ({
          option_type: leg.optionType,
          position: leg.position,
          strike: leg.strike,
          premium: leg.premium,
          quantity: leg.quantity,
          expiration_days: leg.expirationDays,
          iv: leg.iv,
        })),
        underlying_price: request.underlyingPrice,
        strategy_name: request.strategyName || 'Custom',
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to analyze strategy: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapStrategyResponse(data);
  }

  /**
   * Build covered call strategy
   */
  async buildCoveredCall(request: CoveredCallRequest): Promise<StrategyAnalysis> {
    const response = await fetch(`${this.baseUrl}/strategies/covered-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        underlying_price: request.underlyingPrice,
        call_strike: request.callStrike,
        call_premium: request.callPremium,
        expiration_days: request.expirationDays || 30,
        iv: request.iv || 0.3,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to build covered call: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapStrategyResponse(data);
  }

  /**
   * Build iron condor strategy
   */
  async buildIronCondor(request: IronCondorRequest): Promise<StrategyAnalysis> {
    const response = await fetch(`${this.baseUrl}/strategies/iron-condor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        underlying_price: request.underlyingPrice,
        put_long_strike: request.putLongStrike,
        put_long_premium: request.putLongPremium,
        put_short_strike: request.putShortStrike,
        put_short_premium: request.putShortPremium,
        call_short_strike: request.callShortStrike,
        call_short_premium: request.callShortPremium,
        call_long_strike: request.callLongStrike,
        call_long_premium: request.callLongPremium,
        expiration_days: request.expirationDays || 30,
        iv: request.iv || 0.3,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to build iron condor: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapStrategyResponse(data);
  }

  /**
   * Build straddle strategy
   */
  async buildStraddle(request: StraddleRequest): Promise<StrategyAnalysis> {
    const response = await fetch(`${this.baseUrl}/strategies/straddle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        underlying_price: request.underlyingPrice,
        strike: request.strike,
        call_premium: request.callPremium,
        put_premium: request.putPremium,
        expiration_days: request.expirationDays || 30,
        iv: request.iv || 0.3,
        is_long: request.isLong !== false,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to build straddle: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapStrategyResponse(data);
  }

  /**
   * Build vertical spread strategy
   */
  async buildVerticalSpread(request: VerticalSpreadRequest): Promise<StrategyAnalysis> {
    const response = await fetch(`${this.baseUrl}/strategies/vertical-spread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        underlying_price: request.underlyingPrice,
        long_strike: request.longStrike,
        long_premium: request.longPremium,
        short_strike: request.shortStrike,
        short_premium: request.shortPremium,
        option_type: request.optionType || 'call',
        expiration_days: request.expirationDays || 30,
        iv: request.iv || 0.3,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to build vertical spread: ${response.statusText}`);
    }
    const data = await response.json();
    return this.mapStrategyResponse(data);
  }

  // Response mappers (snake_case -> camelCase)

  private mapChainResponse(data: any): OptionsChain {
    return {
      symbol: data.symbol,
      underlyingPrice: data.underlying_price,
      expirations: data.expirations,
      contracts: data.contracts.map((c: any) => ({
        symbol: c.symbol,
        contractSymbol: c.contract_symbol,
        optionType: c.option_type,
        strike: c.strike,
        expiration: c.expiration,
        bid: c.bid,
        ask: c.ask,
        last: c.last,
        mark: c.mark,
        midPrice: c.mid_price,
        volume: c.volume,
        openInterest: c.open_interest,
        impliedVolatility: c.implied_volatility,
        greeks: c.greeks,
        inTheMoney: c.in_the_money,
        daysToExpiration: c.days_to_expiration,
      })),
      timestamp: data.timestamp,
      provider: data.provider,
      totalContracts: data.total_contracts,
      unavailable: data.unavailable,
    };
  }

  private mapIVResponse(data: any): IVAnalytics {
    return {
      symbol: data.symbol,
      currentIv: data.current_iv,
      ivRank: data.iv_rank,
      ivPercentile: data.iv_percentile,
      ivHigh: data.iv_high,
      ivLow: data.iv_low,
      lookbackDays: data.lookback_days,
      timestamp: data.timestamp,
      unavailable: data.unavailable,
    };
  }

  private mapSkewResponse(data: any): VolatilitySkew {
    return {
      symbol: data.symbol,
      expiration: data.expiration,
      strikes: data.strikes,
      ivs: data.ivs,
      atmStrike: data.atm_strike,
      atmIv: data.atm_iv,
      skewSlope: data.skew_slope,
      delta25PutIv: data.delta25_put_iv,
      delta25CallIv: data.delta25_call_iv,
      skewRatio: data.skew_ratio,
      unavailable: data.unavailable,
    };
  }

  private mapTermStructureResponse(data: any): TermStructure {
    return {
      symbol: data.symbol,
      expirations: data.expirations,
      daysToExpiration: data.days_to_expiration,
      ivs: data.ivs,
      structureType: data.structure_type,
      unavailable: data.unavailable,
    };
  }

  private mapPCRResponse(data: any): PutCallRatio {
    return {
      symbol: data.symbol,
      volumePcr: data.volume_pcr,
      oiPcr: data.oi_pcr,
      totalPutVolume: data.total_put_volume,
      totalCallVolume: data.total_call_volume,
      totalPutOi: data.total_put_oi,
      totalCallOi: data.total_call_oi,
      timestamp: data.timestamp,
      unavailable: data.unavailable,
    };
  }

  private mapTemplateResponse(data: any): StrategyTemplate {
    return {
      name: data.name,
      description: data.description,
      category: data.category,
      maxProfit: data.max_profit,
      maxLoss: data.max_loss,
      legsDescription: data.legs_description,
    };
  }

  private mapStrategyResponse(data: any): StrategyAnalysis {
    return {
      name: data.name,
      legs: data.legs.map((l: any) => ({
        optionType: l.option_type,
        position: l.position,
        strike: l.strike,
        premium: l.premium,
        quantity: l.quantity,
        expirationDays: l.expiration_days,
        iv: l.iv,
      })),
      underlyingPrice: data.underlying_price,
      priceRange: data.price_range,
      expirationPayoff: data.expiration_payoff,
      theoreticalPayoff: data.theoretical_payoff,
      maxProfit: data.max_profit,
      maxLoss: data.max_loss,
      breakevens: data.breakevens,
      netDelta: data.net_delta,
      netGamma: data.net_gamma,
      netTheta: data.net_theta,
      netVega: data.net_vega,
    };
  }
}

// Singleton instance
export const optionsApi = new OptionsAPI();

export default OptionsAPI;
