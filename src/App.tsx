import { useCallback, useEffect, useMemo, useState } from 'react';
import data from './data/principles.json';
import { Header, type Route } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Landing } from './components/Landing';
import { Library } from './components/Library';
import { PrincipleDetail } from './components/PrincipleDetail';
import { Constitution } from './components/Constitution';
import { Portfolio } from './components/Portfolio';
import { Check } from './components/Check';
import { History } from './components/History';
import { ChangeFlow } from './components/ChangeFlow';
import { Narrative } from './components/Narrative';
import {
  activeCount,
  addCustomPrinciple,
  addHistory,
  addTrade,
  adopt,
  drop,
  loadState,
  removeHolding,
  removeTrade,
  saveState,
  setManualPrice,
  setParam,
  setSettings,
  upsertHolding,
} from './lib/store';
import { loadPriceSnapshot } from './lib/prices';
import { buildPriceContext, valuate } from './lib/portfolio';
import type { CustomPrinciple, Holding, Principle, PrincipleData, PrincipleHistory, PriceSnapshot, Trade, UserState } from './lib/types';

const principleData = data as PrincipleData;

interface Location {
  route: Route;
  param: string | null;
  param2: string | null;
}

function parseHash(hash: string): Location {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  const [head, tail, third] = path.split('/');
  const none: Location = { route: 'home', param: null, param2: null };
  if (head === 'library') return { ...none, route: 'library', param: tail || null };
  if (head === 'principle' && tail) return { ...none, route: 'principle', param: tail };
  if (head === 'constitution') return { ...none, route: 'constitution' };
  if (head === 'portfolio') return { ...none, route: 'portfolio' };
  if (head === 'check') return { ...none, route: 'check' };
  if (head === 'history') return { ...none, route: 'history' };
  if (head === 'narrative') return { ...none, route: 'narrative' };
  if (head === 'change') return { route: 'change', param: tail && tail !== '-' ? tail : null, param2: third && third !== '-' ? third : null };
  return none;
}

/** 나만의 원칙을 카드 형태로 바꿔 라이브러리 카드와 같은 화면에서 다룬다 */
function customAsPrinciple(c: CustomPrinciple): Principle {
  return {
    principle_id: c.principle_id,
    master: '나만의 원칙',
    title: c.title,
    quote: null,
    body: c.body,
    source_book: c.ai_source === 'claude' ? 'AI 논리 일관성 검토 통과' : '기본 점검 통과 (AI 미사용)',
    check_type: 'self',
    user_param: null,
  };
}

