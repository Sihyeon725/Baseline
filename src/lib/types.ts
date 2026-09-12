export type CheckType = 'auto' | 'self';

export interface UserParamSpec {
  key: string;
  label: string;
  unit: string;
  default: number;
  min?: number;
  max?: number;
}

export interface Principle {
  principle_id: string;
  master: string;
  title: string;
  quote: string | null;
  body: string;
  source_book: string;
  check_type: CheckType;
  user_param: UserParamSpec | null;
}

export interface Master {
  id: string;
  name: string;
  name_en: string;
  keywords: string;
  oneliner: string;
  /** 책등(spine) 색. 대가별로 다른 세로 띠 */
  color: string;
}

export interface PrincipleData {
  version: number;
  masters: Master[];
  principles: Principle[];
}

/** 명세서 3.1 adopted_principles */
export interface AdoptedPrinciple {
  principle_id: string;
  source: 'master' | 'custom';
  adopted_at: string; // ISO datetime
  status: 'active' | 'dropped';
  dropped_at?: string;
  params: Record<string, number>;
}

/** 명세서 3.2 holdings */
export type AssetClass = 'index_etf' | 'sector_etf' | 'stock' | 'bond' | 'commodity' | 'cash';
export type Currency = 'KRW' | 'USD';

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  index_etf: '인덱스 ETF',
  sector_etf: '섹터·테마 ETF',
  stock: '개별 주식',
  bond: '채권',
  commodity: '원자재·금',
  cash: '현금',
};

export interface Holding {
  ticker: string;
  name: string;
  asset_class: AssetClass;
  quantity: number;
  avg_price: number;
  currency: Currency;
  /** "왜 아는가" (린치 원칙 채택 시 개별 주식에 필수) */
  why_i_know: string;
  /** 매매 기록 없이 등록한 보유분의 시작 시점 (보유기간 계산용) */
  since: string; // ISO datetime
  /** 시세 캐시에 없는 종목을 위해 직접 입력한 현재가 */
  manual_price?: number;
  manual_price_at?: string;
}

/** 명세서 3.3 trades */
export interface Trade {
  trade_id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  traded_at: string; // ISO datetime
  /** 필수. 근거가 된 원칙 ID 목록 */
  principle_tags: string[];
  note?: string;
}

/** 명세서 3.4 principle_history — 핵심 테이블 */
export interface PrincipleHistory {
  history_id: string;
  changed_at: string;
  from_principle: string | null;
  to_principle: string | null;
  /** 변경 시점의 포트폴리오 수익률(%). 시세가 없으면 null */
  portfolio_return_at_change: number | null;
  answer_what_changed: string;
  answer_why: string;
  answer_tradeoff: string;
  ai_followup_question: string | null;
  ai_followup_answer?: string;
  ai_followup_answered: boolean;
  /** 역질문을 AI가 만들었는지, 규칙 기반 대체였는지 */
  ai_source?: 'claude' | 'fallback';
}

/** 불일치 서술 모드에서 통과해 등록된 "나만의 원칙" */
export interface CustomPrinciple {
  principle_id: string; // custom_*
  title: string;
  body: string;
  created_at: string;
  /** AI 검토 결과 요약 */
  ai_review: string | null;
  ai_source: 'claude' | 'fallback';
}

export interface Settings {
  /** 시세 캐시에 환율이 없을 때 쓰는 USD→KRW 환율 */
  usd_krw: number;
}

/** localStorage 및 백업 파일의 루트 형태 */
export interface UserState {
  schema: 'invest-principles';
  version: 2;
  adopted_principles: AdoptedPrinciple[];
  holdings: Holding[];
  trades: Trade[];
  principle_history: PrincipleHistory[];
  custom_principles: CustomPrinciple[];
  settings: Settings;
  exported_at?: string;
}

/** 시세 캐시 (public/prices/latest.json). 서버 배치가 하루 1회 생성한다 */
export interface PriceQuote {
  close: number;
  /** YYYY-MM-DD 종가 기준일 */
  date: string;
  currency: Currency;
  name?: string;
}

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface PriceSnapshot {
  generated_at: string;
  quotes: Record<string, PriceQuote>;
  /** USD→KRW */
  usd_krw: { rate: number; date: string } | null;
  /** 벤치마크 지수의 일별 종가 (오래된 순) */
  benchmarks: Record<string, { name: string; currency: Currency; series: SeriesPoint[] }>;
}
