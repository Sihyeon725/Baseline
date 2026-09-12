import { IconBook, IconClock, IconHome, IconPie, IconScale } from './Icons';
import { navRoute, type Route } from './Header';

interface Props {
  route: Route;
  count: number;
  go: (hash: string) => void;
}

export function BottomNav({ route, count, go }: Props) {
  const active = navRoute(route);
  const cls = (r: Route) => (active === r || (r === 'library' && active === 'home') ? 'bn-item active' : 'bn-item');
  return (
    <nav className="bottomnav" aria-label="하단 메뉴">
      <button type="button" className={cls('library')} onClick={() => go('#/library')}>
        <IconHome />
        <span>원칙</span>
      </button>
      <button type="button" className={cls('constitution')} onClick={() => go('#/constitution')}>
        <span className="bn-icon-wrap">
          <IconBook />
          {count > 0 && <span className="bn-badge">{count}</span>}
        </span>
        <span>헌법</span>
      </button>
      <button type="button" className={cls('portfolio')} onClick={() => go('#/portfolio')}>
        <IconPie />
        <span>포폴</span>
      </button>
      <button type="button" className={cls('check')} onClick={() => go('#/check')}>
        <IconScale />
        <span>점검</span>
      </button>
      <button type="button" className={cls('history')} onClick={() => go('#/history')}>
        <IconClock />
        <span>기록</span>
      </button>
    </nav>
  );
}
