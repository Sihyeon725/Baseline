import type {
  AdoptedPrinciple,
  AssetClass,
  Currency,
  CustomPrinciple,
  Holding,
  Principle,
  PrincipleHistory,
  Settings,
  Trade,
  UserState,
} from './types';

export const STORAGE_KEY = 'invest-principles:v1';
export const DEFAULT_USD_KRW = 1350;

const ASSET_CLASSES: AssetClass[] = ['index_etf', 'sector_etf', 'stock', 'bond', 'commodity', 'cash'];
const CURRENCIES: Currency[] = ['KRW', 'USD'];

export function emptyState(): UserState {
  return {
    schema: 'invest-principles',
    version: 2,
    adopted_principles: [],
    holdings: [],
    trades: [],
    principle_history: [],
    custom_principles: [],
    settings: { usd_krw: DEFAULT_USD_KRW },
  };
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

// ---------- 검증 ----------

function isIso(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function parseAdopted(list: unknown): AdoptedPrinciple[] {
  if (!Array.isArray(list)) throw new Error('adopted_principles가 없습니다');
  return list.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`항목 ${i}이 올바르지 않습니다`);
    const a = item as Record<string, unknown>;
    if (typeof a.principle_id !== 'string' || !a.principle_id) throw new Error(`항목 ${i}: principle_id 없음`);
    if (a.source !== 'master' && a.source !== 'custom') throw new Error(`항목 ${i}: source 오류`);
    if (a.status !== 'active' && a.status !== 'dropped') throw new Error(`항목 ${i}: status 오류`);
    if (!isIso(a.adopted_at)) throw new Error(`항목 ${i}: adopted_at 오류`);
    const params: Record<string, number> = {};
    if (a.params && typeof a.params === 'object') {
      for (const [k, v] of Object.entries(a.params as Record<string, unknown>)) {
        const n = num(v);
        if (n !== undefined) params[k] = n;
      }
    }
    const out: AdoptedPrinciple = {
      principle_id: a.principle_id,
      source: a.source,
      adopted_at: a.adopted_at,
      status: a.status,
      params,
    };
    if (typeof a.dropped_at === 'string') out.dropped_at = a.dropped_at;
    return out;
  });
}

function parseHoldings(list: unknown): Holding[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('holdings 형식 오류');
  return list.map((item, i) => {
    const h = (item ?? {}) as Record<string, unknown>;
    if (typeof h.ticker !== 'string' || !h.ticker) throw new Error(`보유 종목 ${i}: ticker 없음`);
    const asset_class = ASSET_CLASSES.includes(h.asset_class as AssetClass) ? (h.asset_class as AssetClass) : 'stock';
    const currency = CURRENCIES.includes(h.currency as Currency) ? (h.currency as Currency) : 'KRW';
    const out: Holding = {
      ticker: h.ticker.toUpperCase(),
      name: str(h.name, h.ticker),
      asset_class,
      quantity: num(h.quantity) ?? 0,
      avg_price: num(h.avg_price) ?? 0,
      currency,
      why_i_know: str(h.why_i_know),
      since: isIso(h.since) ? h.since : new Date().toISOString(),
    };
    const mp = num(h.manual_price);
    if (mp !== undefined) {
      out.manual_price = mp;
      if (isIso(h.manual_price_at)) out.manual_price_at = h.manual_price_at;
    }
    return out;
  });
}

function parseTrades(list: unknown): Trade[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('trades 형식 오류');
  return list.map((item, i) => {
    const t = (item ?? {}) as Record<string, unknown>;
    if (typeof t.ticker !== 'string' || !t.ticker) throw new Error(`매매 ${i}: ticker 없음`);
    if (t.side !== 'buy' && t.side !== 'sell') throw new Error(`매매 ${i}: side 오류`);
    if (!isIso(t.traded_at)) throw new Error(`매매 ${i}: traded_at 오류`);
    const tags = Array.isArray(t.principle_tags) ? t.principle_tags.filter((x): x is string => typeof x === 'string') : [];
    const out: Trade = {
      trade_id: str(t.trade_id) || newId('trade'),
      ticker: t.ticker.toUpperCase(),
      side: t.side,
      quantity: num(t.quantity) ?? 0,
      price: num(t.price) ?? 0,
      traded_at: t.traded_at,
      principle_tags: tags,
    };
    if (typeof t.note === 'string' && t.note) out.note = t.note;
    return out;
  });
}

