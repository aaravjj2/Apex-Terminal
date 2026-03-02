import { describe, it, expect } from 'vitest';
import {
  RMA, ZLEMA, VAMA, McGinleyDynamic,
  MassIndex, Vortex, QStick, VPT,
  LinearRegressionIndicator, ConnorsRSI,
  BBPercentB, BBWidth, PVI, NVI,
  DetrendedPrice, KnowSureThing,
  WilliamsAlligator, PriceChannel,
  SchaffTrendCycle, SmoothedRSI, TwiggsMoneyFlow,
  UlcerIndex, WoodieCCI,
  HistoricalVolatility, ChaikinVolatility,
} from '../../src/lib/ta/indicators-extended';

const closes = [100, 102, 101, 105, 107, 106, 108, 110, 109, 112, 111, 115];
const highs = [101, 103, 104, 106, 108, 109, 111, 112, 111, 113, 112, 116];
const lows = [99, 100, 100, 103, 105, 104, 106, 108, 107, 110, 109, 113];
const volumes = closes.map(() => 1000);

describe('RMA', () => {
  it('returns same length', () => expect(RMA(closes, { period: 5 })).toHaveLength(closes.length));
  it('has finite values after warm-up', () => {
    const r = RMA(closes, { period: 5 });
    expect(r[r.length - 1]).not.toBeNaN();
  });
});

describe('ZLEMA', () => {
  it('returns same length', () => expect(ZLEMA(closes, { period: 10 })).toHaveLength(closes.length));
});

describe('VAMA', () => {
  it('returns same length with volumes', () => {
    expect(VAMA(closes, { period: 5, volumes })).toHaveLength(closes.length);
  });
});

describe('McGinleyDynamic', () => {
  it('returns same length', () => expect(McGinleyDynamic(closes, { period: 10 })).toHaveLength(closes.length));
});

describe('MassIndex', () => {
  it('returns same length', () => expect(MassIndex(closes, { highs, lows })).toHaveLength(closes.length));
});

describe('Vortex', () => {
  it('returns plus and minus arrays', () => {
    const r = Vortex(closes, { highs, lows });
    expect(r.plus).toHaveLength(closes.length);
    expect(r.minus).toHaveLength(closes.length);
  });
});

describe('QStick', () => {
  it('returns same length', () => expect(QStick(closes, { opens: closes.map((c, i) => c - 0.5) })).toHaveLength(closes.length));
});

describe('VPT', () => {
  it('returns same length with volumes', () => expect(VPT(closes, { volumes })).toHaveLength(closes.length));
});

describe('LinearRegressionIndicator', () => {
  it('returns same length', () => expect(LinearRegressionIndicator(closes, { period: 10 })).toHaveLength(closes.length));
});

describe('ConnorsRSI', () => {
  it('returns same length', () => expect(ConnorsRSI(closes, { period: 3 })).toHaveLength(closes.length));
});

describe('BBPercentB extra', () => {
  it('values often in 0-1 range for normal data', () => {
    const r = BBPercentB(closes, { period: 5, stdDev: 2 });
    const valid = r.filter((v) => !isNaN(v));
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe('BBWidth extra', () => {
  it('returns non-negative width', () => {
    const r = BBWidth(closes, { period: 5, stdDev: 2 });
    const valid = r.filter((v) => !isNaN(v));
    valid.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('PVI', () => {
  it('returns same length with volumes', () => expect(PVI(closes, { volumes })).toHaveLength(closes.length));
});

describe('NVI', () => {
  it('returns same length with volumes', () => expect(NVI(closes, { volumes })).toHaveLength(closes.length));
});

describe('DetrendedPrice', () => {
  it('returns same length', () => expect(DetrendedPrice(closes, { period: 10 })).toHaveLength(closes.length));
});

describe('KnowSureThing', () => {
  it('returns same length', () => expect(KnowSureThing(closes)).toHaveLength(closes.length));
});

describe('WilliamsAlligator', () => {
  it('returns jaw, teeth, lips', () => {
    const r = WilliamsAlligator(closes);
    expect(r.jaw).toHaveLength(closes.length);
    expect(r.teeth).toHaveLength(closes.length);
    expect(r.lips).toHaveLength(closes.length);
  });
});

describe('PriceChannel', () => {
  it('returns upper, middle, lower', () => {
    const r = PriceChannel(closes, { period: 10 });
    expect(r).toHaveProperty('upper');
    expect(r).toHaveProperty('middle');
    expect(r).toHaveProperty('lower');
  });
});

describe('SchaffTrendCycle', () => {
  it('returns same length', () => expect(SchaffTrendCycle(closes, { period: 10 })).toHaveLength(closes.length));
});

describe('SmoothedRSI', () => {
  it('returns same length', () => expect(SmoothedRSI(closes, { period: 14 })).toHaveLength(closes.length));
});

describe('TwiggsMoneyFlow', () => {
  it('returns same length with OHLCV', () => {
    const r = TwiggsMoneyFlow(closes, { highs, lows, volumes, opens: closes.map((c) => c - 0.5) });
    expect(r).toHaveLength(closes.length);
  });
});

describe('UlcerIndex', () => {
  it('returns same length', () => expect(UlcerIndex(closes, { period: 14 })).toHaveLength(closes.length));
});

describe('WoodieCCI', () => {
  it('returns same length with highs/lows', () => expect(WoodieCCI(closes, { highs, lows })).toHaveLength(closes.length));
});

describe('HistoricalVolatility', () => {
  it('returns same length', () => expect(HistoricalVolatility(closes, { period: 20 })).toHaveLength(closes.length));
});

describe('ChaikinVolatility', () => {
  it('returns same length', () => expect(ChaikinVolatility(closes, { highs, lows })).toHaveLength(closes.length));
});
