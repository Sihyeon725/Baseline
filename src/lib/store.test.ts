import { describe, expect, it } from 'vitest';
import { activeCount, adopt, drop, emptyState, parseState, serializeForExport, setParam } from './store';
import type { Principle } from './types';

const p: Principle = {
  principle_id: 'bogle_01',
  master: 'bogle',
  title: 't',
  quote: null,
  body: 'b',
  source_book: 's',
  check_type: 'auto',
  user_param: { key: 'index_min_weight', label: 'l', unit: '%', default: 60 },
};

describe('adopt / drop', () => {
  it('adopts with default param', () => {
    const s = adopt(emptyState(), p, new Date('2026-09-12T00:00:00Z'));
    expect(activeCount(s)).toBe(1);
    expect(s.adopted_principles[0].params).toEqual({ index_min_weight: 60 });
    expect(s.adopted_principles[0].adopted_at).toBe('2026-09-12T00:00:00.000Z');
  });

  it('drop keeps the record with status dropped', () => {
    const s = drop(adopt(emptyState(), p), 'bogle_01');
    expect(activeCount(s)).toBe(0);
    expect(s.adopted_principles).toHaveLength(1);
    expect(s.adopted_principles[0].status).toBe('dropped');
    expect(s.adopted_principles[0].dropped_at).toBeDefined();
  });

  it('re-adopt after drop keeps the user param', () => {
    let s = adopt(emptyState(), p);
    s = setParam(s, 'bogle_01', 'index_min_weight', 75);
    s = drop(s, 'bogle_01');
    s = adopt(s, p);
    expect(s.adopted_principles).toHaveLength(1);
    expect(s.adopted_principles[0].status).toBe('active');
    expect(s.adopted_principles[0].params.index_min_weight).toBe(75);
  });
});

describe('export / import round trip', () => {
  it('round-trips through JSON', () => {
    const s = setParam(adopt(emptyState(), p), 'bogle_01', 'index_min_weight', 70);
    const text = serializeForExport(s);
    const back = parseState(text);
    expect(back.adopted_principles).toEqual(s.adopted_principles);
  });

  it('rejects foreign files', () => {
    expect(() => parseState('{"foo":1}')).toThrow();
    expect(() => parseState('not json')).toThrow();
    expect(() => parseState({ schema: 'invest-principles', version: 3, adopted_principles: [] })).toThrow();
  });

  it('drops non-numeric params silently', () => {
    const back = parseState({
      schema: 'invest-principles',
      version: 1,
      adopted_principles: [
        { principle_id: 'x', source: 'master', status: 'active', adopted_at: '2026-01-01T00:00:00Z', params: { a: 1, b: 'no' } },
      ],
    });
    expect(back.adopted_principles[0].params).toEqual({ a: 1 });
  });
});

describe('v2 state', () => {
  it('migrates a v1 backup and fills defaults', () => {
    const back = parseState({ schema: 'invest-principles', version: 1, adopted_principles: [] });
    expect(back.version).toBe(2);
    expect(back.holdings).toEqual([]);
    expect(back.trades).toEqual([]);
    expect(back.principle_history).toEqual([]);
    expect(back.custom_principles).toEqual([]);
    expect(back.settings.usd_krw).toBeGreaterThan(0);
  });

  it('round-trips holdings, trades, history and custom principles', async () => {
    const { addCustomPrinciple, addHistory, addTrade, lastNarrative } = await import('./store');
    let s = emptyState();
    s = addTrade(
      s,
      { trade_id: 't1', ticker: 'spy', side: 'buy', quantity: 2, price: 100, traded_at: '2026-01-01T00:00:00Z', principle_tags: ['bogle_01'], note: 'n' },
      { ticker: 'SPY', name: 'SPY', asset_class: 'index_etf', currency: 'USD', why_i_know: '' },
    );
    s = addHistory(s, {
      history_id: 'h1',
      changed_at: '2026-02-01T00:00:00Z',
      from_principle: 'bogle_01',
      to_principle: null,
      portfolio_return_at_change: 3.2,
      answer_what_changed: 'a',
      answer_why: 'b',
      answer_tradeoff: 'c',
      ai_followup_question: 'q',
      ai_followup_answered: false,
      ai_source: 'fallback',
    });
    s = addCustomPrinciple(s, { principle_id: 'custom_1', title: 't', body: 'b', created_at: '2026-03-01T00:00:00Z', ai_review: null, ai_source: 'claude' });
    const back = parseState(serializeForExport(s));
    expect(back.holdings[0].ticker).toBe('SPY');
    expect(back.trades[0].ticker).toBe('SPY');
    expect(back.trades[0].note).toBe('n');
    expect(back.principle_history[0].ai_followup_answered).toBe(false);
    expect(back.custom_principles[0].principle_id).toBe('custom_1');
    expect(back.adopted_principles.find((a) => a.principle_id === 'custom_1')?.source).toBe('custom');
    expect(lastNarrative(back, 'bogle_01')?.answer_why).toBe('b');
  });

  it('rejects trades without a side or date', () => {
    expect(() => parseState({ schema: 'invest-principles', version: 2, adopted_principles: [], trades: [{ ticker: 'A', side: 'hold', traded_at: '2026-01-01' }] })).toThrow();
    expect(() => parseState({ schema: 'invest-principles', version: 2, adopted_principles: [], trades: [{ ticker: 'A', side: 'buy', traded_at: 'nope' }] })).toThrow();
  });
});
