import { useState } from 'react';
import { IconMenu, IconX, LogoMark } from './Icons';

export type Route = 'home' | 'library' | 'principle' | 'constitution';

interface Props {
  route: Route;
  count: number;
  go: (hash: string) => void;
}

const NAV: { hash: string; label: string; route: Route | null; soon?: boolean }[] = [
  { hash: '#/library', label: '원칙 라이브러리', route: 'library' },
  { hash: '#/constitution', label: '나의 헌법', route: 'constitution' },
  { hash: '', label: '포트폴리오', route: null, soon: true },
  { hash: '', label: '기록', route: null, soon: true },
];

export function Header({ route, count, go }: Props) {
  const [open, setOpen] = useState(false);
  const activeRoute: Route = route === 'principle' ? 'library' : route;

  const nav = (hash: string) => {
    setOpen(false);
    go(hash);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <button type="button" className="brand" onClick={() => nav('#/')} aria-label="BASELINE 홈">
          <LogoMark className="brand-mark" />
          <span className="brand-name">BASELINE</span>
        </button>

        <nav className="topnav" aria-label="주 메뉴">
          {NAV.map((n) =>
            n.soon ? (
              <span key={n.label} className="topnav-item soon" title="준비 중">
                {n.label}
              </span>
            ) : (
              <button
                key={n.label}
                type="button"
                className={activeRoute === n.route ? 'topnav-item active' : 'topnav-item'}
                onClick={() => nav(n.hash)}
              >
                {n.label}
                {n.route === 'constitution' && count > 0 && <span className="count-dot">{count}</span>}
              </button>
            ),
          )}
        </nav>

        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {open && (
        <div className="drawer" role="dialog" aria-label="메뉴">
          {NAV.map((n) =>
            n.soon ? (
              <span key={n.label} className="drawer-item soon">
                {n.label} <small>준비 중</small>
              </span>
            ) : (
              <button key={n.label} type="button" className="drawer-item" onClick={() => nav(n.hash)}>
                {n.label}
              </button>
            ),
          )}
        </div>
      )}
    </header>
  );
}
