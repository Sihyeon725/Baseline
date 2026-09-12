import type React from 'react';
import { IconArrowRight, IconCheck } from './Icons';
import { isActive } from '../lib/store';
import type { Principle, PrincipleData, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  state: UserState;
  masterFilter: string | null;
  go: (hash: string) => void;
}

export function CheckBadge({ type }: { type: Principle['check_type'] }) {
  return type === 'auto' ? (
    <span className="badge badge-auto" title="포트폴리오 데이터로 자동 점검되는 원칙">자동 점검</span>
  ) : (
    <span className="badge badge-self" title="본인이 스스로 점검하는 원칙">자기 점검</span>
  );
}

export function Library({ data, state, masterFilter, go }: Props) {
  const masters = new Map(data.masters.map((m) => [m.id, m]));
  const list = masterFilter ? data.principles.filter((p) => p.master === masterFilter) : data.principles;
  const current = masterFilter ? masters.get(masterFilter) : undefined;

  return (
    <>
      <section className="page-head">
        <p className="kicker">PRINCIPLE LIBRARY</p>
        <h1 className="h1">원칙 라이브러리</h1>
        <p className="sub">읽고, 마음에 드는 원칙을 나의 기준에 추가하세요.</p>
      </section>

      <div className="chips" role="tablist" aria-label="대가별 보기">
        <button
          type="button"
          role="tab"
          aria-selected={!masterFilter}
          className={!masterFilter ? 'chip active' : 'chip'}
          onClick={() => go('#/library')}
        >
          전체
        </button>
        {data.masters.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={masterFilter === m.id}
            className={masterFilter === m.id ? 'chip active' : 'chip'}
            onClick={() => go(`#/library/${m.id}`)}
          >
            {m.name}
          </button>
        ))}
      </div>

      <ul className="plist" aria-label="원칙 목록">
        {list.map((p, i) => {
          const adopted = isActive(state, p.principle_id);
          return (
            <li key={p.principle_id}>
              <button
                type="button"
                className="prow"
                style={{ '--spine': masters.get(p.master)?.color ?? 'var(--line-strong)' } as React.CSSProperties}
                onClick={() => go(`#/principle/${p.principle_id}`)}
              >
                <span className="prow-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="prow-main">
                  <span className="prow-title">{p.title}</span>
                  <span className="prow-meta">
                    {masters.get(p.master)?.name_en ?? p.master}
                    {adopted && (
                      <span className="prow-adopted">
                        <IconCheck width={14} height={14} /> 기준에 포함
                      </span>
                    )}
                  </span>
                </span>
                <span className="prow-side">
                  <CheckBadge type={p.check_type} />
                  <IconArrowRight className="prow-arrow" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {list.length === 0 && (
        <p className="empty">
          {current ? `${current.name}의 원칙 카드는 준비 중입니다.` : '아직 카드가 없습니다.'}
        </p>
      )}
    </>
  );
}
