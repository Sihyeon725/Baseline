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
} as const;
