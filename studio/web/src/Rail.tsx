import React, {useEffect, useState} from 'react';
import {Bulb, Chart, Film, Gear, Home, Menu, Phone, Reel, Tv, X} from './icons';
import {hashFor, type Page, type Route} from './router';
import {getLang, setLang, t} from './i18n';

const MAIN: {page: Page; label: string; Icon: typeof Home}[] = [{page: 'today', label: 'Today', Icon: Home}, {page: 'pipeline', label: 'Pipeline', Icon: Reel}, {page: 'library', label: 'Library', Icon: Film}, {page: 'ideas', label: 'Ideas', Icon: Bulb}, {page: 'clipper', label: 'Clipper', Icon: Phone}, {page: 'analytics', label: 'Analytics', Icon: Chart}];
const FOOT: typeof MAIN = [{page: 'channels', label: 'Channels', Icon: Tv}, {page: 'settings', label: 'Settings', Icon: Gear}];

export function Rail({route}: {route: Route}) {
  const [menu, setMenu] = useState(false);
  useEffect(() => { const c = () => setMenu(false); window.addEventListener('hashchange', c); return () => window.removeEventListener('hashchange', c); }, []);
  const link = (n: typeof MAIN[number]) => (
    <a key={n.page} className="nav-link" href={hashFor({page: n.page, ch: n.page === 'settings' || n.page === 'channels' ? undefined : route.ch})} aria-current={route.page === n.page || (n.page === 'library' && route.page === 'ep') ? 'page' : undefined}>
      <n.Icon size={20} /><span>{t(n.label)}</span>
    </a>
  );
  return (
    <nav className="nav-rail" aria-label={t('Main')} onKeyDown={e => { if (e.key === 'Escape' && menu) { setMenu(false); document.getElementById('menu-btn')?.focus(); } }}>
      <a className="nav-brand" href={hashFor({page: 'today', ch: route.ch})}><span className="egg" aria-hidden="true" /><span className="nav-brand-t">Mascot Engine</span></a>
      <button type="button" id="menu-btn" className="menu-btn" aria-expanded={menu} aria-controls="rail-body" onClick={() => setMenu(m => !m)}>{menu ? <X size={18} /> : <Menu size={18} />}<span>{t('Menu')}</span></button>
      <div className="nav-body" id="rail-body" data-open={menu}>
        <div className="nav-group">{MAIN.map(link)}</div>
        <div className="nav-group nav-foot">{FOOT.map(link)}<button type="button" className="nav-link" aria-label={t('UI language')} onClick={() => setLang(getLang() === 'hu' ? 'en' : 'hu')}><span>{getLang() === 'hu' ? 'HU → EN' : 'EN → HU'}</span></button></div>
      </div>
    </nav>
  );
}
