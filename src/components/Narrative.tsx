import { useMemo, useState } from 'react';
import { IconArrowLeft } from './Icons';
import { reviewNarrative, type ReviewResult } from '../lib/ai';
import { COPY } from '../lib/copy';
import { looksCopied } from '../lib/similarity';
import { fmtPct, valuate, weightByAssetClass, type PriceContext } from '../lib/portfolio';
import { evaluateAll, verdict as computeVerdict } from '../lib/rules';
import { ASSET_CLASS_LABEL, type AssetClass, type CustomPrinciple, type PrincipleData, type UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  state: UserState;
  ctx: PriceContext;
  onRegister: (c: CustomPrinciple) => void;
  go: (hash: string) => void;
}

/**
 * 명세서 [6] 불일치 → 근거 서술 모드 → AI 논리 일관성 검토 → 통과 시 "나만의 원칙" 등록.
 */
export function Narrative({ data, state, ctx, onRegister, go }: Props) {
  const now = useMemo(() => new Date(), []);
  const valuation = useMemo(() => valuate(state, ctx), [state, ctx]);
  const results = useMemo(() => evaluateAll(data, { state, valuation, now }), [data, state, valuation, now]);
  const v = useMemo(() => computeVerdict(data, results), [data, results]);
  const failed = results.filter((r) => r.outcome && !r.outcome.pass);
  const cardTexts = data.principles.flatMap((p) => [p.title, p.body, p.quote ?? '']);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [copyNotice, setCopyNotice] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const summary = useMemo(() => {
    const w = weightByAssetClass(valuation);
    const parts = (Object.keys(w) as AssetClass[]).filter((k) => w[k] > 0).map((k) => `${ASSET_CLASS_LABEL[k]} ${Math.round(w[k] * 100)}%`);
    const n = valuation.items.length;
    const trades90 = state.trades.filter((t) => Date.parse(t.traded_at) >= now.getTime() - 90 * 86_400_000).length;
    return `${n}종목 · ${parts.join(', ')} · 최근 90일 매매 ${trades90}회 · 수익률 ${fmtPct(valuation.return_pct)}`;
  }, [valuation, state.trades, now]);

  const submit = async () => {
    setErr(null);
    if (!title.trim()) return setErr('원칙을 한 줄로 요약해 주세요.');
    if (body.trim().length < 40) return setErr('근거를 조금 더 써 주세요. 왜 이렇게 구성했는지, 무엇을 알면서도 유지하는지.');
    if (!copyNotice && looksCopied(`${title}\n${body}`, cardTexts)) {
      setCopyNotice(true);
      return;
    }
    setBusy(true);
    const r = await reviewNarrative({
      mode: 'review',
      narrative: `${title}\n\n${body}`,
      portfolio_summary: summary,
      failed_rules: failed.map((f) => `${f.principle.title} (${f.outcome!.actual}, 기준 ${f.outcome!.threshold})`),
    });
    setBusy(false);
    setResult(r);
  };

  const register = () => {
    if (!result) return;
    onRegister({
      principle_id: `custom_${Date.now().toString(36)}`,
      title: title.trim(),
      body: body.trim(),
      created_at: new Date().toISOString(),
      ai_review: result.feedback,
      ai_source: result.source,
    });
  };

  return (
    <article className="detail">
      <button type="button" className="backlink" onClick={() => go('#/check')}>
        <IconArrowLeft width={16} height={16} /> 점검으로
      </button>
      <p className="kicker">MY OWN PRINCIPLE</p>
      <h1 className="h1">근거 서술</h1>
      {v.type === 'mismatch' ? (
        <p className="lead">{COPY.mismatch(data.masters.length)}</p>
      ) : (
        <p className="lead">지금은 불일치 판정이 아니지만, 그래도 내 구성의 근거를 남길 수 있습니다.</p>
      )}

      <div className="check-box">
        <p className="check-box-title">지금 포트폴리오</p>
        <p className="check-note">{summary}</p>
        {failed.length > 0 && (
          <>
            <p className="check-box-title" style={{ marginTop: 12 }}>
              어긋난 규칙
            </p>
            <ul className="verdict-list">
              {failed.map((f) => (
                <li key={f.principle.principle_id}>
                  {f.principle.title} — {f.outcome!.actual} (기준 {f.outcome!.threshold})
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!result || !result.consistent ? (
        <div className="qa">
          <label className="form-full">
            <span>나의 원칙 (한 줄)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 내가 매달 쓰는 서비스의 회사만 산다." />
          </label>
          <label className="form-full">
            <span>왜 이렇게 구성했나</span>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="전제 → 이유 → 구성. 어긋난 규칙을 알면서도 유지하는 이유까지. 본인의 말로."
            />
          </label>
          {copyNotice && <p className="notice">{COPY.similarityNotice} 그대로 두려면 한 번 더 누르세요.</p>}
          {result && !result.consistent && (
            <div className="review-box">
              <p className="review-title">검토 결과 {result.source === 'fallback' && <em>(AI 미사용 · 기본 점검)</em>}</p>
              <p className="review-body">{result.feedback}</p>
              {result.questions.length > 0 && (
                <ul className="review-q">
                  {result.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
              <p className="fine">옳고 그름이 아니라 문장의 연결만 본 결과입니다. 고쳐 쓰고 다시 검토할 수 있습니다.</p>
            </div>
          )}
          {err && <p className="form-err" role="alert">{err}</p>}
          <button type="button" className="btn-primary wide" onClick={submit} disabled={busy}>
            {busy ? '검토 중…' : result ? '다시 검토' : '논리 일관성 검토'}
          </button>
          <p className="fine">AI는 종목 추천·매매 지시·투자 판단의 옳고 그름 판정을 하지 않습니다. 오직 논리적 일관성만 검토합니다.</p>
        </div>
      ) : (
        <div className="qa">
          <div className="review-box ok">
            <p className="review-title">검토 통과 {result.source === 'fallback' && <em>(AI 미사용 · 기본 점검)</em>}</p>
            <p className="review-body">{result.feedback}</p>
          </div>
          <div className="paper custom-preview">
            <p className="kicker">나만의 원칙</p>
            <p className="prow-title">{title}</p>
            <p className="body">{body}</p>
          </div>
          <button type="button" className="btn-accent wide" onClick={register}>
            나만의 원칙으로 등록
          </button>
          <button type="button" className="btn-link muted skip-link" onClick={() => setResult(null)}>
            고쳐 쓰기
          </button>
        </div>
      )}
    </article>
  );
}
