import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { IconArrowLeft } from './Icons';
import { fmtDate } from './Constitution';
import { askFollowup } from '../lib/ai';
import { COPY } from '../lib/copy';
import { looksCopied } from '../lib/similarity';
import { lastNarrative, newId } from '../lib/store';
import { fmtPct } from '../lib/portfolio';
import type { PrincipleData, PrincipleHistory, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  state: UserState;
  fromId: string | null;
  toId: string | null;
  /** 변경 시점의 포트폴리오 수익률(%). 시세 없으면 null */
  returnPct: number | null;
  onCommit: (entry: PrincipleHistory) => void;
  go: (hash: string) => void;
}

type Step = 'write' | 'followup';

/**
 * 명세서 [5]→[6] 원칙 폐기/변경 서술. 3개 답 필수 → AI 역질문 1회 → 저장.
 * 쿨다운·잠금 없음. "그래도 저장"은 1회 모달 뒤 통과시키고 ai_followup_answered=false로 남긴다.
 */
export function ChangeFlow({ data, state, fromId, toId, returnPct, onCommit, go }: Props) {
  const byId = useMemo(() => new Map(data.principles.map((p) => [p.principle_id, p])), [data]);
  const customById = useMemo(() => new Map(state.custom_principles.map((c) => [c.principle_id, c])), [state.custom_principles]);
  const from = fromId ? byId.get(fromId) ?? null : null;
  const to = toId ? byId.get(toId) ?? null : null;
  const fromTitle = fromId ? from?.title ?? customById.get(fromId)?.title ?? fromId : null;
  const toTitle = toId ? to?.title ?? customById.get(toId)?.title ?? toId : null;
  const previous = useMemo(() => lastNarrative(state, fromId ?? undefined), [state, fromId]);

  const [what, setWhat] = useState('');
  const [why, setWhy] = useState('');
  const [tradeoff, setTradeoff] = useState('');
  const [copyNotice, setCopyNotice] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('write');
  const [question, setQuestion] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'ai' | 'fallback'>('fallback');
  const [answer, setAnswer] = useState('');
  const [skipModal, setSkipModal] = useState(false);
  const [skipSeen, setSkipSeen] = useState(false);

  const cardTexts = [from, to].filter(Boolean).flatMap((p) => [p!.title, p!.body, p!.quote ?? '']);

  const heading = !fromId && toId ? '원칙 채택 이유' : fromId && !toId ? '원칙 내려놓기' : '원칙 바꾸기';

  const submitAnswers = async () => {
    setErr(null);
    if (!what.trim() || !why.trim() || !tradeoff.trim()) {
      setErr('세 질문 모두 답해야 저장됩니다.');
      return;
    }
    const text = `${what}\n${why}\n${tradeoff}`;
    if (!copyNotice && looksCopied(text, cardTexts)) {
      setCopyNotice(true);
      return;
    }
    setBusy(true);
    const r = await askFollowup({ mode: 'followup', from_title: fromTitle, to_title: toTitle, what, why, tradeoff });
    setBusy(false);
    setAiSource(r.source);
    if (r.question) {
      setQuestion(r.question);
      setStep('followup');
    } else {
      commit(null, true);
    }
  };

  const commit = (q: string | null, answered: boolean) => {
    const entry: PrincipleHistory = {
      history_id: newId('hist'),
      changed_at: new Date().toISOString(),
      from_principle: fromId,
      to_principle: toId,
      portfolio_return_at_change: returnPct,
      answer_what_changed: what.trim(),
      answer_why: why.trim(),
      answer_tradeoff: tradeoff.trim(),
      ai_followup_question: q,
      ai_followup_answered: answered,
      ai_source: aiSource,
    };
    if (q && answered) entry.ai_followup_answer = answer.trim();
    onCommit(entry);
  };

  const skip = () => {
    if (!skipSeen) {
      setSkipSeen(true);
      setSkipModal(true);
      return;
    }
    commit(question, false);
  };

  return (
    <article className="detail">
      <button type="button" className="backlink" onClick={() => go('#/check')}>
        <IconArrowLeft width={16} height={16} /> 점검으로
      </button>
      <p className="kicker">WHY</p>
      <h1 className="h1">{heading}</h1>
      <p className="change-path">
        <span>{fromTitle ?? '(새로 채택)'}</span>
        <span className="arrow">→</span>
        <span>{toTitle ?? '(내려놓음)'}</span>
      </p>
      <p className="sub">
        변경 시점 수익률 {fmtPct(returnPct)} · 이 값은 이력에 함께 저장됩니다.
      </p>

      {previous && (
        <div className="prev-note">
          <p className="prev-title">{COPY.lastTimeYouWrote}</p>
          <p className="prev-meta">
            {fmtDate(previous.changed_at)} · 수익률 {fmtPct(previous.portfolio_return_at_change)}
          </p>
          <p className="prev-body">{previous.answer_why}</p>
        </div>
      )}

      {step === 'write' && (
        <div className="qa">
          <label className="form-full">
            <span>무엇이 바뀌었나</span>
            <textarea rows={2} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="바뀌는 것을 한 문장으로." />
          </label>
          <label className="form-full">
            <span>왜 바뀌었나</span>
            <textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="결과가 아니라 이유를." />
          </label>
          <label className="form-full">
            <span>새 원칙을 지키면 무엇을 포기하나</span>
            <textarea rows={2} value={tradeoff} onChange={(e) => setTradeoff(e.target.value)} placeholder="얻는 것 말고, 잃는 것을." />
          </label>
          {copyNotice && <p className="notice">{COPY.similarityNotice} 그대로 두려면 한 번 더 누르세요.</p>}
          {err && <p className="form-err" role="alert">{err}</p>}
          <button type="button" className="btn-primary wide" onClick={submitAnswers} disabled={busy}>
            {busy ? '읽는 중…' : '다음'}
          </button>
          <p className="fine">AI는 논리적 일관성만 봅니다. 종목 추천, 매매 지시, 옳고 그름 판정은 하지 않습니다. 이 세 답만 Gemini API로 전달되며, AI를 쓸 수 없으면 기본 질문으로 대체합니다.</p>
        </div>
      )}

      {step === 'followup' && question && (
        <div className="qa">
          <p className="followup-label">역질문 {aiSource === 'fallback' && <em>(AI 미사용 · 기본 질문)</em>}</p>
          <blockquote className="quote">{question}</blockquote>
          <label className="form-full">
            <span>한 줄이면 됩니다</span>
            <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </label>
          <button type="button" className="btn-accent wide" onClick={() => commit(question, true)} disabled={!answer.trim()}>
            {COPY.followupAnswerAndSave}
          </button>
          <button type="button" className="btn-link muted skip-link" onClick={skip}>
            {COPY.followupSkipAndSave}
          </button>
        </div>
      )}

      {skipModal && (
        <Modal onClose={() => setSkipModal(false)}>
          <p className="modal-body">
            {COPY.followupSkipModal.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-accent wide" onClick={() => setSkipModal(false)}>
              한 줄 쓰기
            </button>
            <button
              type="button"
              className="btn-link muted skip-link"
              onClick={() => {
                setSkipModal(false);
                commit(question, false);
              }}
            >
              {COPY.followupSkipAndSave}
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}
