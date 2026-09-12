/**
 * 명세서 7.4 / 사용자 지시로 확정된 문구. v3(불일치 서술 모드)에서 그대로 사용한다.
 * 수정 시 명세서와 함께 바꿀 것.
 */
export const COPY = {
  /** [그래도 저장] 직전 1회만 띄우는 확인 모달 본문 */
  followupSkipModal:
    "잠깐만요. 이 사이트는 '왜'를 남기는 곳이에요.\n이유 없이 바꾼 원칙은, 이유 없이 산 종목이랑 비슷하거든요.\n한 줄만 더 써볼까요?",
  /** 큰 버튼 (--accent 배경) */
  followupAnswerAndSave: '한 줄 답하고 저장',
  /** 작은 텍스트 링크 (--ink-muted). 눌러도 막지 않는다. */
  followupSkipAndSave: '그래도 저장',
  /** ai_followup_answered = false 인 이력 항목에 붙는 중립 라벨. 비난 문구 금지 */
  historyUnansweredLabel: '역질문에 답하지 않고 변경',
  /** 불일치 판정 문구. 사실 범위를 "이 사이트에 정리된 대가"로 한정한다 */
  mismatch: (masterCount: number) =>
    `이 사이트에 정리된 대가 ${masterCount}명 중, 지금 포트폴리오와 맞는 방식을 가진 사람은 없습니다. 왜 이렇게 구성했는지 직접 써보시겠어요?`,
  /** 명세서 7.3 역질문 예시 — AI를 쓸 수 없을 때의 기본 역질문 */
  fallbackFollowup: '원칙이 틀렸다고 보시나요, 아니면 적용한 기간이 짧았다고 보시나요?',
  /** 명세서 8-1 유사도 체크 안내 */
  similarityNotice: '카드 문장을 옮긴 것 같아요. 본인 말로 다시 써볼까요?',
  /** 명세서 8-3 과거 서술 다시 보여주기 */
  lastTimeYouWrote: '지난번엔 이렇게 쓰셨어요.',
  /** 전역 금지사항 10장 */
  pastPerformance: '과거 수익률은 미래를 보장하지 않습니다.',
  smallSample: '표본이 작습니다. 이 숫자는 결론이 아니라 기록입니다.',
  myRecordOnly: '원칙별 성과는 내 기록일 뿐입니다. "이 원칙이 수익률이 좋다"는 뜻이 아닙니다.',
} as const;
