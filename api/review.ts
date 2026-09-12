/**
 * 명세서 7장 — AI 연동 서버리스 함수 (Vercel Functions). Gemini API 사용.
 *
 * 프론트엔드에는 API 키가 없다. 이 함수만 GEMINI_API_KEY를 읽는다.
 * 호출 지점 2곳: mode=followup (원칙 변경 역질문 1회), mode=review (근거 서술 논리 검토).
 *
 * 절대 금지 (시스템 프롬프트에 명시): 종목 추천, 매수/매도 지시, 투자 판단의 옳고 그름 판정.
 * 오직 논리적 일관성만 검토한다.
 *
 * 환경 변수:
 *   GEMINI_API_KEY      필수 (Google AI Studio에서 발급. 무료 등급은 호출 수 제한 + 입력 데이터가 학습에 쓰일 수 있음)
 *   GEMINI_MODEL        선택 (기본 gemini-3.8-flash). 계정에 없으면 ListModels로 flash 계열을 자동 선택
 *   AI_PER_IP_PER_HOUR  선택 (기본 12)
 *   AI_GLOBAL_PER_DAY   선택 (기본 400) — 무료 한도 초과·남용 방지용 전체 상한
 *   AI_DISABLED=1       선택 — 함수 즉시 503 (클라이언트는 규칙 기반 대체로 동작)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** 우선 쓸 모델. 계정에서 안 보이면(404) ListModels로 사용 가능한 flash 계열을 자동 선택한다 */
const PREFERRED_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
let resolvedModel: string | null = null;
let availableModels: string[] = [];
/** 목록에는 있지만 호출하면 404가 나는(폐기된) 모델 */
const failedModels = new Set<string>();
const PER_IP = Number(process.env.AI_PER_IP_PER_HOUR ?? 12);
const GLOBAL_PER_DAY = Number(process.env.AI_GLOBAL_PER_DAY ?? 400);
const MAX_FIELD = 2000;

// 서버리스 인스턴스 단위의 간이 상한. 완벽하지 않지만 키 유출 없이도 폭주를 늦춘다.
const ipHits = new Map<string, number[]>();
let dayKey = '';
let dayCount = 0;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= GLOBAL_PER_DAY) return true;
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= PER_IP) return true;
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount += 1;
  return false;
}

const RULES_KO = `당신은 투자 원칙 기록 사이트의 "논리 일관성 검토자"입니다.
반드시 지킬 것:
- 특정 종목을 추천하지 않는다. 종목명, 자산군, 시장을 사거나 팔라고 말하지 않는다.
- 매수/매도/보유 등 어떤 행동도 지시하지 않는다. "~하세요"류 투자 조언 금지.
- 사용자의 투자 판단이 옳은지 그른지, 좋은지 나쁜지 판정하지 않는다. 수익 전망도 말하지 않는다.
- 오직 사용자가 쓴 글의 논리적 일관성만 본다: 전제와 결론이 이어지는가, 이유가 결과를 설명하는가, 서로 모순되는 문장은 없는가, 빠진 고리는 무엇인가.
- 사용자를 비난하거나 판정하는 말투를 쓰지 않는다. 행동이 아니라 문장을 다룬다.
- 한국어로, 짧고 담백하게 쓴다. 존댓말.
- 반드시 지정된 JSON 형식으로만 답한다.`;

const FOLLOWUP_SYSTEM = `${RULES_KO}

과제: 사용자가 투자 원칙을 바꾸거나 내려놓으며 쓴 세 가지 답(무엇이 바뀌었나 / 왜 바뀌었나 / 새 원칙을 지키면 무엇을 포기하나)을 읽고,
서술이 모호하거나 이유가 결과만 가리킬 때("수익률이 안 좋아서" 등) 딱 한 개의 역질문을 만든다.
역질문은 사용자가 스스로 구분하게 만드는 질문이어야 한다. 예: "원칙이 틀렸다고 보시나요, 아니면 적용한 기간이 짧았다고 보시나요?"
서술이 이미 구체적이고 전제-이유-포기가 이어지면 question을 null로 둔다. 역질문은 최대 1개, 60자 이내.`;

const REVIEW_SYSTEM = `${RULES_KO}

과제: 사용자의 포트폴리오가 이 사이트에 정리된 대가들의 규칙 어느 것과도 맞지 않아, 사용자가 "왜 이렇게 구성했는지"를 직접 썼다.
이 서술이 논리적으로 일관된지만 검토한다.
- consistent: 전제→이유→구성이 이어지고, 어긋난 규칙을 알면서도 유지하는 이유가 서술 안에 있으면 true. 포트폴리오의 위험이나 기대수익은 판단 기준이 아니다.
- feedback: 2~3문장. 어디가 이어지고 어디가 끊기는지만. 칭찬·비난·조언 금지.
- questions: consistent가 false일 때 사용자가 답해볼 질문 1~3개. true면 빈 배열.`;

// Gemini responseSchema (OpenAPI 서브셋). null 허용은 nullable로 표현한다.
const FOLLOWUP_SCHEMA = {
  type: 'OBJECT',
  properties: { question: { type: 'STRING', nullable: true } },
  required: ['question'],
};

