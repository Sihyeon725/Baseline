import { IconCheck } from './Icons';

/**
 * 히어로 비주얼 — 사진·일러스트 없이, 이 사이트가 만들어 주는 결과물("나의 투자 기준" 카드)을
 * 실제 화면과 같은 스타일로 미리 보여준다. 내용은 예시이며 데이터와 연결되지 않는다.
 *
 * 사진을 쓰지 않는 이유: 출처·라이선스가 불명확한 이미지(AI 생성 포함)는 쓰지 않는다.
 * 실존 인물의 초상도 쓰지 않는다 (docs/DESIGN_RULES.md).
 */
const SAMPLE = [
  { n: '01', title: '인덱스 중심으로 보유한다.', master: 'John Bogle', color: '#17243A', state: '충족' },
  { n: '02', title: '아는 것에 투자한다.', master: 'Peter Lynch', color: '#2F4A3F', state: '충족' },
  { n: '03', title: '자주 사고팔지 않는다.', master: 'John Bogle', color: '#17243A', state: '어긋남' },
];

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden>
      <div className="hero-paper">
        <p className="hero-paper-kicker">MY BASELINE</p>
        <p className="hero-paper-title">나의 투자 기준</p>
        <ol className="hero-paper-list">
          {SAMPLE.map((s) => (
            <li key={s.n} style={{ ['--spine' as string]: s.color }}>
              <span className="hero-paper-num">{s.n}</span>
              <span className="hero-paper-main">
                <span className="hero-paper-t">{s.title}</span>
                <span className="hero-paper-m">{s.master}</span>
              </span>
              <span className={s.state === '충족' ? 'hero-paper-state ok' : 'hero-paper-state warn'}>
                {s.state === '충족' && <IconCheck width={12} height={12} />}
                {s.state}
              </span>
            </li>
          ))}
        </ol>
        <p className="hero-paper-foot">
          <span>지금 포트폴리오와 일치도</span>
          <span className="hero-paper-score">
            <span className="hero-paper-bar">
              <span style={{ width: '67%' }} />
            </span>
            67%
          </span>
        </p>
      </div>
    </div>
  );
}
