import { useCallback, useEffect, useMemo, useState } from 'react';
import data from './data/principles.json';
import { Header, type Route } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Landing } from './components/Landing';
import { Library } from './components/Library';
import { PrincipleDetail } from './components/PrincipleDetail';
import { Constitution } from './components/Constitution';
import { activeCount, adopt, drop, loadState, saveState, setParam } from './lib/store';
import type { Principle, PrincipleData, UserState } from './lib/types';

const principleData = data as PrincipleData;

interface Location {
  route: Route;
  param: string | null;
}

function parseHash(hash: string): Location {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  const [head, tail] = path.split('/');
  if (head === 'library') return { route: 'library', param: tail || null };
  if (head === 'principle' && tail) return { route: 'principle', param: tail };
  if (head === 'constitution') return { route: 'constitution', param: null };
  return { route: 'home', param: null };
}

export default function App() {
  const [state, setState] = useState<UserState>(() => loadState());
  const [loc, setLoc] = useState<Location>(() => parseHash(window.location.hash));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

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
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const byId = useMemo(() => new Map(principleData.principles.map((p) => [p.principle_id, p])), []);

  const handleAdopt = (p: Principle) => {
    setState((s) => adopt(s, p));
    setToast('나의 투자 헌법에 추가했습니다');
  };
  const handleDrop = (id: string) => {
    setState((s) => drop(s, id));
    setToast('원칙을 내려놓았습니다. 기록은 남습니다');
  };
  const handleParam = (id: string, key: string, value: number) => {
    setState((s) => setParam(s, id, key, value));
  };
  const handleReplaceState = (next: UserState) => {
    setState(next);
    setToast('백업을 불러왔습니다');
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
          결과의 책임은 본인에게 있습니다.
        </p>
        <p>데이터는 이 기기의 브라우저에만 저장됩니다. 로그인도, 서버 전송도 없습니다.</p>
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
