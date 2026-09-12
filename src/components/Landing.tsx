import type React from 'react';
import { HeroArt } from './HeroArt';
import { IconArrowRight } from './Icons';
import type { PrincipleData } from '../lib/types';

interface Props {
  data: PrincipleData;
  go: (hash: string) => void;
}

function initials(nameEn: string): string {
  return nameEn
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Landing({ data, go }: Props) {
  const countBy = new Map<string, number>();
  for (const p of data.principles) countBy.set(p.master, (countBy.get(p.master) ?? 0) + 1);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Set your baseline.</p>
          <h1 className="display">
            남의 포트폴리오를
            <br />
            보기 전에,
            <br />
            내 원칙부터.
          </h1>
          <p className="lead">
            대가들의 투자 원칙을 읽고,
            <br />
            나의 투자 기준으로 만들어보세요.
          </p>
          <button type="button" className="btn-primary" onClick={() => go('#/library')}>
            투자 원칙 둘러보기 <IconArrowRight />
          </button>
          <p className="fine">로그인 없이 시작하기</p>
        </div>
        <HeroArt />
      </section>

      <section className="section">
        <h2 className="h2">당신은 어떤 투자자인가요?</h2>
        <p className="sub">
          {data.masters.length}명의 대가들의 투자 원칙을 둘러보고,
          <br />
          나에게 맞는 스타일을 찾아보세요.
        </p>

        <div className="master-grid">
          {data.masters.map((m) => {
            const n = countBy.get(m.id) ?? 0;
            return (
              <button
                key={m.id}
                type="button"
                className="master-card"
                style={{ '--spine': m.color } as React.CSSProperties}
                onClick={() => go(`#/library/${m.id}`)}
              >
                {/* 실존 인물 사진·초상 사용 금지. 이니셜 모노그램만 쓴다. */}
                <span className="avatar" aria-hidden>
                  <span className="avatar-initials">{initials(m.name_en)}</span>
                </span>
                <span className="master-card-name">{m.name_en}</span>
                <span className="master-card-kw">{m.keywords}</span>
                <span className="master-card-line">{m.oneliner}</span>
                <span className="master-card-foot">
                  <span className="master-card-count">{n > 0 ? `원칙 ${n}` : '준비 중'}</span>
                  <IconArrowRight />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
