import { describe, expect, it } from 'vitest';
import { addTrade, adopt, emptyState, setParam, upsertHolding } from './store';
import { buildPriceContext, valuate } from './portfolio';
import { alternatives, contradictions, evaluateAll, masterScores, verdict } from './rules';
import type { Holding, PrincipleData, Trade, UserState } from './types';

const data: PrincipleData = {
  version: 1,
  masters: [
    { id: 'bogle', name: '보글', name_en: 'Bogle', keywords: '', oneliner: '', color: '#000' },
    { id: 'lynch', name: '린치', name_en: 'Lynch', keywords: '', oneliner: '', color: '#000' },
    { id: 'buffett', name: '버핏', name_en: 'Buffett', keywords: '', oneliner: '', color: '#000' },
    { id: 'dalio', name: '달리오', name_en: 'Dalio', keywords: '', oneliner: '', color: '#000' },
  ],
  principles: [
    { principle_id: 'bogle_01', master: 'bogle', title: 'b1', quote: null, body: '', source_book: '', check_type: 'auto', user_param: { key: 'index_min_weight', label: '', unit: '%', default: 60 } },
    { principle_id: 'bogle_02', master: 'bogle', title: 'b2', quote: null, body: '', source_book: '', check_type: 'auto', user_param: { key: 'max_trades_90d', label: '', unit: '회', default: 6 } },
    { principle_id: 'lynch_01', master: 'lynch', title: 'l1', quote: null, body: '', source_book: '', check_type: 'auto', user_param: null },
    { principle_id: 'buffett_01', master: 'buffett', title: 'w1', quote: null, body: '', source_book: '', check_type: 'auto', user_param: { key: 'max_holdings', label: '', unit: '개', default: 10 } },
    { principle_id: 'buffett_02', master: 'buffett', title: 'w2', quote: null, body: '', source_book: '', check_type: 'auto', user_param: { key: 'min_holding_days', label: '', unit: '일', default: 365 } },
    { principle_id: 'dalio_01', master: 'dalio', title: 'd1', quote: null, body: '', source_book: '', check_type: 'auto', user_param: { key: 'min_asset_classes', label: '', unit: '종류', default: 3 } },
    { principle_id: 'self_01', master: 'dalio', title: 's', quote: null, body: '', source_book: '', check_type: 'self', user_param: null },
  ],
};

const NOW = new Date('2026-09-12T00:00:00Z');
const h = (p: Partial<Holding> & Pick<Holding, 'ticker' | 'asset_class'>): Holding => ({
  name: p.ticker,
  quantity: 10,
  avg_price: 100,
  currency: 'KRW',
  why_i_know: '',
  since: '2024-01-01T00:00:00Z',
  ...p,
});

function ctxFor(state: UserState) {
  const valuation = valuate(state, buildPriceContext(null, 1350));
  return { state, valuation, now: NOW };
}

