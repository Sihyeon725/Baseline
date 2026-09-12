# Baseline — 내 원칙부터 (v0)

대가들의 투자 원칙을 읽고 채택해 "나의 투자 헌법"을 만드는 모바일 우선 웹사이트. 로그인 없음, 서버 없음.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성 (Vercel/Netlify 정적 배포)
npm test         # 저장소 로직 테스트
```

## v0 범위

- 원칙 라이브러리 (대가별 필터, 자동/자기 점검 배지)
- 채택 → 나의 투자 헌법 (사용자 파라미터 편집, 내려놓기, 다시 채택)
- localStorage 저장 + JSON 백업 내보내기/불러오기 (공유 → 다운로드 → 복사/붙여넣기 폴백)

## 원칙 카드 채우기

`src/data/principles.json`만 편집하면 됩니다. 형식은 `src/data/README.md` 참고.

## 구조

```
src/
  data/principles.json   원칙 카드 데이터 (작성자가 채움)
  lib/types.ts           데이터 모델 (명세서 3장)
  lib/store.ts           로컬 저장, 백업 검증, 채택/폐기 상태 전이
  components/            Library, PrincipleCard, Constitution, ImportExport
  App.tsx                해시 라우팅 (#/, #/constitution)
```
