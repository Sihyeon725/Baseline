import { useMemo } from 'react';
import { fmtDate } from './Constitution';
import { COPY } from '../lib/copy';
import { fmtPct, fmtPrice } from '../lib/portfolio';
import type { PrincipleData, PrincipleHistory, Trade, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  state: UserState;
  go: (hash: string) => void;
}

type Item =
  | { kind: 'change'; at: string; h: PrincipleHistory }
  | { kind: 'adopt'; at: string; id: string }
  | { kind: 'drop'; at: string; id: string }
  | { kind: 'trade'; at: string; t: Trade }
  | { kind: 'custom'; at: string; id: string };

/** 명세서 v3 — 변경 이력 타임라인. 원칙 변경·채택·매매를 시간순으로. */
export function History({ data, state, go }: Props) {
  const byId = useMemo(() => new Map(data.principles.map((p) => [p.principle_id, p])), [data]);
  const customById = useMemo(() => new Map(state.custom_principles.map((c) => [c.principle_id, c])), [state.custom_principles]);
  const titleOf = (id: string | null) => (id ? byId.get(id)?.title ?? customById.get(id)?.title ?? id : null);
  const holdingOf = (ticker: string) => state.holdings.find((h) => h.ticker === ticker);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const h of state.principle_history) out.push({ kind: 'change', at: h.changed_at, h });
    for (const a of state.adopted_principles) {
      out.push({ kind: 'adopt', at: a.adopted_at, id: a.principle_id });
      if (a.status === 'dropped' && a.dropped_at) out.push({ kind: 'drop', at: a.dropped_at, id: a.principle_id });
    }
    for (const t of state.trades) out.push({ kind: 'trade', at: t.traded_at, t });
    for (const c of state.custom_principles) out.push({ kind: 'custom', at: c.created_at, id: c.principle_id });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [state]);

  return (
    <>
      <section className="page-head">
        <p className="kicker">HISTORY</p>
        <h1 className="h1">기록</h1>
        <p className="sub">원칙을 바꾼 이유와 그때의 수익률이 함께 남습니다. 지워지지 않습니다.</p>
      </section>

      {items.length === 0 ? (
        <div className="paper empty-paper">
          <p className="empty-title">아직 기록이 없습니다.</p>
          <p className="sub">원칙을 채택하거나 매매를 기록하면 여기에 쌓입니다.</p>
          <button type="button" className="btn-primary" onClick={() => go('#/library')}>
            원칙 둘러보기
          </button>
        </div>
      ) : (
        <ol className="timeline">
          {items.map((it, i) => (
            <li key={i} className={`tl tl-${it.kind}`}>
              <span className="tl-date">{fmtDate(it.at)}</span>
              <div className="tl-body">
                {it.kind === 'adopt' && (
                  <p className="tl-line">
                    <span className="tl-kind">채택</span> {titleOf(it.id)}
                  </p>
                )}
                {it.kind === 'drop' && (
                  <p className="tl-line">
                    <span className="tl-kind">내려놓음</span> {titleOf(it.id)}
                  </p>
                )}
                {it.kind === 'custom' && (
                  <p className="tl-line">
                    <span className="tl-kind">나만의 원칙</span> {titleOf(it.id)}
                    {customById.get(it.id)?.ai_source === 'fallback' && <em className="tl-note"> · AI 미사용(기본 점검)</em>}
                  </p>
                )}
                {it.kind === 'trade' && (
                  <p className="tl-line">
                    <span className="tl-kind">{it.t.side === 'buy' ? '매수' : '매도'}</span>
                    {holdingOf(it.t.ticker)?.name ?? it.t.ticker} {it.t.quantity.toLocaleString('ko-KR')}주 · {fmtPrice(it.t.price, holdingOf(it.t.ticker)?.currency ?? 'KRW')}
                    <span className="tags">
                      {it.t.principle_tags.map((id) => (
                        <span key={id} className="tag">
                          {titleOf(id)}
                        </span>
                      ))}
                    </span>
                  </p>
                )}
                {it.kind === 'change' && <ChangeEntry h={it.h} titleOf={titleOf} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function ChangeEntry({ h, titleOf }: { h: PrincipleHistory; titleOf: (id: string | null) => string | null }) {
  const kind = !h.from_principle && h.to_principle ? '채택 이유' : h.from_principle && !h.to_principle ? '원칙 내려놓음' : '원칙 변경';
  return (
    <details className="tl-change">
      <summary>
        <span className="tl-kind">{kind}</span>
        <span className="tl-path">
          {titleOf(h.from_principle) ?? '—'} → {titleOf(h.to_principle) ?? '—'}
        </span>
        <span className="tl-ret">수익률 {fmtPct(h.portfolio_return_at_change)}</span>
        {h.ai_followup_question && !h.ai_followup_answered && <span className="tl-flag">{COPY.historyUnansweredLabel}</span>}
      </summary>
      <dl className="tl-qa">
        <dt>무엇이 바뀌었나</dt>
        <dd>{h.answer_what_changed}</dd>
        <dt>왜 바뀌었나</dt>
        <dd>{h.answer_why}</dd>
        <dt>무엇을 포기하나</dt>
        <dd>{h.answer_tradeoff}</dd>
        {h.ai_followup_question && (
          <>
            <dt>역질문{h.ai_source === 'fallback' && ' (기본 질문)'}</dt>
            <dd>{h.ai_followup_question}</dd>
            <dt>답</dt>
            <dd>{h.ai_followup_answered ? h.ai_followup_answer || '—' : COPY.historyUnansweredLabel}</dd>
          </>
        )}
      </dl>
    </details>
  );
}
