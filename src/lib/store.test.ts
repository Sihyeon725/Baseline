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
    expect(() => parseState({ schema: 'invest-principles', version: 2, adopted_principles: [] })).toThrow();
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
