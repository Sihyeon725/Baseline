import { useState, type CSSProperties } from 'react';
import { CheckBadge } from './Library';
import { ImportExport } from './ImportExport';
import { IconArrowRight } from './Icons';
import type { Principle, PrincipleData, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  byId: Map<string, Principle>;
  state: UserState;
  onDrop: (id: string) => void;
  onReAdopt: (p: Principle) => void;
  onParam: (id: string, key: string, value: number) => void;
  onReplaceState: (next: UserState) => void;
  go: (hash: string) => void;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function Constitution({ data, byId, state, onDrop, onReAdopt, onParam, onReplaceState, go }: Props) {
  const [manage, setManage] = useState(false);
  const masters = new Map(data.masters.map((m) => [m.id, m]));
  const active = state.adopted_principles
    .filter((a) => a.status === 'active')
    .sort((a, b) => a.adopted_at.localeCompare(b.adopted_at));
  const dropped = state.adopted_principles.filter((a) => a.status === 'dropped');
  const lastModified = state.adopted_principles.reduce<string | null>((acc, a) => {
    const t = a.dropped_at && a.dropped_at > a.adopted_at ? a.dropped_at : a.adopted_at;
    return !acc || t > acc ? t : acc;
  }, null);

  return (
    <>
      <section className="page-head with-art">
        <div>
          <p className="kicker">MY BASELINE</p>
          <h1 className="h1">나의 투자 기준</h1>
          <p className="sub">채택한 원칙이 모여 나의 기준이 됩니다</p>
        </div>
        <span className="mini-art" aria-hidden />
      </section>

      {active.length === 0 ? (
        <div className="paper empty-paper">
          <p className="empty-title">아직 채택한 원칙이 없습니다.</p>
          <p className="sub">라이브러리에서 마음에 드는 원칙을 읽고 추가해 보세요.</p>
          <button type="button" className="btn-primary" onClick={() => go('#/library')}>
            원칙 둘러보기 <IconArrowRight />
          </button>
        </div>
      ) : (
        <ol className="paper clist">
          {active.map((a, i) => {
            const p = byId.get(a.principle_id);
            const param = p?.user_param ?? null;
            const value = param ? (a.params[param.key] ?? param.default) : undefined;
            return (
              <li
                key={a.principle_id}
                className="crow"
                style={{ '--spine': (p && masters.get(p.master)?.color) ?? 'var(--line-strong)' } as CSSProperties}
              >
                <span className="crow-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="crow-main">
                  {p ? (
                    <button type="button" className="crow-title" onClick={() => go(`#/principle/${p.principle_id}`)}>
                      {p.title}
                    </button>
                  ) : (
                    <span className="crow-title">알 수 없는 원칙 ({a.principle_id})</span>
                  )}
                  <span className="crow-meta">
                    {p ? (masters.get(p.master)?.name_en ?? p.master) : '카드 데이터에서 삭제됨'}
                    <span className="dot">·</span>
                    {fmtDate(a.adopted_at)} 채택
                  </span>
                  {manage && (
                    <div className="crow-manage">
                      {param && (
                        <label className="param-row">
                          <span className="param-label">{param.label}</span>
                          <span className="check-input">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={param.min}
                              max={param.max}
                              value={value}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isFinite(n)) onParam(a.principle_id, param.key, n);
                              }}
                            />
                            <span className="unit">{param.unit}</span>
                          </span>
                        </label>
                      )}
                      <button type="button" className="btn-ghost sm" onClick={() => onDrop(a.principle_id)}>
                        내려놓기
                      </button>
                    </div>
                  )}
                </div>
                {p && <CheckBadge type={p.check_type} />}
              </li>
            );
          })}
        </ol>
      )}

      <div className="cfoot">
        <div>
          <p className="cfoot-count">{active.length}개의 원칙</p>
          {lastModified && <p className="cfoot-meta">마지막 수정 {fmtDate(lastModified)}</p>}
        </div>
        {active.length > 0 && (
          <button type="button" className={manage ? 'btn-secondary' : 'btn-primary'} onClick={() => setManage((m) => !m)}>
            {manage ? '관리 끝내기' : '원칙 관리하기'} {!manage && <IconArrowRight />}
          </button>
        )}
      </div>

      {dropped.length > 0 && (
        <section className="section-block">
          <h2 className="h3">내려놓은 원칙 {dropped.length}</h2>
          <p className="sub">기록은 지워지지 않습니다. 다시 채택할 수 있습니다.</p>
          <ul className="dropped-list">
            {dropped.map((a) => {
              const p = byId.get(a.principle_id);
              return (
                <li key={a.principle_id}>
                  <span className="dropped-title">{p?.title ?? a.principle_id}</span>
                  <span className="dropped-meta">
                    {fmtDate(a.adopted_at)} 채택 → {a.dropped_at ? fmtDate(a.dropped_at) : '?'} 내려놓음
                  </span>
                  {p && (
                    <button type="button" className="btn-link" onClick={() => onReAdopt(p)}>
                      다시 채택
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ImportExport state={state} onReplaceState={onReplaceState} />
    </>
  );
}