function parseHistory(list: unknown): PrincipleHistory[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('principle_history 형식 오류');
  return list.map((item, i) => {
    const h = (item ?? {}) as Record<string, unknown>;
    if (!isIso(h.changed_at)) throw new Error(`이력 ${i}: changed_at 오류`);
    const out: PrincipleHistory = {
      history_id: str(h.history_id) || newId('hist'),
      changed_at: h.changed_at,
      from_principle: typeof h.from_principle === 'string' ? h.from_principle : null,
      to_principle: typeof h.to_principle === 'string' ? h.to_principle : null,
      portfolio_return_at_change: num(h.portfolio_return_at_change) ?? null,
      answer_what_changed: str(h.answer_what_changed),
      answer_why: str(h.answer_why),
      answer_tradeoff: str(h.answer_tradeoff),
      ai_followup_question: typeof h.ai_followup_question === 'string' ? h.ai_followup_question : null,
      ai_followup_answered: h.ai_followup_answered === true,
    };
    if (typeof h.ai_followup_answer === 'string') out.ai_followup_answer = h.ai_followup_answer;
    if (h.ai_source === 'claude' || h.ai_source === 'fallback') out.ai_source = h.ai_source;
    return out;
  });
}

function parseCustom(list: unknown): CustomPrinciple[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error('custom_principles 형식 오류');
  return list.map((item, i) => {
    const c = (item ?? {}) as Record<string, unknown>;
    if (typeof c.principle_id !== 'string' || !c.principle_id.startsWith('custom_')) {
      throw new Error(`나만의 원칙 ${i}: principle_id 오류`);
    }
    return {
      principle_id: c.principle_id,
      title: str(c.title),
      body: str(c.body),
      created_at: isIso(c.created_at) ? c.created_at : new Date().toISOString(),
      ai_review: typeof c.ai_review === 'string' ? c.ai_review : null,
      ai_source: c.ai_source === 'claude' ? 'claude' : 'fallback',
    };
  });
}

function parseSettings(v: unknown): Settings {
  const s = (v ?? {}) as Record<string, unknown>;
  const rate = num(s.usd_krw);
  return { usd_krw: rate && rate > 0 ? rate : DEFAULT_USD_KRW };
}

/** 외부 입력(localStorage, 가져온 파일)을 검증해 UserState로 만든다. v1 백업도 받아들인다. 실패 시 Error. */
export function parseState(raw: unknown): UserState {
  if (typeof raw === 'string') {
    raw = JSON.parse(raw);
  }
  if (!raw || typeof raw !== 'object') throw new Error('객체가 아닙니다');
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== 'invest-principles') throw new Error('이 사이트의 백업 파일이 아닙니다');
  if (obj.version !== 1 && obj.version !== 2) throw new Error(`지원하지 않는 버전입니다: ${String(obj.version)}`);

  return {
    schema: 'invest-principles',
    version: 2,
    adopted_principles: parseAdopted(obj.adopted_principles),
    holdings: parseHoldings(obj.holdings),
    trades: parseTrades(obj.trades),
    principle_history: parseHistory(obj.principle_history),
    custom_principles: parseCustom(obj.custom_principles),
    settings: parseSettings(obj.settings),
  };
}

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): UserState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return parseState(raw);
  } catch {
    return emptyState();
  }
}

