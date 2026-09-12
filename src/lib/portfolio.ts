import type { AssetClass, Currency, Holding, PriceQuote, PriceSnapshot, SeriesPoint, Trade, UserState } from './types';

/** 평가에 필요한 시세 문맥. 스냅샷이 없어도(v1) 동작한다. */
export interface PriceContext {
  quotes: Record<string, PriceQuote>;
  usdKrw: number;
  /** 시세 캐시의 기준 시각. 없으면 null */
  asOf: string | null;
  /** 환율이 캐시에서 왔는지 사용자 설정값인지 */
  fxSource: 'cache' | 'setting';
}

export function buildPriceContext(snapshot: PriceSnapshot | null, settingUsdKrw: number): PriceContext {
  if (!snapshot) return { quotes: {}, usdKrw: settingUsdKrw, asOf: null, fxSource: 'setting' };
  // 기준일은 배치 실행 시각이 아니라 종가 날짜 중 가장 최근 것으로 표시한다
  const latestQuoteDate = Object.values(snapshot.quotes).reduce<string | null>((acc, q) => (!acc || q.date > acc ? q.date : acc), null);
  return {
    quotes: snapshot.quotes,
    usdKrw: snapshot.usd_krw?.rate ?? settingUsdKrw,
    asOf: latestQuoteDate ?? snapshot.generated_at,
    fxSource: snapshot.usd_krw ? 'cache' : 'setting',
  };
}

export type PriceSource = 'close' | 'manual' | 'cost';

export interface PricedHolding {
  holding: Holding;
  price: number;
  priceSource: PriceSource;
  priceDate: string | null;
  value_krw: number;
  cost_krw: number;
  /** 총 평가액 대비 비중 (0~1) */
  weight: number;
  /** 평단가 대비 수익률(%). 시세가 없으면 null */
  return_pct: number | null;
}

export interface Valuation {
  items: PricedHolding[];
  total_value_krw: number;
  total_cost_krw: number;
  /** 전체 수익률(%). 시세가 하나도 없으면 null */
  return_pct: number | null;
  /** 시세(종가 또는 직접 입력)가 있는 종목 수 */
  priced_count: number;
  asOf: string | null;
}

export function toKRW(amount: number, currency: Currency, usdKrw: number): number {
  return currency === 'USD' ? amount * usdKrw : amount;
}

export function resolvePrice(h: Holding, ctx: PriceContext): { price: number; source: PriceSource; date: string | null } {
  const q = ctx.quotes[h.ticker];
  if (q && q.currency === h.currency) return { price: q.close, source: 'close', date: q.date };
  if (h.manual_price !== undefined && h.manual_price > 0) {
    return { price: h.manual_price, source: 'manual', date: h.manual_price_at ?? null };
  }
  return { price: h.avg_price, source: 'cost', date: null };
}

/** 수량이 0보다 큰 보유 종목만 */
export function openHoldings(state: UserState): Holding[] {
  return state.holdings.filter((h) => h.quantity > 0);
}

export function valuate(state: UserState, ctx: PriceContext): Valuation {
  const items: PricedHolding[] = openHoldings(state).map((h) => {
    const { price, source, date } = resolvePrice(h, ctx);
    const value_krw = toKRW(price * h.quantity, h.currency, ctx.usdKrw);
    const cost_krw = toKRW(h.avg_price * h.quantity, h.currency, ctx.usdKrw);
    return {
      holding: h,
      price,
      priceSource: source,
      priceDate: date,
      value_krw,
      cost_krw,
      weight: 0,
      return_pct: source === 'cost' || h.avg_price <= 0 ? null : ((price - h.avg_price) / h.avg_price) * 100,
    };
  });
  const total_value_krw = items.reduce((s, i) => s + i.value_krw, 0);
  const total_cost_krw = items.reduce((s, i) => s + i.cost_krw, 0);
  for (const i of items) i.weight = total_value_krw > 0 ? i.value_krw / total_value_krw : 0;
  items.sort((a, b) => b.value_krw - a.value_krw);
  const priced_count = items.filter((i) => i.priceSource !== 'cost').length;
  return {
    items,
    total_value_krw,
    total_cost_krw,
    return_pct: priced_count > 0 && total_cost_krw > 0 ? ((total_value_krw - total_cost_krw) / total_cost_krw) * 100 : null,
    priced_count,
    asOf: ctx.asOf,
  };
}

