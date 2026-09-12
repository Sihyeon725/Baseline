import { useMemo, useState, type FormEvent } from 'react';
import { IconPlus, IconArrowRight } from './Icons';
import { fmtDate } from './Constitution';
import { fmtAsOf } from '../lib/prices';
import { fmtKRW, fmtPct, fmtPrice, valuate, weightByAssetClass, type PriceContext } from '../lib/portfolio';
import { activeIds } from '../lib/store';
import { ASSET_CLASS_LABEL, type AssetClass, type Currency, type Holding, type PrincipleData, type Trade, type UserState } from '../lib/types';
import { COPY } from '../lib/copy';

interface Props {
  data: PrincipleData;
  state: UserState;
  ctx: PriceContext;
  onUpsertHolding: (h: Holding) => void;
  onRemoveHolding: (ticker: string) => void;
  onManualPrice: (ticker: string, price: number | null) => void;
  onAddTrade: (t: Trade, newHolding?: Omit<Holding, 'quantity' | 'avg_price' | 'since'>) => string | null;
  onRemoveTrade: (id: string) => void;
  onSetUsdKrw: (rate: number) => void;
  go: (hash: string) => void;
}

type Tab = 'holdings' | 'trades';

const ASSET_CLASSES = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toIso(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function Portfolio({
  data,
  state,
  ctx,
  onUpsertHolding,
  onRemoveHolding,
  onManualPrice,
  onAddTrade,
  onRemoveTrade,
  onSetUsdKrw,
  go,
}: Props) {
  const [tab, setTab] = useState<Tab>('holdings');
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const v = useMemo(() => valuate(state, ctx), [state, ctx]);
  const lynchActive = activeIds(state).includes('lynch_01');
  const byClass = weightByAssetClass(v);
  const byId = useMemo(() => new Map(data.principles.map((p) => [p.principle_id, p])), [data]);
  const customById = useMemo(() => new Map(state.custom_principles.map((c) => [c.principle_id, c])), [state.custom_principles]);
  const titleOf = (id: string) => byId.get(id)?.title ?? customById.get(id)?.title ?? id;
  const holdingsSorted = [...state.holdings].sort((a, b) => b.quantity * b.avg_price - a.quantity * a.avg_price);
  const tradesDesc = [...state.trades].sort((a, b) => b.traded_at.localeCompare(a.traded_at));

  return (
    <>
      <section className="page-head">
        <p className="kicker">MY PORTFOLIO</p>
        <h1 className="h1">포트폴리오</h1>
        <p className="sub">직접 입력합니다. 매매마다 근거가 된 원칙을 남깁니다.</p>
      </section>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">평가액</span>
          <span className="stat-value">{v.items.length ? fmtKRW(v.total_value_krw) : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">수익률</span>
          <span className="stat-value">{fmtPct(v.return_pct)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">종목</span>
          <span className="stat-value">{v.items.length}</span>
        </div>
      </div>
      <p className="fine asof">
        {fmtAsOf(ctx.asOf)}
        {v.items.length > 0 && v.priced_count < v.items.length && ` · ${v.items.length - v.priced_count}종목은 평단가 기준`}
        {' · '}환율 {Math.round(ctx.usdKrw).toLocaleString('ko-KR')}원{ctx.fxSource === 'setting' ? ' (직접 설정)' : ''}
      </p>
      {v.items.length > 0 && <p className="fine">{COPY.pastPerformance}</p>}

      <div className="chips" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'holdings'} className={tab === 'holdings' ? 'chip active' : 'chip'} onClick={() => setTab('holdings')}>
          보유 {state.holdings.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'trades'} className={tab === 'trades' ? 'chip active' : 'chip'} onClick={() => setTab('trades')}>
          매매 기록 {state.trades.length}
        </button>
      </div>

      {tab === 'holdings' && (
        <>
          {v.items.length > 0 && (
            <div className="class-bar" aria-label="자산군 비중">
              {ASSET_CLASSES.filter((c) => byClass[c] > 0).map((c) => (
                <span key={c} className={`class-seg seg-${c}`} style={{ width: `${byClass[c] * 100}%` }} title={`${ASSET_CLASS_LABEL[c]} ${Math.round(byClass[c] * 100)}%`} />
              ))}
            </div>
          )}
          {v.items.length > 0 && (
            <p className="class-legend">
              {ASSET_CLASSES.filter((c) => byClass[c] > 0).map((c) => (
                <span key={c}>
                  <i className={`seg-dot seg-${c}`} /> {ASSET_CLASS_LABEL[c]} {Math.round(byClass[c] * 100)}%
                </span>
              ))}
            </p>
          )}

          {holdingsSorted.length === 0 ? (
            <div className="paper empty-paper">
              <p className="empty-title">아직 보유 종목이 없습니다.</p>
              <p className="sub">지금 갖고 있는 종목을 먼저 등록하세요. 앞으로의 매매는 "매매 기록"에서 원칙과 함께 남깁니다.</p>
            </div>
          ) : (
            <ul className="hlist">
              {holdingsSorted.map((h) => {
                const item = v.items.find((i) => i.holding.ticker === h.ticker);
                return (
                  <li key={h.ticker} className="hrow">
                    <div className="hrow-main">
                      <span className="hrow-name">
                        {h.name || h.ticker}
                        <span className="hrow-ticker">{h.ticker}</span>
                      </span>
                      <span className="hrow-meta">
                        {ASSET_CLASS_LABEL[h.asset_class]} · {h.quantity.toLocaleString('ko-KR')}주 · 평단 {fmtPrice(h.avg_price, h.currency)}
                      </span>
                      {h.asset_class === 'stock' && (
                        <span className={h.why_i_know.trim() ? 'hrow-why' : 'hrow-why missing'}>
                          {h.why_i_know.trim() ? `왜 아는가: ${h.why_i_know}` : lynchActive ? '"왜 아는가"가 비어 있습니다 (린치 원칙 채택 중)' : '"왜 아는가" 미입력'}
                        </span>
                      )}
                    </div>
                    <div className="hrow-side">
                      {item && h.quantity > 0 ? (
                        <>
                          <span className="hrow-value">{fmtKRW(item.value_krw)}</span>
                          <span className="hrow-pct">
                            {fmtPct(item.return_pct)} · {Math.round(item.weight * 100)}%
                          </span>
                          <span className="hrow-src">
                            {item.priceSource === 'close' ? `종가 ${item.priceDate ?? ''}` : item.priceSource === 'manual' ? '직접 입력 시세' : '시세 없음'}
                          </span>
                        </>
                      ) : (
                        <span className="hrow-src">수량 0</span>
                      )}
                      <button type="button" className="btn-link" onClick={() => setEditing(h)}>
                        수정
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="backup-row">
            <button type="button" className="btn-primary" onClick={() => setShowHoldingForm(true)}>
              <IconPlus /> 보유 종목 등록
            </button>
          </div>
          <p className="fine">
            시세는 하루 1회 종가로 갱신되며 지원 종목만 있습니다. 목록에 없는 종목은 "수정"에서 현재가를 직접 입력할 수 있습니다.
          </p>
        </>
      )}

      {tab === 'trades' && (
        <>
          {tradesDesc.length === 0 ? (
            <div className="paper empty-paper">
              <p className="empty-title">아직 매매 기록이 없습니다.</p>
              <p className="sub">사고팔 때마다 어떤 원칙에 근거했는지 태그로 남깁니다. 태그 없이는 저장되지 않습니다.</p>
            </div>
          ) : (
            <ul className="tlist">
              {tradesDesc.map((t) => (
                <li key={t.trade_id} className="trow">
                  <div className="trow-main">
                    <span className="trow-title">
                      <span className={`side side-${t.side}`}>{t.side === 'buy' ? '매수' : '매도'}</span>
                      {state.holdings.find((h) => h.ticker === t.ticker)?.name ?? t.ticker}
                      <span className="hrow-ticker">{t.ticker}</span>
                    </span>
                    <span className="hrow-meta">
                      {fmtDate(t.traded_at)} · {t.quantity.toLocaleString('ko-KR')}주 · {fmtPrice(t.price, state.holdings.find((h) => h.ticker === t.ticker)?.currency ?? 'KRW')}
                    </span>
                    <span className="tags">
                      {t.principle_tags.map((id) => (
                        <span key={id} className="tag">
                          {titleOf(id)}
                        </span>
                      ))}
                    </span>
                    {t.note && <span className="trow-note">{t.note}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn-link muted"
                    onClick={() => {
                      if (window.confirm('이 매매 기록을 지울까요? 보유 수량은 되돌리지 않습니다.')) onRemoveTrade(t.trade_id);
                    }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="backup-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (activeIds(state).length === 0) {
                  window.alert('매매 기록에는 근거 원칙 태그가 필요합니다. 먼저 원칙을 하나 이상 채택하세요.');
                  go('#/library');
                  return;
                }
                setShowTradeForm(true);
              }}
            >
              <IconPlus /> 매매 기록 추가
            </button>
          </div>
        </>
      )}

      <section className="section-block">
        <h2 className="h3">설정</h2>
        <label className="param-row">
          <span className="param-label">USD→KRW 환율 (시세 캐시에 환율이 없을 때)</span>
          <span className="check-input">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={state.settings.usd_krw}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) onSetUsdKrw(n);
              }}
            />
            <span className="unit">원</span>
          </span>
        </label>
      </section>

      <div className="cfoot">
        <div />
        <button type="button" className="btn-secondary" onClick={() => go('#/check')}>
          원칙과 점검하기 <IconArrowRight />
        </button>
      </div>

      {(showHoldingForm || editing) && (
        <HoldingForm
          initial={editing}
          lynchActive={lynchActive}
          onCancel={() => {
            setShowHoldingForm(false);
            setEditing(null);
          }}
          onSave={(h) => {
            onUpsertHolding(h);
            setShowHoldingForm(false);
            setEditing(null);
          }}
          onRemove={
            editing
              ? () => {
                  if (window.confirm(`${editing.name || editing.ticker}을(를) 보유 목록에서 지울까요? 매매 기록은 남습니다.`)) {
                    onRemoveHolding(editing.ticker);
                    setEditing(null);
                  }
                }
              : undefined
          }
          onManualPrice={editing ? (p) => onManualPrice(editing.ticker, p) : undefined}
        />
      )}

      {showTradeForm && (
        <TradeForm
          data={data}
          state={state}
          lynchActive={lynchActive}
          onCancel={() => setShowTradeForm(false)}
          onSave={(t, nh) => {
            const err = onAddTrade(t, nh);
            if (err) return err;
            setShowTradeForm(false);
            return null;
          }}
        />
      )}
    </>
  );
}

// ---------- 보유 종목 폼 ----------

interface HoldingFormProps {
  initial: Holding | null;
  lynchActive: boolean;
  onCancel: () => void;
  onSave: (h: Holding) => void;
  onRemove?: () => void;
  onManualPrice?: (price: number | null) => void;
}

function HoldingForm({ initial, lynchActive, onCancel, onSave, onRemove, onManualPrice }: HoldingFormProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [assetClass, setAssetClass] = useState<AssetClass>(initial?.asset_class ?? 'stock');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'KRW');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [avgPrice, setAvgPrice] = useState(initial ? String(initial.avg_price) : '');
  const [why, setWhy] = useState(initial?.why_i_know ?? '');
  const [since, setSince] = useState(initial ? initial.since.slice(0, 10) : todayLocal());
  const [manual, setManual] = useState(initial?.manual_price !== undefined ? String(initial.manual_price) : '');
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const q = Number(quantity);
    const p = Number(avgPrice);
    if (!t) return setErr('종목 코드를 입력하세요.');
    if (!Number.isFinite(q) || q < 0) return setErr('수량을 확인하세요.');
    if (!Number.isFinite(p) || p < 0) return setErr('평단가를 확인하세요.');
    if (lynchActive && assetClass === 'stock' && !why.trim()) {
      return setErr('린치 원칙을 채택 중입니다. 개별 주식에는 "왜 아는가"를 써야 합니다.');
    }
    const h: Holding = {
      ticker: t,
      name: name.trim() || t,
      asset_class: assetClass,
      currency,
      quantity: q,
      avg_price: p,
      why_i_know: why.trim(),
      since: toIso(since),
    };
    if (initial?.manual_price !== undefined) {
      h.manual_price = initial.manual_price;
      h.manual_price_at = initial.manual_price_at;
    }
    onSave(h);
    if (onManualPrice) {
      const m = Number(manual);
      if (manual.trim() === '') onManualPrice(null);
      else if (Number.isFinite(m) && m > 0) onManualPrice(m);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onCancel} role="presentation">
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="h3">{initial ? '보유 종목 수정' : '보유 종목 등록'}</h2>
        <div className="form-grid">
          <label>
            <span>종목 코드</span>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="005930 / SPY" disabled={!!initial} autoCapitalize="characters" />
          </label>
          <label>
            <span>종목명</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="삼성전자" />
          </label>
          <label>
            <span>자산군</span>
            <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CLASS_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>통화</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="KRW">KRW (원)</option>
              <option value="USD">USD (달러)</option>
            </select>
          </label>
          <label>
            <span>수량</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            <span>평단가</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} />
          </label>
          <label>
            <span>보유 시작일</span>
            <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </label>
          {onManualPrice && (
            <label>
              <span>현재가 직접 입력 (선택)</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="시세 캐시에 없을 때" />
            </label>
          )}
        </div>
        {assetClass === 'stock' && (
          <label className="form-full">
            <span>
              왜 아는가 {lynchActive ? <em className="req">(린치 원칙 채택 중 · 필수)</em> : <em>(선택)</em>}
            </span>
            <textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="이 회사가 무엇으로 돈을 버는지, 내가 왜 그걸 아는지 한 문단으로." />
          </label>
        )}
        {err && <p className="form-err" role="alert">{err}</p>}
        <div className="backup-row">
          <button type="submit" className="btn-primary">
            저장
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            취소
          </button>
          {onRemove && (
            <button type="button" className="btn-link muted" onClick={onRemove}>
              삭제
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------- 매매 기록 폼 ----------

interface TradeFormProps {
  data: PrincipleData;
  state: UserState;
  lynchActive: boolean;
  onCancel: () => void;
  onSave: (t: Trade, newHolding?: Omit<Holding, 'quantity' | 'avg_price' | 'since'>) => string | null;
}

function TradeForm({ data, state, lynchActive, onCancel, onSave }: TradeFormProps) {
  const active = activeIds(state);
  const byId = new Map(data.principles.map((p) => [p.principle_id, p]));
  const customById = new Map(state.custom_principles.map((c) => [c.principle_id, c]));
  const [ticker, setTicker] = useState(state.holdings[0]?.ticker ?? '');
  const [isNew, setIsNew] = useState(state.holdings.length === 0);
  const [side, setSide] = useState<Trade['side']>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  // 신규 종목
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('stock');
  const [currency, setCurrency] = useState<Currency>('KRW');
  const [why, setWhy] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return setErr('종목을 선택하거나 입력하세요.');
    const q = Number(quantity);
    const p = Number(price);
    if (!(q > 0)) return setErr('수량을 확인하세요.');
    if (!(p >= 0)) return setErr('가격을 확인하세요.');
    if (tags.length === 0) return setErr('근거가 된 원칙을 하나 이상 선택하세요. 태그는 필수입니다.');
    const existing = state.holdings.find((h) => h.ticker === t);
    if (side === 'sell' && (!existing || existing.quantity < q)) return setErr('보유 수량보다 많이 팔 수 없습니다.');
    let newHolding: Omit<Holding, 'quantity' | 'avg_price' | 'since'> | undefined;
    if (!existing) {
      if (side === 'sell') return setErr('보유하지 않은 종목은 팔 수 없습니다.');
      if (lynchActive && assetClass === 'stock' && !why.trim()) {
        return setErr('린치 원칙을 채택 중입니다. 개별 주식에는 "왜 아는가"를 써야 합니다.');
      }
      newHolding = { ticker: t, name: name.trim() || t, asset_class: assetClass, currency, why_i_know: why.trim() };
    }
    const trade: Trade = {
      trade_id: `trade_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ticker: t,
      side,
      quantity: q,
      price: p,
      traded_at: toIso(date),
      principle_tags: tags,
    };
    if (note.trim()) trade.note = note.trim();
    const e2 = onSave(trade, newHolding);
    if (e2) setErr(e2);
  };

  return (
    <div className="sheet-backdrop" onClick={onCancel} role="presentation">
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="h3">매매 기록 추가</h2>
        <div className="seg">
          <button type="button" className={side === 'buy' ? 'seg-btn active' : 'seg-btn'} onClick={() => setSide('buy')}>
            매수
          </button>
          <button type="button" className={side === 'sell' ? 'seg-btn active' : 'seg-btn'} onClick={() => setSide('sell')}>
            매도
          </button>
        </div>
        <div className="form-grid">
          <label className="form-full">
            <span>종목</span>
            {isNew ? (
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="종목 코드 (005930 / SPY)" autoCapitalize="characters" />
            ) : (
              <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
                {state.holdings.map((h) => (
                  <option key={h.ticker} value={h.ticker}>
                    {h.name || h.ticker} ({h.ticker}) · {h.quantity}주
                  </option>
                ))}
              </select>
            )}
            {side === 'buy' && state.holdings.length > 0 && (
              <button type="button" className="btn-link" onClick={() => setIsNew((n) => !n)}>
                {isNew ? '보유 종목에서 선택' : '새 종목 입력'}
              </button>
            )}
          </label>
          {isNew && (
            <>
              <label>
                <span>종목명</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                <span>자산군</span>
                <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
                  {ASSET_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {ASSET_CLASS_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>통화</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </>
          )}
          <label>
            <span>수량</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            <span>가격</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>
            <span>날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        {isNew && assetClass === 'stock' && (
          <label className="form-full">
            <span>
              왜 아는가 {lynchActive ? <em className="req">(필수)</em> : <em>(선택)</em>}
            </span>
            <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
          </label>
        )}

        <fieldset className="tagset">
          <legend>
            근거 원칙 <em className="req">(필수)</em>
          </legend>
          {active.map((id) => {
            const title = byId.get(id)?.title ?? customById.get(id)?.title ?? id;
            const on = tags.includes(id);
            return (
              <button key={id} type="button" className={on ? 'tag-btn on' : 'tag-btn'} aria-pressed={on} onClick={() => toggle(id)}>
                {title}
              </button>
            );
          })}
        </fieldset>
        <label className="form-full">
          <span>메모 (선택)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="이 매매를 한 이유를 한 줄로" />
        </label>
        {err && <p className="form-err" role="alert">{err}</p>}
        <div className="backup-row">
          <button type="submit" className="btn-primary">
            기록 저장
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
