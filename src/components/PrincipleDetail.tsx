import { CheckBadge } from './Library';
import { IconArrowLeft, IconCheck, IconPlus, IconScale } from './Icons';
import { findAdopted, isActive } from '../lib/store';
import type { Principle, PrincipleData, UserState } from '../lib/types';

interface Props {
  data: PrincipleData;
  principle: Principle;
  state: UserState;
  onAdopt: (p: Principle) => void;
  onDrop: (id: string) => void;
  onParam: (id: string, key: string, value: number) => void;
  go: (hash: string) => void;
}

export function PrincipleDetail({ data, principle: p, state, onAdopt, onDrop, onParam, go }: Props) {
  const master = data.masters.find((m) => m.id === p.master);
  const adopted = isActive(state, p.principle_id);
  const entry = findAdopted(state, p.principle_id);
  const param = p.user_param;
  const value = param ? (entry?.params[param.key] ?? param.default) : undefined;

  return (
    <article className="detail">
      <button type="button" className="backlink" onClick={() => go(`#/library/${p.master}`)}>
        <IconArrowLeft width={16} height={16} /> 원칙 라이브러리
      </button>

      <div className="detail-head">
        <p className="master-caps">{master?.name_en ?? p.master}</p>
        <CheckBadge type={p.check_type} />
      </div>

      <h1 className="display sm">{p.title}</h1>

      {p.quote && <blockquote className="quote">“{p.quote}”</blockquote>}

      <p className="body">{p.body}</p>

      <div className="check-box">
        <p className="check-box-title">
          <IconScale width={16} height={16} />
          {p.check_type === 'auto' ? '자동 점검' : '자기 점검'}
        </p>
        {param ? (
          <div className="check-grid">
            <div>
              <span className="check-label">{param.label}</span>
              {adopted ? (
                <span className="check-input">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={param.min}
                    max={param.max}
                    value={value}
                    aria-label={param.label}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) onParam(p.principle_id, param.key, n);
                    }}
                  />
                  <span className="unit">{param.unit}</span>
                </span>
              ) : (
                <span className="check-value">
                  {param.default}
                  {param.unit}
                </span>
              )}
            </div>
            <div>
              <span className="check-label">{adopted ? '상태' : '기본값'}</span>
              <span className="check-value muted">{adopted ? '채택 후 값을 정했습니다' : '채택하면 직접 정합니다'}</span>
            </div>
          </div>
        ) : (
          <p className="check-note">
            {p.check_type === 'auto'
              ? '포트폴리오를 입력하면 점검 화면에서 자동으로 판정됩니다.'
              : '수치가 아니라 스스로 돌아보는 원칙입니다.'}
          </p>
        )}
      </div>

      <p className="source-line">
        <span>출처</span>
        <span className="sep">|</span>
        <span>{p.source_book}</span>
      </p>

      {adopted ? (
        <div className="cta-row">
          <span className="cta-done">
            <IconCheck /> 내 투자 기준에 있습니다
          </span>
          <button type="button" className="btn-ghost" onClick={() => onDrop(p.principle_id)}>
            내려놓기
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary wide" onClick={() => onAdopt(p)}>
          <IconPlus /> 내 투자 기준에 추가
        </button>
      )}
    </article>
  );
}
