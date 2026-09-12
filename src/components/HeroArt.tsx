/**
 * 히어로 비주얼 — 사진 없이 타이포그래피만으로 구성한다.
 *
 * 사진을 쓰지 않는 이유: 출처·라이선스가 불명확한 이미지(AI 생성 포함)는 쓰지 않는다.
 * 사진을 꼭 넣겠다면 상업적 이용이 가능한 무료 소스(예: Unsplash License)에서 가져오고,
 * 여기 주석에 [사진 URL / 작가 / 라이선스 / 가져온 날짜]를 남긴 뒤 교체할 것.
 */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden>
      <span className="hero-rule" />
      <p className="hero-art-tag">
        Better
        <br />
        Decisions,
        <br />
        Longer
        <br />
        Journeys.
      </p>
      <span className="hero-drop">B</span>
      <p className="hero-art-foot">Set your baseline.</p>
    </div>
  );
}
