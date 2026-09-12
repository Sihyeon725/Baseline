import { describe, expect, it } from 'vitest';
import { addTrade, emptyState, setManualPrice, upsertHolding } from './store';
import { benchmarkComparison, buildPriceContext, closeOnOrBefore, holdingDays, principlePerformance, tradesReturn, valuate } from './portfolio';
import type { Holding, PriceSnapshot } from './types';

const snap: PriceSnapshot = {
  generated_at: '2026-09-12T00:00:00Z',
  quotes: {
    '069500': { close: 110, date: '2026-09-11', currency: 'KRW' },
    SPY: { close: 200, date: '2026-09-11', currency: 'USD' },
  },
  usd_krw: { rate: 1000, date: '2026-09-12' },
  benchmarks: {
    idx: {
      name: 'IDX',
      currency: 'KRW',
      series: [
        { date: '2026-01-02', close: 100 },
        { date: '2026-06-01', close: 120 },
        { date: '2026-09-11', close: 150 },
      ],
    },
  },
};

const base: Omit<Holding, 'ticker' | 'asset_class'> = { name: '', quantity: 10, avg_price: 100, currency: 'KRW', why_i_know: '', since: '2026-01-01T00:00:00Z' };

describe('valuate', () => {
  it('uses close, converts USD, computes weights and returns', () => {
    let s = emptyState();
    s = upsertHolding(s, { ...base, ticker: '069500', asset_class: 'index_etf' }); // 10*110 = 1100
    s = upsertHolding(s, { ...base, ticker: 'SPY', asset_class: 'index_etf', currency: 'USD', quantity: 1, avg_price: 100 }); // 200*1000 = 200000
    const v = valuate(s, buildPriceContext(snap, 1350));
    expect(v.total_value_krw).toBe(201100);
    expect(v.total_cost_krw).toBe(101000);
    expect(v.priced_count).toBe(2);
    expect(v.items[0].holding.ticker).toBe('SPY');
    expect(v.items[0].weight).toBeCloseTo(200000 / 201100);
    expect(v.items[1].return_pct).toBeCloseTo(10);
  });

  it('falls back to manual price, then cost basis', () => {
    let s = emptyState();
    s = upsertHolding(s, { ...base, ticker: 'XYZ', asset_class: 'stock' });
    let v = valuate(s, buildPriceContext(snap, 1350));
    expect(v.items[0].priceSource).toBe('cost');
    expect(v.return_pct).toBeNull();
    s = setManualPrice(s, 'XYZ', 120);
    v = valuate(s, buildPriceContext(snap, 1350));
    expect(v.items[0].priceSource).toBe('manual');
    expect(v.return_pct).toBeCloseTo(20);
  });

  it('uses the setting FX rate when the snapshot has none', () => {
    const ctx = buildPriceContext({ ...snap, usd_krw: null }, 1350);
    expect(ctx.usdKrw).toBe(1350);
    expect(ctx.fxSource).toBe('setting');
  });
});

describe('trades', () => {
  it('addTrade updates avg price on buy and quantity on sell, requires tags', () => {
    let s = emptyState();
    const nh = { ticker: 'A', name: 'A', asset_class: 'stock' as const, currency: 'KRW' as const, why_i_know: '' };
    s = addTrade(s, { trade_id: '1', ticker: 'a', side: 'buy', quantity: 10, price: 100, traded_at: '2026-01-01T00:00:00Z', principle_tags: ['p'] }, nh);
    s = addTrade(s, { trade_id: '2', ticker: 'A', side: 'buy', quantity: 10, price: 200, traded_at: '2026-02-01T00:00:00Z', principle_tags: ['p'] });
    expect(s.holdings[0].quantity).toBe(20);
    expect(s.holdings[0].avg_price).toBe(150);
    s = addTrade(s, { trade_id: '3', ticker: 'A', side: 'sell', quantity: 5, price: 300, traded_at: '2026-03-01T00:00:00Z', principle_tags: ['p'] });
    expect(s.holdings[0].quantity).toBe(15);
    expect(s.holdings[0].avg_price).toBe(150);
    expect(() => addTrade(s, { trade_id: '4', ticker: 'A', side: 'buy', quantity: 1, price: 1, traded_at: '2026-03-01T00:00:00Z', principle_tags: [] })).toThrow();
  });

  it('holding period restarts after a full exit', () => {
    let s = emptyState();
    const nh = { ticker: 'A', name: 'A', asset_class: 'stock' as const, currency: 'KRW' as const, why_i_know: '' };
    s = addTrade(s, { trade_id: '1', ticker: 'A', side: 'buy', quantity: 10, price: 100, traded_at: '2024-01-01T00:00:00Z', principle_tags: ['p'] }, nh);
    s = addTrade(s, { trade_id: '2', ticker: 'A', side: 'sell', quantity: 10, price: 100, traded_at: '2025-01-01T00:00:00Z', principle_tags: ['p'] });
    s = addTrade(s, { trade_id: '3', ticker: 'A', side: 'buy', quantity: 10, price: 100, traded_at: '2026-09-01T00:00:00Z', principle_tags: ['p'] });
    expect(holdingDays(s.holdings[0], s.trades, new Date('2026-09-11T00:00:00Z'))).toBe(10);
  });

  it('principlePerformance groups by tag and marks unpriced', () => {
    let s = emptyState();
    s = addTrade(s, { trade_id: '1', ticker: '069500', side: 'buy', quantity: 10, price: 100, traded_at: '2026-01-05T00:00:00Z', principle_tags: ['bogle_01'] }, { ticker: '069500', name: '', asset_class: 'index_etf', currency: 'KRW', why_i_know: '' });
    s = addTrade(s, { trade_id: '2', ticker: 'ZZZ', side: 'buy', quantity: 1, price: 50, traded_at: '2026-01-05T00:00:00Z', principle_tags: ['bogle_01', 'lynch_01'] }, { ticker: 'ZZZ', name: '', asset_class: 'stock', currency: 'KRW', why_i_know: '' });
    const perf = principlePerformance(s, buildPriceContext(snap, 1350));
    const bogle = perf.find((p) => p.principle_id === 'bogle_01')!;
    expect(bogle.trade_count).toBe(2);
    expect(bogle.unpriced).toBe(1);
    expect(bogle.return_pct).toBeNull();
    const lynch = perf.find((p) => p.principle_id === 'lynch_01')!;
    expect(lynch.unpriced).toBe(1);
  });

  it('benchmark comparison uses close on or before the trade date', () => {
    expect(closeOnOrBefore(snap.benchmarks.idx.series, '2026-07-01')!.close).toBe(120);
    expect(closeOnOrBefore(snap.benchmarks.idx.series, '2025-01-01')).toBeNull();
    let s = emptyState();
    s = addTrade(s, { trade_id: '1', ticker: '069500', side: 'buy', quantity: 10, price: 100, traded_at: '2026-06-15T00:00:00Z', principle_tags: ['p'] }, { ticker: '069500', name: '', asset_class: 'index_etf', currency: 'KRW', why_i_know: '' });
    const ctx = buildPriceContext(snap, 1350);
    const b = benchmarkComparison(s, ctx, snap)[0];
    expect(b.covered_trades).toBe(1);
    expect(b.invested_krw).toBe(1000);
    expect(b.hypothetical_value_krw).toBeCloseTo(1250); // 150/120
    expect(b.return_pct).toBeCloseTo(25);
    const mine = tradesReturn(s, ctx);
    expect(mine.return_pct).toBeCloseTo(10); // 110 vs 100
  });
});
