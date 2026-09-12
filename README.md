# Baseline — 내 원칙부터

대가들의 투자 원칙을 읽고 → 채택하고 → 내 포트폴리오에 적용해 점검하는 모바일 우선 웹사이트. 로그인 없음. 데이터는 브라우저에만.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입 검사(src, api) + dist/ 생성
npm test         # 저장소·규칙·평가·유사도 로직 테스트
npm run prices   # 종가 캐시 갱신 → public/prices/latest.json
```

## 구현 범위 (명세서 9장)

| 단계 | 내용 | 상태 |
|---|---|---|
| v0 | 원칙 라이브러리 + 채택 + 나의 투자 헌법 + 로컬 저장/백업 | 완료 |
| v1 | 포트폴리오 수동 입력 + 매매마다 원칙 태그 필수 + 모순 점검(대가별 일치도, 모순 경고, 대체 원칙) | 완료 |
| v2 | 시세 연동(하루 1회 배치) + 원칙별 성과(내 기록) + 벤치마크 비교 | 완료 |
| v3 | 불일치 서술 모드 + AI 논리 일관성 검토 + 역질문 1회 + 변경 이력 타임라인 + 나만의 원칙 | 완료 |

## 화면

- `#/library`, `#/principle/:id` — 원칙 라이브러리 / 카드 상세
- `#/constitution` — 나의 투자 헌법 (파라미터, 내려놓기, 백업)
- `#/portfolio` — 보유 종목 등록·수정, 매매 기록(원칙 태그 필수), 환율 설정
- `#/check` — 판정(일치/부분 일치/불일치), 모순 경고 3택(포폴 수정 / 원칙 내려놓기 / 대체 원칙), 점검표, 원칙별 성과, 벤치마크
- `#/change/:from/:to` — 원칙 변경·폐기 서술 (3문항 필수 → 역질문 → 저장). `-`는 없음
- `#/narrative` — 불일치 근거 서술 → AI 검토 → 나만의 원칙 등록
- `#/history` — 변경 이력·채택·매매 타임라인

## 원칙 카드와 규칙

- 카드 데이터: `src/data/principles.json` (형식은 `src/data/README.md`). 현재 카드는 전부 `(더미)`.
- 자동 점검 판정식: `src/lib/rules.ts`의 `RULES`. **키가 카드의 `principle_id`와 같아야** 판정된다. 판정식 없는 auto 카드는 "판정식 없음"으로 표시되고 일치도 계산에서 빠진다.
- 구현된 규칙: `bogle_01` 인덱스 비중, `bogle_02` 90일 매매 횟수, `lynch_01` why_i_know, `buffett_01` 종목 수, `buffett_02` 평균 보유기간, `dalio_01` 자산군 종류. 명세서 표의 `lynch_02`, `dalio_02`는 빈칸이라 구현하지 않았다.
- 일치도·기준치(70/40%)는 `src/lib/rules.ts` 상단 상수.

## 시세 (v2)

- `scripts/fetch-prices.mjs`가 `scripts/tickers.json`의 종목 종가, 코스피·S&P 500 일별 이력(약 3년), USD/KRW를 받아 `public/prices/latest.json`에 쓴다.
- `.github/workflows/prices.yml`이 평일 07:30 KST에 실행해 커밋한다. 정적 호스팅이 main을 자동 배포하면 그대로 반영.
- 소스: 국내는 네이버 금융 fchart, 해외·지수·환율은 Yahoo Finance chart. **둘 다 비공식·무인증이라 공개 운영 시 약관 확인 필수.** KRX OPEN API 키를 받으면 `fetchKRX`를 채우고 `KRX_API_KEY` 시크릿을 넣으면 국내는 그쪽을 우선 쓴다.
- 캐시에 없는 종목은 보유 종목 "수정"에서 현재가를 직접 입력할 수 있다. 없으면 평단가 기준으로 계산되고 화면에 "시세 없음"이 붙는다.
- 사용자 보유 종목을 서버는 모른다. 자주 쓰이는 종목을 `scripts/tickers.json`에 미리 넣어 둘 것.

## AI (v3)

- 프론트엔드에 API 키 없음. `api/review.ts`(Vercel Function)만 `ANTHROPIC_API_KEY`를 읽는다.
- 호출 지점 2곳: 원칙 변경 시 역질문(`mode: followup`), 불일치 근거 서술 검토(`mode: review`). 시스템 프롬프트에 종목 추천·매매 지시·옳고 그름 판정 금지를 명시.
- 상한: IP당 시간당 `AI_PER_IP_PER_HOUR`(기본 12), 전체 일일 `AI_GLOBAL_PER_DAY`(기본 400). `AI_DISABLED=1`이면 503.
- 함수가 없거나 실패하면 클라이언트가 규칙 기반 대체로 동작한다 (`src/lib/ai.ts`의 `fallback*`). 이력에는 `ai_source: 'fallback'`으로 남는다.
- 로컬 `vite dev`에는 `/api`가 없으므로 항상 대체 모드다. 실제 AI를 붙여 보려면 `vercel dev`로 실행.

배포 시 Vercel 프로젝트 환경 변수: `ANTHROPIC_API_KEY` (필수), `ANTHROPIC_MODEL` (선택, 기본 `claude-opus-5`).

## 구조

```
api/review.ts              AI 검토 서버리스 함수
scripts/fetch-prices.mjs   종가 배치, tickers.json 종목 목록
public/prices/latest.json  종가 캐시 (배치 산출물)
src/
  data/principles.json     원칙 카드 (작성자가 채움)
  lib/types.ts             데이터 모델 (명세서 3장)
  lib/store.ts             로컬 저장, 백업 검증(v1→v2 마이그레이션), 상태 전이
  lib/rules.ts             규칙 세트·일치도·판정·모순·대체 원칙 (명세서 5장)
  lib/portfolio.ts         평가액·비중·보유기간·원칙별 성과·벤치마크
  lib/similarity.ts        카드 원문 유사도 체크 (명세서 8-1)
  lib/ai.ts                AI 호출 + 규칙 기반 대체
  lib/copy.ts              확정 문구
  components/              화면
```

## 금지사항 체크 (명세서 10장)

- 종목 추천·매매 시점 없음. 모순 경고는 "원칙과 불일치"까지만.
- 원칙별 성과는 "내 기록"으로만, 표본 5건 미만이면 안내 문구.
- 과거 데이터 화면마다 "과거 수익률은 미래를 보장하지 않습니다".
- 시세 기준일("N월 N일 종가 기준")을 항상 표시. 수익률에 등락색 없음.
