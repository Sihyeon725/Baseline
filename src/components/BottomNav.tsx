import { IconBook, IconClock, IconHome, IconPie } from './Icons';
import type { Route } from './Header';

interface Props {
  route: Route;
  count: number;
  go: (hash: string) => void;
}

export function BottomNav({ route, count, go }: Props) {
  const isHomeOrLib = route === 'home' || route === 'library' || route === 'principle';
  return (
    <nav className="bottomnav" aria-label="하단 메뉴">
      <button type="button" className={isHomeOrLib ? 'bn-item active' : 'bn-item'} onClick={() => go('#/library')}>
        <IconHome />
        <span>원칙</span>
      </button>
      <button
        type="button"
        className={route === 'constitution' ? 'bn-item active' : 'bn-item'}
        onClick={() => go('#/constitution')}
      >
        <span className="bn-icon-wrap">
          <IconBook />
          {count > 0 && <span className="bn-badge">{count}</span>}
        </span>
        <span>헌법</span>
      </button>
      <span className="bn-item disabled" aria-disabled="true" title="준비 중">
        <IconPie />
        <span>포폴</span>
      </span>
      <span className="bn-item disabled" aria-disabled="true" title="준비 중">
        <IconClock />
        <span>기록</span>
      </span>
    </nav>
  );
}
