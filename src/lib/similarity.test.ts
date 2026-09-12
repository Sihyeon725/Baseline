import { describe, expect, it } from 'vitest';
import { bigramSimilarity, containment, looksCopied } from './similarity';
import { fallbackFollowup, fallbackReview } from './ai';

const card = '개별 종목을 고르는 대신 시장 전체를 사는 것을 기본으로 둡니다. 비용이 낮고, 장기적으로 대부분의 액티브 운용을 이깁니다.';

describe('similarity', () => {
  it('detects verbatim and near-verbatim copies', () => {
    expect(bigramSimilarity(card, card)).toBe(1);
    expect(looksCopied(card, [card])).toBe(true);
    expect(looksCopied('개별 종목을 고르는 대신 시장 전체를 사는 것을 기본으로 둡니다.', [card])).toBe(true); // 부분 복사
    expect(containment('시장 전체를 사는 것을 기본으로', card)).toBeGreaterThan(0.85);
  });

  it('accepts writing in your own words', () => {
    const mine = '나는 개별 회사를 분석할 시간이 없다. 그래서 월급의 절반은 코스피 ETF에 자동으로 넣고, 나머지로만 내가 아는 회사를 산다.';
    expect(looksCopied(mine, [card])).toBe(false);
    expect(bigramSimilarity(mine, card)).toBeLessThan(0.3);
  });
});

describe('ai fallback', () => {
  it('asks the canned follow-up when the reason is only about returns', () => {
    const r = fallbackFollowup({ mode: 'followup', from_title: 'a', to_title: null, what: 'x', why: '수익률이 안 좋아서', tradeoff: 'y' });
    expect(r.question).toContain('원칙이 틀렸다고');
    expect(r.source).toBe('fallback');
  });

  it('skips the follow-up when the reason is specific', () => {
    const r = fallbackFollowup({
      mode: 'followup',
      from_title: 'a',
      to_title: null,
      what: 'x',
      why: '이 원칙의 가정은 내가 개별 기업을 분석할 시간이 있다는 것이었는데, 올해부터 그 시간이 없어졌다. 원칙이 틀린 게 아니라 전제가 바뀌었다.',
      tradeoff: 'y',
    });
    expect(r.question).toBeNull();
  });

  it('review fallback needs length, sentences and a reason marker', () => {
    expect(fallbackReview({ mode: 'review', narrative: '짧다', portfolio_summary: '', failed_rules: ['r'] }).consistent).toBe(false);
    const long = '나는 반도체 산업에서 10년을 일했다. 그래서 이 산업의 사이클을 이해한다고 믿는다. 집중 투자는 위험하지만, 내가 아는 범위 안에서만 하기 때문에 원칙이 있다. 자주 사고파는 이유는 사이클의 국면마다 비중을 바꾸기 때문이다.';
    expect(fallbackReview({ mode: 'review', narrative: long, portfolio_summary: '', failed_rules: [] }).consistent).toBe(true);
  });
});