const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    consistent: { type: 'BOOLEAN' },
    feedback: { type: 'STRING' },
    questions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['consistent', 'feedback', 'questions'],
};

function clip(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : '';
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const EXCLUDE = /lite|preview|exp|tts|image|live|embedding|audio|thinking|vision|8b|1\.5|1\.0/i;

/** 계정에서 쓸 수 있는 모델 목록을 받아 generateContent 지원 flash 계열 중 가장 최신 버전을 고른다 */
async function resolveModel(apiKey: string, force = false): Promise<string> {
  if (resolvedModel && !force) return resolvedModel;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: { message?: string } };
  if (!res.ok) throw new GeminiError(res.status, json.error?.message ?? 'list models failed');
  const usable = (json.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  availableModels = usable;
  const ok = usable.filter((n) => !failedModels.has(n));
  if (ok.includes(PREFERRED_MODEL)) return (resolvedModel = PREFERRED_MODEL);
  const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  const flash = ok.filter((n) => /gemini-\d/.test(n) && /flash/.test(n) && !EXCLUDE.test(n)).sort((a, b) => version(b) - version(a) || a.length - b.length);
  const any = ok.filter((n) => /gemini-\d/.test(n) && !EXCLUDE.test(n)).sort((a, b) => version(b) - version(a) || a.length - b.length);
  const pick = flash[0] ?? any[0] ?? ok[0];
  if (!pick) throw new GeminiError(502, 'no usable model');
  return (resolvedModel = pick);
}

async function generateJson<T>(system: string, user: string, schema: unknown, apiKey: string, retries = 3): Promise<T> {
  const model = await resolveModel(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (res.status === 404 && retries > 0) {
    // 목록에는 있지만 폐기된 모델: 제외하고 다음 후보로 재시도
    failedModels.add(model);
    await resolveModel(apiKey, true);
    return generateJson<T>(system, user, schema, apiKey, retries - 1);
  }
  if (!res.ok) throw new GeminiError(res.status, json.error?.message ?? `HTTP ${res.status}`);
  if (json.promptFeedback?.blockReason) throw new GeminiError(502, `blocked: ${json.promptFeedback.blockReason}`);
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new GeminiError(502, 'empty response');
  return JSON.parse(text) as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.GEMINI_API_KEY;
  if (process.env.AI_DISABLED === '1' || !apiKey) return res.status(503).json({ error: 'disabled' });
  if (req.method === 'GET') {
    // 진단용: 어떤 모델이 잡혔는지 (키는 노출하지 않는다)
    try {
      const model = await resolveModel(apiKey);
      return res.status(200).json({ model, preferred: PREFERRED_MODEL, failed: [...failedModels], available: availableModels });
    } catch (e) {
      return res.status(502).json({ error: e instanceof GeminiError ? e.message : 'internal' });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  let body: Record<string, unknown> | undefined;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined;
  } catch {
    return res.status(400).json({ error: 'body' });
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'body' });

  try {
    if (body.mode === 'followup') {
      const user = [
        `이전 원칙: ${clip(body.from_title) || '(없음 — 새로 채택)'}`,
        `새 원칙: ${clip(body.to_title) || '(없음 — 내려놓음)'}`,
        '',
        `[무엇이 바뀌었나]\n${clip(body.what)}`,
        `[왜 바뀌었나]\n${clip(body.why)}`,
        `[새 원칙을 지키면 무엇을 포기하나]\n${clip(body.tradeoff)}`,
      ].join('\n');
      const parsed = await generateJson<{ question: string | null }>(FOLLOWUP_SYSTEM, user, FOLLOWUP_SCHEMA, apiKey);
      const q = typeof parsed.question === 'string' ? parsed.question.trim() : '';
      return res.status(200).json({ question: q && q.toLowerCase() !== 'null' ? q : null });
    }

    if (body.mode === 'review') {
      const failed = Array.isArray(body.failed_rules) ? body.failed_rules.map(clip).filter(Boolean).slice(0, 12) : [];
      const user = [
        `[포트폴리오 요약]\n${clip(body.portfolio_summary)}`,
        `[어긋난 규칙]\n${failed.length ? failed.map((f) => `- ${f}`).join('\n') : '(없음)'}`,
        `[사용자 서술]\n${clip(body.narrative)}`,
      ].join('\n\n');
      const parsed = await generateJson<{ consistent: boolean; feedback: string; questions: string[] }>(REVIEW_SYSTEM, user, REVIEW_SCHEMA, apiKey);
      return res.status(200).json({
        consistent: parsed.consistent === true,
        feedback: String(parsed.feedback ?? ''),
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
      });
    }

    return res.status(400).json({ error: 'mode' });
  } catch (e) {
    if (e instanceof GeminiError) {
      if (e.status === 429) return res.status(429).json({ error: 'upstream_rate' });
      if (e.status === 401 || e.status === 403) return res.status(503).json({ error: 'auth' });
      return res.status(502).json({ error: 'upstream', status: e.status, detail: e.message.slice(0, 300) });
    }
    return res.status(500).json({ error: 'internal' });
  }
}
