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

/** localStorage 및 백업 파일의 루트 형태 */
export interface UserState {
  schema: 'invest-principles';
  version: 1;
  adopted_principles: AdoptedPrinciple[];
  exported_at?: string;
}