export function saveState(state: UserState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function serializeForExport(state: UserState): string {
  const out: UserState = { ...state, exported_at: new Date().toISOString() };
  return JSON.stringify(out, null, 2);
}

// ---------- 순수 상태 전이 함수 (컴포넌트와 분리해 테스트 가능) ----------

export function findAdopted(state: UserState, principleId: string): AdoptedPrinciple | undefined {
  return state.adopted_principles.find((a) => a.principle_id === principleId);
}

export function isActive(state: UserState, principleId: string): boolean {
  return findAdopted(state, principleId)?.status === 'active';
}

/** 채택. 이미 dropped 상태면 다시 active로 되돌리되 adopted_at은 새로 찍는다. */
export function adopt(state: UserState, principle: Pick<Principle, 'principle_id' | 'user_param'>, now = new Date()): UserState {
  const existing = findAdopted(state, principle.principle_id);
  const params: Record<string, number> = { ...(existing?.params ?? {}) };
  if (principle.user_param && params[principle.user_param.key] === undefined) {
    params[principle.user_param.key] = principle.user_param.default;
  }
  const entry: AdoptedPrinciple = {
    principle_id: principle.principle_id,
    source: principle.principle_id.startsWith('custom_') ? 'custom' : 'master',
    adopted_at: now.toISOString(),
    status: 'active',
    params,
  };
  const rest = state.adopted_principles.filter((a) => a.principle_id !== principle.principle_id);
  return { ...state, adopted_principles: [...rest, entry] };
}

/** 폐기. 기록은 지우지 않고 status만 바꾼다 (명세서: 기록으로 억제). */
export function drop(state: UserState, principleId: string, now = new Date()): UserState {
  return {
    ...state,
    adopted_principles: state.adopted_principles.map((a) =>
      a.principle_id === principleId && a.status === 'active'
        ? { ...a, status: 'dropped', dropped_at: now.toISOString() }
        : a,
    ),
  };
}

export function setParam(state: UserState, principleId: string, key: string, value: number): UserState {
  return {
    ...state,
    adopted_principles: state.adopted_principles.map((a) =>
      a.principle_id === principleId ? { ...a, params: { ...a.params, [key]: value } } : a,
    ),
  };
}

export function activeCount(state: UserState): number {
  return state.adopted_principles.filter((a) => a.status === 'active').length;
}

export function activeIds(state: UserState): string[] {
  return state.adopted_principles.filter((a) => a.status === 'active').map((a) => a.principle_id);
}

// ---------- 포트폴리오 ----------

export function findHolding(state: UserState, ticker: string): Holding | undefined {
  const t = ticker.toUpperCase();
  return state.holdings.find((h) => h.ticker === t);
}

/** 보유 종목 추가/수정. ticker가 같으면 덮어쓴다. */
export function upsertHolding(state: UserState, holding: Holding): UserState {
  const h = { ...holding, ticker: holding.ticker.toUpperCase() };
  const rest = state.holdings.filter((x) => x.ticker !== h.ticker);
  return { ...state, holdings: [...rest, h] };
}

/** 보유 종목 삭제. 매매 기록은 남긴다. */
export function removeHolding(state: UserState, ticker: string): UserState {
  const t = ticker.toUpperCase();
  return { ...state, holdings: state.holdings.filter((h) => h.ticker !== t) };
}

export function setManualPrice(state: UserState, ticker: string, price: number | null, now = new Date()): UserState {
  const t = ticker.toUpperCase();
  return {
    ...state,
    holdings: state.holdings.map((h) => {
      if (h.ticker !== t) return h;
      const { manual_price: _mp, manual_price_at: _at, ...rest } = h;
      return price === null ? rest : { ...rest, manual_price: price, manual_price_at: now.toISOString() };
    }),
  };
}

/**
 * 매매 기록 추가. 보유 종목의 수량·평단가를 함께 갱신한다.
 * - 매수: 평단가 = (기존 수량×평단 + 매수 수량×가격) / 합계 수량
 * - 매도: 수량만 줄인다. 평단가 유지. 0 이하가 되면 0으로 둔다 (종목 카드는 남긴다)
 * principle_tags가 비어 있으면 Error (명세서: 필수).
 */
export function addTrade(state: UserState, trade: Trade, newHolding?: Omit<Holding, 'quantity' | 'avg_price' | 'since'>): UserState {
  if (trade.principle_tags.length === 0) throw new Error('원칙 태그는 필수입니다');
  if (!(trade.quantity > 0) || !(trade.price >= 0)) throw new Error('수량과 가격을 확인하세요');
  const ticker = trade.ticker.toUpperCase();
  let holding = findHolding(state, ticker);
  if (!holding) {
    if (!newHolding) throw new Error('보유 종목 정보가 없습니다');
    holding = { ...newHolding, ticker, quantity: 0, avg_price: 0, since: trade.traded_at };
  }
  let next: Holding;
  if (trade.side === 'buy') {
    const q = holding.quantity + trade.quantity;
    const cost = holding.quantity * holding.avg_price + trade.quantity * trade.price;
    next = { ...holding, quantity: q, avg_price: q > 0 ? cost / q : 0 };
    if (holding.quantity <= 0) next.since = trade.traded_at;
  } else {
    next = { ...holding, quantity: Math.max(0, holding.quantity - trade.quantity) };
  }
  const t: Trade = { ...trade, ticker };
  return {
    ...upsertHolding(state, next),
    trades: [...state.trades, t].sort((a, b) => a.traded_at.localeCompare(b.traded_at)),
  };
}

/** 매매 기록 삭제. 보유 수량은 되돌리지 않는다 (기록과 현재 상태를 분리). */
export function removeTrade(state: UserState, tradeId: string): UserState {
  return { ...state, trades: state.trades.filter((t) => t.trade_id !== tradeId) };
}

export function setSettings(state: UserState, patch: Partial<Settings>): UserState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

// ---------- 원칙 변경 이력 / 나만의 원칙 ----------

export function addHistory(state: UserState, entry: PrincipleHistory): UserState {
  return { ...state, principle_history: [...state.principle_history, entry] };
}

export function addCustomPrinciple(state: UserState, custom: CustomPrinciple, now = new Date()): UserState {
  const rest = state.custom_principles.filter((c) => c.principle_id !== custom.principle_id);
  const withCustom = { ...state, custom_principles: [...rest, custom] };
  return adopt(withCustom, { principle_id: custom.principle_id, user_param: null }, now);
}

/** 사용자가 이전 변경에서 직접 쓴 서술 중 가장 최근 것 (명세서 8-3: "지난번엔 이렇게 쓰셨어요") */
export function lastNarrative(state: UserState, principleId?: string): PrincipleHistory | undefined {
  const list = principleId
    ? state.principle_history.filter((h) => h.from_principle === principleId || h.to_principle === principleId)
    : state.principle_history;
  return list.length ? list[list.length - 1] : undefined;
}
