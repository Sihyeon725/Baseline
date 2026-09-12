/**
 * 명세서 8-1: 서술이 원칙 카드 원문과 지나치게 비슷한지 단순 문자열 비교로 확인한다. AI 불필요.
 * 한글은 어절 경계가 흐리므로 문자 바이그램 자카드 유사도를 쓴다.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** 0~1. 한쪽이 너무 짧으면 0 */
export function bigramSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length < 6 || nb.length < 6) return 0;
  const A = bigrams(na);
  const B = bigrams(nb);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 긴 카드 본문 속에 짧은 서술이 그대로 들어 있는 경우 (부분 복사) */
export function containment(text: string, source: string): number {
  const nt = normalize(text);
  const ns = normalize(source);
  if (nt.length < 8) return 0;
  const T = bigrams(nt);
  const S = bigrams(ns);
  let inter = 0;
  for (const g of T) if (S.has(g)) inter += 1;
  return T.size === 0 ? 0 : inter / T.size;
}

export const SIMILARITY_THRESHOLD = 0.6;

/** 카드 문장(title+body+quote)들과 비교해 지나치게 비슷하면 true */
export function looksCopied(text: string, sources: string[]): boolean {
  return sources.some((s) => bigramSimilarity(text, s) >= SIMILARITY_THRESHOLD || containment(text, s) >= 0.85);
}
