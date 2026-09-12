/**
 * 명세서 5장 — 규칙 세트 / 일치도.
 *
 * 규칙 ID = 원칙 카드의 principle_id. 카드의 check_type이 'auto'면 여기에 판정식이 있어야 한다.
 * 판정식이 없는 auto 카드는 계산에서 제외되고 화면에 "판정식 없음"으로 표시된다.
 *
 * 규칙은 "원칙과 불일치"까지만 말한다. 매수/매도 지시는 어디에도 쓰지 않는다.
 */
import { holdingDays, openHoldings, tradesSince, weightByAssetClass, type Valuation } from './portfolio';
import type { Principle, PrincipleData, UserState } from './types';

export interface RuleContext {
  state: UserState;
  valuation: Valuation;
  now: Date;
}

export interface RuleOutcome {
  pass: boolean;
  /** 실제 값 (표시용) */
  actual: string;
  /** 기준 (표시용) */
  threshold: string;
  /** 어긋난 경우 무엇이 어긋났는지. 행동 지시 금지 */
  detail: string;
}

export interface RuleDef {
  id: string;
  /** 판정식 설명 (의사코드) */
  formula: string;
  /** 규칙이 참조하는 사용자 파라미터 키 */
  paramKey: string | null;
  defaultParam: number | null;
  evaluate: (ctx: RuleContext, param: number | null) => RuleOutcome;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const RULES: Record<string, RuleDef> = {
  bogle_01: {
    id: 'bogle_01',
    formula: 'index_etf_weight >= P',
    paramKey: 'index_min_weight',
    defaultParam: 60,
    evaluate: (ctx, p) => {
      const P = p ?? 60;
      const w = weightByAssetClass(ctx.valuation).index_etf;
      return {
        pass: w * 100 >= P,
        actual: `인덱스 ETF 비중 ${pct(w)}`,
        threshold: `${P}% 이상`,
        detail: w * 100 >= P ? '' : `인덱스 ETF 비중이 정해둔 하한(${P}%)보다 낮습니다.`,
      };
    },
  },
  bogle_02: {
    id: 'bogle_02',
    formula: 'trades_last_90d <= N',
    paramKey: 'max_trades_90d',
    defaultParam: 6,
    evaluate: (ctx, p) => {
      const N = p ?? 6;
      const n = tradesSince(ctx.state.trades, 90, ctx.now).length;
      return {
        pass: n <= N,
        actual: `최근 90일 매매 ${n}회`,
        threshold: `${N}회 이하`,
        detail: n <= N ? '' : `최근 90일 매매 횟수가 정해둔 상한(${N}회)을 넘었습니다.`,
      };
    },
  },
  lynch_01: {
    id: 'lynch_01',
    formula: '모든 stock 보유에 why_i_know 입력됨',
    paramKey: null,
    defaultParam: null,
    evaluate: (ctx) => {
      const stocks = openHoldings(ctx.state).filter((h) => h.asset_class === 'stock');
      const missing = stocks.filter((h) => !h.why_i_know.trim());
      return {
        pass: missing.length === 0,
        actual: stocks.length === 0 ? '개별 주식 없음' : `${stocks.length}종목 중 ${stocks.length - missing.length}종목 기록`,
        threshold: '개별 주식 전부',
        detail: missing.length === 0 ? '' : `"왜 아는가"가 비어 있는 종목: ${missing.map((h) => h.name || h.ticker).join(', ')}`,
      };
    },
  },
  buffett_01: {
    id: 'buffett_01',
    formula: '보유 종목 수 <= N',
    paramKey: 'max_holdings',
    defaultParam: 10,
    evaluate: (ctx, p) => {
      const N = p ?? 10;
      const n = openHoldings(ctx.state).filter((h) => h.asset_class !== 'cash').length;
      return {
        pass: n <= N,
        actual: `보유 ${n}종목`,
        threshold: `${N}종목 이하`,
        detail: n <= N ? '' : `보유 종목 수가 정해둔 상한(${N}개)을 넘었습니다.`,
      };
    },
  },
  buffett_02: {
    id: 'buffett_02',
    formula: '평균 보유기간 >= D일',
    paramKey: 'min_holding_days',
    defaultParam: 365,
    evaluate: (ctx, p) => {
      const D = p ?? 365;
      const hs = openHoldings(ctx.state).filter((h) => h.asset_class !== 'cash');
      if (hs.length === 0) return { pass: true, actual: '보유 종목 없음', threshold: `${D}일 이상`, detail: '' };
      const avg = hs.reduce((s, h) => s + holdingDays(h, ctx.state.trades, ctx.now), 0) / hs.length;
      return {
        pass: avg >= D,
        actual: `평균 보유 ${Math.round(avg)}일`,
        threshold: `${D}일 이상`,
        detail: avg >= D ? '' : `평균 보유기간이 정해둔 기준(${D}일)에 아직 못 미칩니다.`,
      };
    },
  },
  dalio_01: {
    id: 'dalio_01',
    formula: '보유 asset_class 종류 >= N',
    paramKey: 'min_asset_classes',
    defaultParam: 3,
    evaluate: (ctx, p) => {
      const N = p ?? 3;
      const kinds = new Set(openHoldings(ctx.state).map((h) => h.asset_class));
      return {
        pass: kinds.size >= N,
        actual: `자산군 ${kinds.size}종류`,
        threshold: `${N}종류 이상`,
        detail: kinds.size >= N ? '' : `보유 자산군 종류가 정해둔 기준(${N}종류)보다 적습니다.`,
      };
    },
  },
};

export interface RuleResult {
  principle: Principle;
  rule: RuleDef | null;
  /** 판정식이 없거나 포트폴리오가 비어 있으면 null */
  outcome: RuleOutcome | null;
  /** 이 원칙을 현재 채택 중인지 */
  adopted: boolean;
  param: number | null;
}

function paramFor(state: UserState, p: Principle, rule: RuleDef): number | null {
  const key = rule.paramKey ?? p.user_param?.key ?? null;
  if (!key) return null;
  const a = state.adopted_principles.find((x) => x.principle_id === p.principle_id);
  if (a && a.params[key] !== undefined) return a.params[key];
  if (p.user_param && p.user_param.key === key) return p.user_param.default;
  return rule.defaultParam;
}

/** 모든 auto 원칙을 평가한다. 채택 여부와 무관 (대가별 일치도 계산용). */
export function evaluateAll(data: PrincipleData, ctx: RuleContext): RuleResult[] {
  const empty = openHoldings(ctx.state).length === 0;
  return data.principles
    .filter((p) => p.check_type === 'auto')
    .map((p) => {
      const rule = RULES[p.principle_id] ?? null;
      const adopted = ctx.state.adopted_principles.some((a) => a.principle_id === p.principle_id && a.status === 'active');
      if (!rule || empty) return { principle: p, rule, outcome: null, adopted, param: null };
      const param = paramFor(ctx.state, p, rule);
      return { principle: p, rule, outcome: rule.evaluate(ctx, param), adopted, param };
    });
}

export interface MasterScore {
  master: string;
  total: number;
  passed: number;
  /** 0~100. total이 0이면 null */
  score: number | null;
  failed: RuleResult[];
}

/** 명세서 5.2: 대가 M의 일치도 = 충족한 auto 규칙 수 / M의 전체 auto 규칙 수 × 100 */
export function masterScores(data: PrincipleData, results: RuleResult[]): MasterScore[] {
  return data.masters.map((m) => {
    const mine = results.filter((r) => r.principle.master === m.id && r.outcome !== null);
    const passed = mine.filter((r) => r.outcome!.pass);
    return {
      master: m.id,
      total: mine.length,
      passed: passed.length,
      score: mine.length ? Math.round((passed.length / mine.length) * 100) : null,
      failed: mine.filter((r) => !r.outcome!.pass),
    };
  });
}

export type VerdictType = 'empty' | 'match' | 'partial' | 'mismatch';

export interface Verdict {
  type: VerdictType;
  /** 가장 가까운 대가 (점수 동률이면 규칙 수가 많은 쪽) */
  best: MasterScore | null;
  scores: MasterScore[];
}

export const MATCH_THRESHOLD = 70;
export const PARTIAL_THRESHOLD = 40;

/** 명세서 5.3 기준치 */
export function verdict(data: PrincipleData, results: RuleResult[]): Verdict {
  const scores = masterScores(data, results);
  const scored = scores.filter((s) => s.score !== null);
  if (scored.length === 0) return { type: 'empty', best: null, scores };
  const best = [...scored].sort((a, b) => b.score! - a.score! || b.total - a.total)[0];
  const type: VerdictType = best.score! >= MATCH_THRESHOLD ? 'match' : best.score! >= PARTIAL_THRESHOLD ? 'partial' : 'mismatch';
  return { type, best, scores };
}

/** 모순: 채택 중인 auto 원칙 중 어긋난 것. "원칙과 불일치"까지만 말한다 */
export function contradictions(results: RuleResult[]): RuleResult[] {
  return results.filter((r) => r.adopted && r.outcome !== null && !r.outcome.pass);
}

/** 대체 원칙 추천: 채택하지 않았고 현재 포폴이 이미 충족하는 auto 원칙 (종목 추천이 아니라 원칙 추천) */
export function alternatives(results: RuleResult[], forMaster?: string): RuleResult[] {
  return results.filter(
    (r) => !r.adopted && r.outcome !== null && r.outcome.pass && (forMaster ? r.principle.master === forMaster : true),
  );
}