describe('rules', () => {
  it('returns null outcomes on an empty portfolio', () => {
    const r = evaluateAll(data, ctxFor(emptyState()));
    expect(r.every((x) => x.outcome === null)).toBe(true);
    expect(verdict(data, r).type).toBe('empty');
    expect(masterScores(data, r).every((s) => s.score === null)).toBe(true);
  });

  it('index-heavy, long-held, diversified portfolio matches Bogle and Dalio', () => {
    let s = emptyState();
    s = upsertHolding(s, h({ ticker: '069500', asset_class: 'index_etf', quantity: 70 }));
    s = upsertHolding(s, h({ ticker: '148070', asset_class: 'bond', quantity: 20 }));
    s = upsertHolding(s, h({ ticker: '132030', asset_class: 'commodity', quantity: 10 }));
    const r = evaluateAll(data, ctxFor(s));
    const by = Object.fromEntries(r.map((x) => [x.principle.principle_id, x.outcome?.pass]));
    expect(by.bogle_01).toBe(true); // 70%
    expect(by.bogle_02).toBe(true); // 0 trades
    expect(by.lynch_01).toBe(true); // no stocks
    expect(by.buffett_01).toBe(true); // 3 <= 10
    expect(by.buffett_02).toBe(true); // since 2024
    expect(by.dalio_01).toBe(true); // 3 classes
    const v = verdict(data, r);
    expect(v.type).toBe('match');
  });

  it('flags contradictions only for adopted principles and finds alternatives', () => {
    let s = emptyState();
    s = upsertHolding(s, h({ ticker: 'A', asset_class: 'stock', why_i_know: '' }));
    s = upsertHolding(s, h({ ticker: 'B', asset_class: 'stock', why_i_know: 'ok' }));
    s = adopt(s, data.principles[2]); // lynch_01
    const r = evaluateAll(data, ctxFor(s));
    const c = contradictions(r);
    expect(c.map((x) => x.principle.principle_id)).toEqual(['lynch_01']);
    expect(c[0].outcome!.detail).toContain('A');
    // buffett_01 (2 <= 10) passes and is not adopted → alternative
    expect(alternatives(r).map((x) => x.principle.principle_id)).toContain('buffett_01');
    expect(alternatives(r).map((x) => x.principle.principle_id)).not.toContain('lynch_01');
  });

  it('uses the adopted user param over the default', () => {
    let s = emptyState();
    s = upsertHolding(s, h({ ticker: '069500', asset_class: 'index_etf', quantity: 50 }));
    s = upsertHolding(s, h({ ticker: 'A', asset_class: 'stock', quantity: 50 }));
    let r = evaluateAll(data, ctxFor(s));
    expect(r.find((x) => x.principle.principle_id === 'bogle_01')!.outcome!.pass).toBe(false); // 50 < 60
    s = adopt(s, data.principles[0]);
    s = setParam(s, 'bogle_01', 'index_min_weight', 40);
    r = evaluateAll(data, ctxFor(s));
    expect(r.find((x) => x.principle.principle_id === 'bogle_01')!.outcome!.pass).toBe(true);
  });

  it('counts recent trades for bogle_02 and holding period from trades for buffett_02', () => {
    let s = emptyState();
    const nh = { ticker: 'A', name: 'A', asset_class: 'stock' as const, currency: 'KRW' as const, why_i_know: 'x' };
    const trade = (i: number, at: string): Trade => ({ trade_id: `t${i}`, ticker: 'A', side: 'buy', quantity: 1, price: 100, traded_at: at, principle_tags: ['x'] });
    for (let i = 0; i < 7; i++) s = addTrade(s, trade(i, `2026-09-0${i + 1}T00:00:00Z`), nh);
    const r = evaluateAll(data, ctxFor(s));
    const by = Object.fromEntries(r.map((x) => [x.principle.principle_id, x.outcome]));
    expect(by.bogle_02!.pass).toBe(false);
    expect(by.bogle_02!.actual).toContain('7회');
    expect(by.buffett_02!.pass).toBe(false); // 11 days
    // mismatch: bogle 0/2, lynch 1/1 (=100) → best lynch → match actually. Check scores are per-master.
    const scores = Object.fromEntries(masterScores(data, r).map((m) => [m.master, m.score]));
    expect(scores.bogle).toBe(0);
    expect(scores.lynch).toBe(100);
    expect(scores.buffett).toBe(50);
    expect(scores.dalio).toBe(0);
  });

  it('mismatch when every master is below 40%', () => {
    let s = emptyState();
    // 12 stocks, no why_i_know, index 0%, 1 class, 7 recent trades
    for (let i = 0; i < 12; i++) s = upsertHolding(s, h({ ticker: `S${i}`, asset_class: 'stock', since: '2026-09-01T00:00:00Z' }));
    for (let i = 0; i < 7; i++) {
      s = addTrade(s, { trade_id: `t${i}`, ticker: `S${i}`, side: 'buy', quantity: 1, price: 1, traded_at: `2026-09-0${i + 1}T00:00:00Z`, principle_tags: ['x'] });
    }
    const v = verdict(data, evaluateAll(data, ctxFor(s)));
    expect(v.type).toBe('mismatch');
    expect(v.scores.every((m) => m.score === 0)).toBe(true);
  });
});
