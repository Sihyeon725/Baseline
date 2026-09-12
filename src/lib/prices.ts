import type { PriceSnapshot } from './types';

export const PRICES_URL = `${import.meta.env.BASE_URL}prices/latest.json`;

/**
 * 서버 배치가 만든 종가 캐시를 읽는다. 사용자가 접속할 때마다 시세 API를 부르지 않는다 (명세서 6.2).
 * 실패하면 null — 화면은 평단가 기준으로 동작한다.
 */
export async function loadPriceSnapshot(url = PRICES_URL): Promise<PriceSnapshot | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<PriceSnapshot>;
    if (!json || typeof json !== 'object' || typeof json.generated_at !== 'string' || !json.quotes) return null;
    return {
      generated_at: json.generated_at,
      quotes: json.quotes,
      usd_krw: json.usd_krw ?? null,
      benchmarks: json.benchmarks ?? {},
    };
  } catch {
    return null;
  }
}

/** "9월 11일 종가 기준" 형태 */
export function fmtAsOf(date: string | null): string {
  if (!date) return '시세 없음 · 평단가 기준';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return `${date} 종가 기준`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 종가 기준`;
}