export default function App() {
  const [state, setState] = useState<UserState>(() => loadState());
  const [loc, setLoc] = useState<Location>(() => parseHash(window.location.hash));
  const [toast, setToast] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    let alive = true;
    loadPriceSnapshot().then((s) => {
      if (alive) setSnapshot(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setLoc(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((hash: string) => {
    setLoc(parseHash(hash)); // hashchange 타이밍에 의존하지 않도록 즉시 전환
    if (window.location.hash !== hash) window.location.hash = hash;
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const byId = useMemo(() => {
    const m = new Map(principleData.principles.map((p) => [p.principle_id, p]));
    for (const c of state.custom_principles) m.set(c.principle_id, customAsPrinciple(c));
    return m;
  }, [state.custom_principles]);

  const ctx = useMemo(() => buildPriceContext(snapshot, state.settings.usd_krw), [snapshot, state.settings.usd_krw]);
  const currentReturn = useMemo(() => valuate(state, ctx).return_pct, [state, ctx]);

  const handleAdopt = (p: Principle) => {
    setState((s) => adopt(s, p));
    setToast('나의 투자 헌법에 추가했습니다');
  };
  /** v3: 내려놓기는 서술을 거친다 (명세서 [5] 원칙 폐기 → [6] 서술 필수). 잠금은 아니다 — 다 쓰면 통과된다. */
  const handleDrop = (id: string) => go(`#/change/${id}/-`);
  const handleParam = (id: string, key: string, value: number) => {
    setState((s) => setParam(s, id, key, value));
  };
  const handleReplaceState = (next: UserState) => {
    setState(next);
    setToast('백업을 불러왔습니다');
  };
  const handleCommitChange = (entry: PrincipleHistory) => {
    setState((s) => {
      let next = addHistory(s, entry);
      if (entry.from_principle) next = drop(next, entry.from_principle);
      if (entry.to_principle) {
        const p = byId.get(entry.to_principle);
        if (p) next = adopt(next, p);
      }
      return next;
    });
    setToast(entry.to_principle ? '원칙을 바꿨습니다. 이유는 기록에 남습니다' : '원칙을 내려놓았습니다. 이유는 기록에 남습니다');
    go('#/history');
  };
  const handleRegisterCustom = (c: CustomPrinciple) => {
    setState((s) => addCustomPrinciple(s, c));
    setToast('나만의 원칙으로 등록했습니다');
    go('#/constitution');
  };

  const count = activeCount(state);

  let content;
  if (loc.route === 'library') {
    content = <Library data={principleData} state={state} masterFilter={loc.param} go={go} />;
  } else if (loc.route === 'principle') {
    const p = loc.param ? byId.get(loc.param) : undefined;
    content = p ? (
      <PrincipleDetail
        data={principleData}
        principle={p}
        state={state}
        onAdopt={handleAdopt}
        onDrop={handleDrop}
        onParam={handleParam}
        go={go}
      />
    ) : (
      <div className="page-head">
        <h1 className="h1">원칙을 찾을 수 없습니다.</h1>
        <button type="button" className="btn-link" onClick={() => go('#/library')}>
          원칙 라이브러리로
        </button>
      </div>
    );
  } else if (loc.route === 'constitution') {
    content = (
      <Constitution
        data={principleData}
        byId={byId}
        state={state}
        onDrop={handleDrop}
        onReAdopt={handleAdopt}
        onParam={handleParam}
        onReplaceState={handleReplaceState}
        go={go}
      />
    );
  } else if (loc.route === 'portfolio') {
    content = (
      <Portfolio
        data={principleData}
        state={state}
        ctx={ctx}
        onUpsertHolding={(h: Holding) => {
          setState((s) => upsertHolding(s, h));
          setToast('보유 종목을 저장했습니다');
        }}
        onRemoveHolding={(t) => setState((s) => removeHolding(s, t))}
        onManualPrice={(t, p) => setState((s) => setManualPrice(s, t, p))}
        onAddTrade={(t: Trade, nh) => {
          try {
            const next = addTrade(state, t, nh);
            setState(next);
            setToast('매매 기록을 저장했습니다');
            return null;
          } catch (e) {
            return (e as Error).message;
          }
        }}
        onRemoveTrade={(id) => setState((s) => removeTrade(s, id))}
        onSetUsdKrw={(rate) => setState((s) => setSettings(s, { usd_krw: rate }))}
        go={go}
      />
    );
  } else if (loc.route === 'check') {
    content = <Check data={principleData} state={state} ctx={ctx} snapshot={snapshot} go={go} />;
  } else if (loc.route === 'history') {
    content = <History data={principleData} state={state} go={go} />;
  } else if (loc.route === 'change') {
    content = (
      <ChangeFlow
        key={`${loc.param}-${loc.param2}`}
        data={principleData}
        state={state}
        fromId={loc.param}
        toId={loc.param2}
        returnPct={currentReturn}
        onCommit={handleCommitChange}
        go={go}
      />
    );
  } else if (loc.route === 'narrative') {
    content = <Narrative data={principleData} state={state} ctx={ctx} onRegister={handleRegisterCustom} go={go} />;
  } else {
    content = <Landing data={principleData} go={go} />;
  }

  return (
    <div className={`app route-${loc.route}`}>
      <Header route={loc.route} count={count} go={go} />
      <main className="main">{content}</main>
      <footer className="footer">
        <p className="footer-brand">BASELINE · Set your baseline.</p>
        <p>
          이 사이트는 특정 종목이나 매매 시점을 추천하지 않습니다. 원칙과 기록을 돕는 도구일 뿐이며, 투자 판단과
          결과의 책임은 본인에게 있습니다. 과거 수익률은 미래를 보장하지 않습니다.
        </p>
        <p>
          데이터는 이 기기의 브라우저에만 저장됩니다. 로그인도, 서버 전송도 없습니다. AI 검토를 누를 때만 그 서술이
          서버를 거칩니다.
        </p>
        <p>시세는 하루 1회 종가로 갱신되는 지연 데이터입니다.</p>
      </footer>
      <BottomNav route={loc.route} count={count} go={go} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
