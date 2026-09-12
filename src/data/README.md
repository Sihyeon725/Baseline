# 원칙 카드 데이터 작성 가이드

`principles.json` 하나만 편집하면 사이트에 반영됩니다. 코드는 건드릴 필요 없습니다.

## 구조

```json
{
  "version": 1,
  "masters": [
    {
      "id": "bogle",                 // principles[].master 와 연결되는 키
      "name": "존 보글",
      "name_en": "John Bogle",       // 랜딩 카드·상세 화면 상단(대문자 세리프)에 표시
      "keywords": "장기 · 인덱스",    // 랜딩 카드의 한 줄 키워드
      "oneliner": "한 문장 소개",     // 랜딩 카드의 소개 문장 (본인의 말로)
      "color": "#17243A"             // 책등 띠 색. 대가별로 다르게, 채도 낮은 색 권장
    }
  ],
  "principles": [ { ...카드... } ]
}
```

## 카드 필드 (명세서 4장과 동일)

| 필드 | 타입 | 설명 |
|---|---|---|
| `principle_id` | string | 고유 ID. `master_번호` 형식 권장 (예: `bogle_01`). 채택 기록이 이 ID로 저장되므로 **한번 공개한 뒤에는 바꾸지 말 것** |
| `master` | string | `masters` 배열의 `id` 중 하나 |
| `title` | string | 원칙 한 줄 요약 (본인의 말로). 마침표까지 포함해 씀 |
| `quote` | string \| null | 상세 화면에 세리프 인용문으로 표시. **출처를 확인할 수 없으면 `null`.** 15단어 이내, 출처는 `source_book`에 책 제목(연도)까지 적을 것. 따옴표는 자동으로 붙음 |
| `body` | string | 3~5문장 설명. 책 문장을 그대로 옮기지 말 것 |
| `source_book` | string | 출처 책 제목 |
| `check_type` | `"auto"` \| `"self"` | 자동 점검 / 자기 점검 배지로 표시됨 |
| `user_param` | object \| null | 사용자가 정해야 하는 값. 없으면 `null` |

### `user_param` 형식

```json
{
  "key": "index_min_weight",   // 저장 키. 영문 snake_case
  "label": "인덱스 최소 비중",  // 화면에 보이는 이름
  "unit": "%",                 // 단위 표시 (없으면 "")
  "default": 60,               // 기본값
  "min": 0,                    // 선택
  "max": 100                   // 선택
}
```

## 이미지·초상

- 실존 인물의 사진, 초상, 그리고 실존 인물을 닮게 만든 AI 이미지는 사용하지 않습니다. 대가는 이니셜 모노그램(JB/PL/WB/RD)으로만 표시합니다.
- 히어로는 사진 없이 타이포그래피로 구성합니다. 사진을 꼭 쓰려면 상업적 이용이 가능한 무료 소스(Unsplash License 등)에서 가져오고, 출처와 라이선스를 `src/components/HeroArt.tsx` 주석에 남기세요.

## 규칙

- 더미 카드 3장은 `(더미)` 표시가 붙어 있습니다. 전부 교체하세요. 인용문(`quote`)은 현재 전부 `null`이며, 출처가 확인된 것만 넣습니다.
- `check_type`이 `auto`인 카드는 명세서 5장 표에 판정식이 있어야 합니다 (v1에서 사용).
- JSON 문법 오류가 나면 빌드가 실패합니다. `npm run build`로 확인하세요.