export function weightByAssetClass(v: Valuation): Record<AssetClass, number> {
  const out: Record<AssetClass, number> = { index_etf: 0, sector_etf: 0, stock: 0, bond: 0, commodity: 0, cash: 0 };
  for (const i of v.items) out[i.holding.asset_class] += i.weight;
  return out;
}

const DAY = 86_400_000;

/** 보유 시작일: 수량이 0에서 양수로 바뀐 마지막 매수 시점, 없으면 holding.since */
export function holdingStart(h: Holding, trades: Trade[]): string {
  const mine = trades.filter((t) => t.ticker === h.ticker).sort((a, b) => a.traded_at.localeCompare(b.traded_at));
  let qty = 0;
  let start: string | null = null;
  for (const t of mine) {
    if (t.side === 'buy') {
      if (qty <= 0) start = t.traded_at;
      qty += t.quantity;
    } else {
      qty -= t.quantity;
      if (qty <= 0) start = null;
    }
  }
  return start ?? h.since;
}

export function holdingDays(h: Holding, trades: Trade[], now = new Date()): number {
  const start = Date.parse(holdingStart(h, trades));
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / DAY));
}

export function tradesSince(trades: Trade[], days: number, now = new Date()): Trade[] {
  const cutoff = now.getTime() - days * DAY;
  return trades.filter((t) => Date.parse(t.traded_at) >= cutoff);
}

// ---------- 원칙별 성과 (내 기록) ----------

export interface PrinciplePerformance {
  principle_id: string;
  trade_count: number;
  buy_count: number;
  invested_krw: number;
  /** 매수분의 현재 평가액 + 매도분의 실현 금액 */
  value_krw: number;
  /** 시세 없는 매수가 섞여 있으면 null */
  return_pct: number | null;
  unpriced: number;
}

/**
 * 원칙 태그별로 그 원칙을 근거로 한 매매의 결과를 모은다.
 * - 매수: 매수 금액 → 현재가 기준 평가액
 * - 매도: 보유 평단가 기준 원가 → 매도 금액 (실현)
 * "이 원칙이 좋다/나쁘다"가 아니라 내 기록일 뿐이다. 표본이 작으면 결론이 아니다.
 */
export function principlePerformance(state: UserState, ctx: PriceContext): PrinciplePerformance[] {
  const byTicker = new Map(state.holdings.map((h) => [h.ticker, h]));
  const acc = new Map<string, PrinciplePerformance>();
  for (const t of state.trades) {
    const h = byTicker.get(t.ticker);
    const currency: Currency = h?.currency ?? 'KRW';
    for (const tag of t.principle_tags) {
      const p = acc.get(tag) ?? {
        principle_id: tag,
        trade_count: 0,
        buy_count: 0,
        invested_krw: 0,
        value_krw: 0,
        return_pct: null,
        unpriced: 0,
      };
      p.trade_count += 1;
      if (t.side === 'buy') {
        p.buy_count += 1;
        p.invested_krw += toKRW(t.price * t.quantity, currency, ctx.usdKrw);
        if (h) {
          const r = resolvePrice(h, ctx);
          if (r.source === 'cost') p.unpriced += 1;
          p.value_krw += toKRW(r.price * t.quantity, currency, ctx.usdKrw);
        } else {
          p.unpriced += 1;
          p.value_krw += toKRW(t.price * t.quantity, currency, ctx.usdKrw);
        }
      } else {
        const cost = h ? h.avg_price : t.price;
        p.invested_krw += toKRW(cost * t.quantity, currency, ctx.usdKrw);
        p.value_krw += toKRW(t.price * t.quantity, currency, ctx.usdKrw);
      }
      acc.set(tag, p);
    }
  }
  for (const p of acc.values()) {
    p.return_pct = p.unpriced === 0 && p.invested_krw > 0 ? ((p.value_krw - p.invested_krw) / p.invested_krw) * 100 : null;
  }
  return [...acc.values()].sort((a, b) => b.trade_count - a.trade_count);
}

