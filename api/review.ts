/**
 * 명세서 7장 — AI 연동 서버리스 함수 (Vercel Functions).
 *
 * 프론트엔드에는 API 키가 없다. 이 함수만 ANTHROPIC_API_KEY를 읽는다.
 * 호출 지점 2곳: mode=followup (원칙 변경 역질문 1회), mode=review (근거 서술 논리 검토).
 *
 * 절대 금지 (시스템 프롬프트에 명시): 종목 추천, 매수/매도 지시, 투자 판단의 옳고 그름 판정.
 * 오직 논리적 일관성만 검토한다.
 *
 * 환경 변수:
 *   ANTHROPIC_API_KEY   필수
 *   ANTHROPIC_MODEL     선택 (기본 claude-opus-5)
 *   AI_PER_IP_PER_HOUR  선택 (기본 12)
 *   AI_GLOBAL_PER_DAY   선택 (기본 400) — 키 노출·남용 시 요금 사고 방지용 전체 상한
 *   AI_DISABLED=1       선택 — 함수 즉시 503 (클라이언트는 규칙 기반 대체로 동작)
 */
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
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
- 한국어로, 짧고 담백하게 쓴다. 존댓말.`;

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

const FOLLOWUP_SCHEMA = {
  type: 'object',
  properties: { question: { type: ['string', 'null'] } },
  required: ['question'],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    consistent: { type: 'boolean' },
    feedback: { type: 'string' },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['consistent', 'feedback', 'questions'],
  additionalProperties: false,
};

function clip(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_FIELD) : '';
}

function textOf(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (process.env.AI_DISABLED === '1' || !process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'disabled' });

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'body' });

  const client = new Anthropic();

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
      const out = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: 'text', text: FOLLOWUP_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: FOLLOWUP_SCHEMA } },
        messages: [{ role: 'user', content: user }],
      });
      if (out.stop_reason === 'refusal') return res.status(502).json({ error: 'refusal' });
      const parsed = JSON.parse(textOf(out)) as { question: string | null };
      return res.status(200).json({ question: typeof parsed.question === 'string' && parsed.question.trim() ? parsed.question.trim() : null });
    }

    if (body.mode === 'review') {
      const failed = Array.isArray(body.failed_rules) ? body.failed_rules.map(clip).filter(Boolean).slice(0, 12) : [];
      const user = [
        `[포트폴리오 요약]\n${clip(body.portfolio_summary)}`,
        `[어긋난 규칙]\n${failed.length ? failed.map((f) => `- ${f}`).join('\n') : '(없음)'}`,
        `[사용자 서술]\n${clip(body.narrative)}`,
      ].join('\n\n');
      const out = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [{ type: 'text', text: REVIEW_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
        messages: [{ role: 'user', content: user }],
      });
      if (out.stop_reason === 'refusal') return res.status(502).json({ error: 'refusal' });
      const parsed = JSON.parse(textOf(out)) as { consistent: boolean; feedback: string; questions: string[] };
      return res.status(200).json({
        consistent: parsed.consistent === true,
        feedback: String(parsed.feedback ?? ''),
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
      });
    }

    return res.status(400).json({ error: 'mode' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'upstream_rate' });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'auth' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: 'upstream', status: e.status });
    return res.status(500).json({ error: 'internal' });
  }
}
