import { useMemo, useState, type CSSProperties } from 'react';
import { IconArrowRight } from './Icons';
import { CheckBadge } from './Library';
import { fmtAsOf } from '../lib/prices';
import { COPY } from '../lib/copy';
import {
  benchmarkComparison,
  fmtKRW,
  fmtPct,
  principlePerformance,
  tradesReturn,
  valuate,
  type PriceContext,
} from '../lib/portfolio';
import { alternatives, contradictions, evaluateAll, verdict as computeVerdict, type RuleResult } from '../lib/rules';
import type { PriceSnapshot, PrincipleData, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  state: UserState;
  ctx: PriceContext;
  snapshot: PriceSnapshot | null;
  go: (hash: string) => void;
}

export function Check({ data, state, ctx, snapshot, go }: Props) {
  const now = useMemo(() => new Date(), []);
  const valuation = useMemo(() => valuate(state, ctx), [state, ctx]);
  const results = useMemo(() => evaluateAll(data, { state, valuation, now }), [data, state, valuation, now]);
  const v = useMemo(() => computeVerdict(data, results), [data, results]);
  const conflicts = contradictions(results);
  const masters = new Map(data.masters.map((m) => [m.id, m]));
  const [altFor, setAltFor] = useState<string | null>(null);
  const perf = useMemo(() => principlePerformance(state, ctx), [state, ctx]);
  const bench = useMemo(() => benchmarkComparison(state, ctx, snapshot), [state, ctx, snapshot]);
  const mine = useMemo(() => tradesReturn(state, ctx), [state, ctx]);
  const byId = useMemo(() => new Map(data.principles.map((p) => [p.principle_id, p])), [data]);
  const customById = useMemo(() => new Map(state.custom_principles.map((c) => [c.principle_id, c])), [state.custom_principles]);
  const titleOf = (id: string) => byId.get(id)?.title ?? customById.get(id)?.title ?? id;
  const adoptedAuto = results.filter((r) => r.adopted);
  const adoptedSelf = state.adopted_principles
    .filter((a) => a.status === 'active')
    .map((a) => byId.get(a.principle_id) ?? null)
    .filter((p): p is NonNullable<typeof p> => !!p && p.check_type === 'self');
  const customs = state.custom_principles.filter((c) => state.adopted_principles.some((a) => a.principle_id === c.principle_id && a.status === 'active'));

  return (
    <>
      <section className="page-head">
        <p className="kicker">CHECK</p>
        <h1 className="h1">점검</h1>
        <p className="sub">원칙과 포트폴리오가 같은 말을 하고 있는지 봅니다.</p>
      </section>

      {/* ===== 판정 ===== */}
      {v.type === 'empty' ? (
        <div className="paper empty-paper">
          <p className="empty-title">점검할 포트폴리오가 없습니다.</p>
          <p className="sub">보유 종목을 등록하면 이 사이트에 정리된 대가들의 규칙으로 자동 점검합니다.</p>
          <button type="button" className="btn-primary" onClick={() => go('#/portfolio')}>
            포트폴리오 입력 <IconArrowRight />
          </button>
        </div>
      ) : (
        <div className={`verdict verdict-${v.type}`}>
          {v.type === 'match' && v.best && (
            <>
              <p className="verdict-kicker">일치</p>
              <p className="verdict-title">{masters.get(v.best.master)?.name ?? v.best.master} 스타일에 가깝습니다.</p>
            </>
          )}
          {v.type === 'partial' && v.best && (
            <>
              <p className="verdict-kicker">부분 일치</p>
              <p className="verdict-title">
                {masters.get(v.best.master)?.name ?? v.best.master}에 가장 가깝지만, 어긋난 규칙이 있습니다.
              </p>
              <ul className="verdict-list">
                {v.best.failed.map((r) => (
                  <li key={r.principle.principle_id}>
                    {r.principle.title} — {r.outcome!.actual} (기준 {r.outcome!.threshold})
                  </li>
                ))}
              </ul>
            </>
          )}
          {v.type === 'mismatch' && (
            <>
              <p className="verdict-kicker">불일치</p>
              <p className="verdict-title">{COPY.mismatch(data.masters.length)}</p>
              <p className="sub">"위험한 포폴"이 아니라 "일관성 없는 포폴"을 잡아내는 판정입니다. 근거를 쓰고 AI가 논리 일관성만 검토합니다.</p>
              <button type="button" className="btn-primary" onClick={() => go('#/narrative')}>
                근거 서술하기 <IconArrowRight />
              </button>
            </>
          )}

          <ul className="score-list">
            {v.scores.map((s) => (
              <li key={s.master} className="score-row" style={{ '--spine': masters.get(s.master)?.color } as CSSProperties}>
                <span className="score-name">{masters.get(s.master)?.name ?? s.master}</span>
                <span className="score-bar">
                  <span className="score-fill" style={{ width: `${s.score ?? 0}%` }} />
                </span>
                <span className="score-num">{s.score === null ? '규칙 없음' : `${s.score}% (${s.passed}/${s.total})`}</span>
              </li>
            ))}
          </ul>
          <p className="fine">일치도 = 충족한 자동 점검 규칙 수 ÷ 그 대가의 전체 자동 점검 규칙 수. 자기 점검 원칙은 계산에서 빠집니다.</p>
        </div>
      )}

      {/* ===== 모순 경고 ===== */}
      {v.type !== 'empty' && (
        <section className="section-block">
          <h2 className="h3">모순 경고 {conflicts.length > 0 && <span className="count-warn">{conflicts.length}</span>}</h2>
          <p className="sub">채택한 원칙 중 지금 포트폴리오와 어긋난 것. "불일치"까지만 말합니다.</p>
          {adoptedAuto.length === 0 ? (
            <p className="empty">자동 점검되는 원칙을 아직 채택하지 않았습니다.</p>
          ) : conflicts.length === 0 ? (
            <p className="empty ok">채택한 원칙과 포트폴리오가 어긋난 곳이 없습니다.</p>
          ) : (
            <ul className="conflict-list">
              {conflicts.map((r) => (
                <ConflictCard
                  key={r.principle.principle_id}
                  r={r}
                  masterName={masters.get(r.principle.master)?.name ?? r.principle.master}
                  alts={altFor === r.principle.principle_id ? alternatives(results) : null}
                  onToggleAlts={() => setAltFor((x) => (x === r.principle.principle_id ? null : r.principle.principle_id))}
                  go={go}
                  masterNameOf={(id) => masters.get(id)?.name ?? id}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ===== 채택 원칙별 점검 ===== */}
      {(adoptedAuto.length > 0 || adoptedSelf.length > 0 || customs.length > 0) && (
        <section className="section-block">
          <h2 className="h3">나의 기준 점검표</h2>
          <ul className="check-table">
            {adoptedAuto.map((r) => (
              <li key={r.principle.principle_id} className={r.outcome ? (r.outcome.pass ? 'ck pass' : 'ck fail') : 'ck none'}>
                <span className="ck-mark">{r.outcome ? (r.outcome.pass ? '충족' : '어긋남') : '—'}</span>
                <span className="ck-main">
                  <span className="ck-title">{r.principle.title}</span>
                  <span className="ck-meta">
                    {r.rule
                      ? r.outcome
                        ? `${r.outcome.actual} · 기준 ${r.outcome.threshold}`
                        : '포트폴리오가 비어 있습니다'
                      : '판정식 없음 (카드 데이터에 규칙이 아직 없습니다)'}
                  </span>
                </span>
              </li>
            ))}
            {adoptedSelf.map((p) => (
              <li key={p.principle_id} className="ck self">
                <span className="ck-mark">
                  <CheckBadge type="self" />
                </span>
                <span className="ck-main">
                  <span className="ck-title">{p.title}</span>
                  <span className="ck-meta">수치가 아니라 스스로 돌아보는 원칙입니다.</span>
                </span>
              </li>
            ))}
            {customs.map((c) => (
              <li key={c.principle_id} className="ck self">
                <span className="ck-mark">
                  <span className="badge badge-custom">나만의 원칙</span>
                </span>
                <span className="ck-main">
                  <span className="ck-title">{c.title}</span>
                  <span className="ck-meta">{c.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== 원칙별 성과 ===== */}
      <section className="section-block">
        <h2 className="h3">원칙별 성과 (내 기록)</h2>
        <p className="sub">{COPY.myRecordOnly}</p>
        {perf.length === 0 ? (
          <p className="empty">원칙 태그가 달린 매매 기록이 아직 없습니다.</p>
        ) : (
          <ul className="perf-list">
            {perf.map((p) => (
              <li key={p.principle_id} className="perf-row">
                <span className="perf-main">
                  <span className="perf-title">{titleOf(p.principle_id)}</span>
                  <span className="perf-meta">
                    매매 {p.trade_count}회 · 투입 {fmtKRW(p.invested_krw)}
                    {p.trade_count < 5 && <em className="perf-small"> · {COPY.smallSample}</em>}
                  </span>
                </span>
                <span className="perf-num">{p.return_pct === null ? (p.unpriced > 0 ? '시세 없음' : '—') : fmtPct(p.return_pct)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">
          {fmtAsOf(ctx.asOf)} · {COPY.pastPerformance}
        </p>
      </section>

      {/* ===== 벤치마크 비교 ===== */}
      <section className="section-block">
        <h2 className="h3">벤치마크 비교</h2>
        <p className="sub">각 매수와 같은 날, 같은 금액을 지수에 넣었다면 지금 얼마인가. 지수는 현지 통화 수익률만 반영합니다(환율 제외).</p>
        {!snapshot ? (
          <p className="empty">시세 캐시가 없어 비교할 수 없습니다.</p>
        ) : mine.covered === 0 ? (
          <p className="empty">시세가 있는 매수 기록이 아직 없습니다. 매수 기록을 남기면 여기서 비교합니다.</p>
        ) : (
          <ul className="bench-list">
            <li className="bench-row me">
              <span className="bench-name">내 매수 기록 ({mine.covered}건)</span>
              <span className="bench-val">
                {fmtKRW(mine.invested_krw)} → {fmtKRW(mine.value_krw)}
              </span>
              <span className="bench-num">{fmtPct(mine.return_pct)}</span>
            </li>
            {bench.map((b) => (
              <li key={b.key} className="bench-row">
                <span className="bench-name">
                  {b.name} ({b.covered_trades}/{b.total_buy_trades}건 비교)
                </span>
                <span className="bench-val">
                  {fmtKRW(b.invested_krw)} → {fmtKRW(b.hypothetical_value_krw)}
                </span>
                <span className="bench-num">{fmtPct(b.return_pct)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">
          {snapshot ? `${fmtAsOf(bench[0]?.latest_date ?? ctx.asOf)} · ` : ''}
          {COPY.pastPerformance}
        </p>
      </section>
    </>
  );
}

interface ConflictProps {
  r: RuleResult;
  masterName: string;
  alts: RuleResult[] | null;
  onToggleAlts: () => void;
  go: (hash: string) => void;
  masterNameOf: (id: string) => string;
}

function ConflictCard({ r, masterName, alts, onToggleAlts, go, masterNameOf }: ConflictProps) {
  const id = r.principle.principle_id;
  return (
    <li className="conflict">
      <p className="conflict-master">{masterName}</p>
      <p className="conflict-title">{r.principle.title}</p>
      <p className="conflict-fact">
        {r.outcome!.actual} · 기준 {r.outcome!.threshold}
      </p>
      {r.outcome!.detail && <p className="conflict-detail">{r.outcome!.detail}</p>}
      <div className="conflict-actions">
        <button type="button" className="btn-secondary" onClick={() => go('#/portfolio')}>
          포폴 수정
        </button>
        <button type="button" className="btn-secondary" onClick={() => go(`#/change/${id}/-`)}>
          원칙 내려놓기
        </button>
        <button type="button" className={alts ? 'btn-secondary on' : 'btn-secondary'} onClick={onToggleAlts}>
          대체 원칙
        </button>
      </div>
      {alts && (
        <div className="alts">
          {alts.length === 0 ? (
            <p className="sub">지금 포트폴리오가 이미 충족하면서 아직 채택하지 않은 원칙이 없습니다.</p>
          ) : (
            <>
              <p className="sub">지금 포트폴리오가 이미 충족하는, 아직 채택하지 않은 원칙입니다. 종목 추천이 아니라 원칙 추천입니다.</p>
              <ul className="alt-list">
                {alts.map((a) => (
                  <li key={a.principle.principle_id}>
                    <span className="alt-main">
                      <span className="alt-title">{a.principle.title}</span>
                      <span className="alt-meta">
                        {masterNameOf(a.principle.master)} · {a.outcome!.actual}
                      </span>
                    </span>
                    <button type="button" className="btn-link" onClick={() => go(`#/change/${id}/${a.principle.principle_id}`)}>
                      이 원칙으로 바꾸기
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
