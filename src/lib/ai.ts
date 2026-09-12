/**
 * 명세서 7장 — AI 연동. 호출 지점은 2곳뿐이다.
 *  1. 근거 서술 논리 검토 (불일치 판정 후)
 *  2. 원칙 변경 시 역질문 1회 (서술이 모호할 때만)
 *
 * API 키는 프론트엔드에 없다. /api/review (서버리스 함수 → Gemini API)를 경유한다.
 * 서버가 없거나 실패하면 규칙 기반 대체(fallback)로 동작해 사이트가 멈추지 않는다.
 */
import { COPY } from './copy';

export interface FollowupRequest {
  mode: 'followup';
  from_title: string | null;
  to_title: string | null;
  what: string;
  why: string;
  tradeoff: string;
}

export interface ReviewRequest {
  mode: 'review';
  narrative: string;
  portfolio_summary: string;
  failed_rules: string[];
}

export interface FollowupResult {
  /** null이면 서술이 충분히 분명해 역질문이 필요 없다는 뜻 */
  question: string | null;
  source: 'ai' | 'fallback';
}

export interface ReviewResult {
  /** 논리적으로 일관되어 "나만의 원칙"으로 등록해도 되는지. 옳고 그름 판정이 아니다 */
  consistent: boolean;
  feedback: string;
  /** 일관성이 부족할 때 사용자가 답해볼 질문 */
  questions: string[];
  source: 'ai' | 'fallback';
}

export const AI_ENDPOINT = '/api/review';

const VAGUE = /수익|손실|떨어|올랐|안\s?좋|물렸|빠졌|마이너스|플러스|벌었|잃었/;
const REASONED = /기간|원칙|틀렸|가정|근거|구조|비중|리스크|위험|현금흐름|이해|설명|왜냐|때문/;

/** 서술이 모호한지 규칙으로 판단 (AI 없이). 예: "수익률이 안 좋아서" */
export function fallbackFollowup(req: FollowupRequest): FollowupResult {
  const why = req.why.trim();
  const vague = why.length < 40 || (VAGUE.test(why) && !REASONED.test(why));
  return { question: vague ? COPY.fallbackFollowup : null, source: 'fallback' };
}

export function fallbackReview(req: ReviewRequest): ReviewResult {
  const text = req.narrative.trim();
  const sentences = text.split(/[.!?。]\s*|\n+/).filter((s) => s.trim().length > 4);
  const hasReason = REASONED.test(text);
  const consistent = text.length >= 120 && sentences.length >= 3 && hasReason;
  const questions: string[] = [];
  if (text.length < 120) questions.push('이 구성이 어떤 상황에서 유리하고, 어떤 상황에서 불리한지 한 문장씩 더 써볼까요?');
  if (!hasReason) questions.push('"왜냐하면" 뒤에 올 문장은 무엇인가요?');
  if (req.failed_rules.length) questions.push(`어긋난 규칙(${req.failed_rules.slice(0, 2).join(', ')})을 알면서도 유지하는 이유는 무엇인가요?`);
  return {
    consistent,
    feedback: consistent
      ? 'AI 검토를 사용할 수 없어 기본 점검만 했습니다. 서술의 길이와 구조는 기준을 넘었습니다.'
      : 'AI 검토를 사용할 수 없어 기본 점검만 했습니다. 서술이 아직 짧거나 근거 문장이 보이지 않습니다.',
    questions,
    source: 'fallback',
  };
}

async function post<T>(body: FollowupRequest | ReviewRequest, timeoutMs = 20000): Promise<T | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function askFollowup(req: FollowupRequest): Promise<FollowupResult> {
  const r = await post<{ question: string | null }>(req);
  if (r && (typeof r.question === 'string' || r.question === null)) {
    return { question: r.question, source: 'ai' };
  }
  return fallbackFollowup(req);
}

export async function reviewNarrative(req: ReviewRequest): Promise<ReviewResult> {
  const r = await post<{ consistent: boolean; feedback: string; questions: string[] }>(req);
  if (r && typeof r.consistent === 'boolean' && typeof r.feedback === 'string') {
    return { consistent: r.consistent, feedback: r.feedback, questions: Array.isArray(r.questions) ? r.questions : [], source: 'ai' };
  }
  return fallbackReview(req);
}
