import type { AdoptedPrinciple, Principle, UserState } from './types';

export const STORAGE_KEY = 'invest-principles:v1';

export function emptyState(): UserState {
  return { schema: 'invest-principles', version: 1, adopted_principles: [] };
}

/** 외부 입력(localStorage, 가져온 파일)을 검증해 UserState로 만든다. 실패 시 Error. */
export function parseState(raw: unknown): UserState {
  if (typeof raw === 'string') {
    raw = JSON.parse(raw);
  }
  if (!raw || typeof raw !== 'object') throw new Error('객체가 아닙니다');
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== 'invest-principles') throw new Error('이 사이트의 백업 파일이 아닙니다');
  if (obj.version !== 1) throw new Error(`지원하지 않는 버전입니다: ${String(obj.version)}`);
  if (!Array.isArray(obj.adopted_principles)) throw new Error('adopted_principles가 없습니다');

  const adopted: AdoptedPrinciple[] = obj.adopted_principles.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`항목 ${i}이 올바르지 않습니다`);
    const a = item as Record<string, unknown>;
    if (typeof a.principle_id !== 'string' || !a.principle_id) throw new Error(`항목 ${i}: principle_id 없음`);
    if (a.source !== 'master' && a.source !== 'custom') throw new Error(`항목 ${i}: source 오류`);
    if (a.status !== 'active' && a.status !== 'dropped') throw new Error(`항목 ${i}: status 오류`);
    if (typeof a.adopted_at !== 'string' || Number.isNaN(Date.parse(a.adopted_at))) {
      throw new Error(`항목 ${i}: adopted_at 오류`);
    }
    const params: Record<string, number> = {};
    if (a.params && typeof a.params === 'object') {
      for (const [k, v] of Object.entries(a.params as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) params[k] = v;
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

  return { schema: 'invest-principles', version: 1, adopted_principles: adopted };
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
export function adopt(state: UserState, principle: Principle, now = new Date()): UserState {
  const existing = findAdopted(state, principle.principle_id);
  const params: Record<string, number> = existing?.params ?? {};
  if (principle.user_param && params[principle.user_param.key] === undefined) {
    params[principle.user_param.key] = principle.user_param.default;
  }
  const entry: AdoptedPrinciple = {
    principle_id: principle.principle_id,
    source: 'master',
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