// ---------- 벤치마크 비교 ----------

export interface BenchmarkComparison {
  key: string;
  name: string;
  /** 비교에 포함된 매수 금액(원) */
  invested_krw: number;
  /** 같은 날 같은 금액을 지수에 넣었다면 지금 얼마인가 */
  hypothetical_value_krw: number;
  return_pct: number | null;
  covered_trades: number;
  total_buy_trades: number;
  latest_date: string | null;
}

/** date 이전(포함)의 마지막 종가 */
export function closeOnOrBefore(series: SeriesPoint[], date: string): SeriesPoint | null {
  let found: SeriesPoint | null = null;
  for (const p of series) {
    if (p.date <= date) found = p;
    else break;
  }
  return found;
}

/**
 * 각 매수 건과 같은 날 같은 원화 금액을 벤치마크 지수에 넣었다면의 가정 평가액.
 * 지수는 현지 통화 수익률만 반영한다 (환율 변동은 무시). 화면에 명시할 것.
 */
export function benchmarkComparison(state: UserState, ctx: PriceContext, snapshot: PriceSnapshot | null): BenchmarkComparison[] {
  if (!snapshot) return [];
  const byTicker = new Map(state.holdings.map((h) => [h.ticker, h]));
  const buys = state.trades.filter((t) => t.side === 'buy');
  return Object.entries(snapshot.benchmarks).map(([key, b]) => {
    const latest = b.series.length ? b.series[b.series.length - 1] : null;
    let invested = 0;
    let hypo = 0;
    let covered = 0;
    if (latest) {
      for (const t of buys) {
        const day = t.traded_at.slice(0, 10);
        const at = closeOnOrBefore(b.series, day);
        if (!at) continue;
        const currency = byTicker.get(t.ticker)?.currency ?? 'KRW';
        const amt = toKRW(t.price * t.quantity, currency, ctx.usdKrw);
        invested += amt;
        hypo += amt * (latest.close / at.close);
        covered += 1;
      }
    }
    return {
      key,
      name: b.name,
      invested_krw: invested,
      hypothetical_value_krw: hypo,
      return_pct: invested > 0 ? ((hypo - invested) / invested) * 100 : null,
      covered_trades: covered,
      total_buy_trades: buys.length,
      latest_date: latest?.date ?? null,
    };
  });
}

/** 벤치마크와 같은 기준으로 계산한 내 매수 건들의 현재 수익률 (매수 기록 기준, 시세 있는 것만) */
export function tradesReturn(state: UserState, ctx: PriceContext): { invested_krw: number; value_krw: number; return_pct: number | null; covered: number } {
  const byTicker = new Map(state.holdings.map((h) => [h.ticker, h]));
  let invested = 0;
  let value = 0;
  let covered = 0;
  for (const t of state.trades) {
    if (t.side !== 'buy') continue;
    const h = byTicker.get(t.ticker);
    if (!h) continue;
    const r = resolvePrice(h, ctx);
    if (r.source === 'cost') continue;
    invested += toKRW(t.price * t.quantity, h.currency, ctx.usdKrw);
    value += toKRW(r.price * t.quantity, h.currency, ctx.usdKrw);
    covered += 1;
  }
  return { invested_krw: invested, value_krw: value, return_pct: invested > 0 ? ((value - invested) / invested) * 100 : null, covered };
}

// ---------- 표시 ----------

export function fmtKRW(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}억원`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString('ko-KR')}만원`;
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
}

export function fmtPrice(n: number, currency: Currency): string {
  return currency === 'USD'
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 수익률: 부호만 남기고 색은 쓰지 않는다 (docs/DESIGN_RULES.md) */
export function fmtPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}
