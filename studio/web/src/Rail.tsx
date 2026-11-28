import React, {useEffect, useState} from 'react';
import {Bulb, Chart, Film, Gear, Home, Menu, Monitor, Moon, Phone, Plus, Reel, Sun, Tv, X} from './icons';
import {hashFor, setRoute, type Page, type Route} from './router';
import type {ChannelRow} from './api';
import {t} from './i18n';
import {getTheme, nextTheme, setTheme, type Theme} from './theme';

// Ordered as the creator's flow: start, then the work in progress, then the inputs and the results.
const MAIN: {page: Page; label: string; Icon: typeof Home}[] = [{page: 'today', label: 'Today', Icon: Home}, {page: 'ideas', label: 'Ideas', Icon: Bulb}, {page: 'pipeline', label: 'Pipeline', Icon: Reel}, {page: 'library', label: 'Library', Icon: Film}, {page: 'clipper', label: 'Clipper', Icon: Phone}, {page: 'analytics', label: 'Analytics', Icon: Chart}];
const FOOT: typeof MAIN = [{page: 'channels', label: 'Channels', Icon: Tv}, {page: 'settings', label: 'Settings', Icon: Gear}];
const THEME_LABEL: Record<Theme, string> = {system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark'};

export function Rail({route, chans}: {route: Route; chans: ChannelRow[]}) {
  const [menu, setMenu] = useState(false);
  const [theme, setT] = useState<Theme>(getTheme);
  useEffect(() => { const c = () => setMenu(false); window.addEventListener('hashchange', c); return () => window.removeEventListener('hashchange', c); }, []);
  const link = (n: typeof MAIN[number]) => (
    <a key={n.page} className="nav-link" href={hashFor({page: n.page, ch: n.page === 'settings' || n.page === 'channels' ? undefined : route.ch})} aria-current={route.page === n.page || (n.page === 'library' && route.page === 'ep') ? 'page' : undefined}>
      <n.Icon size={18} /><span>{t(n.label)}</span>
    </a>
  );
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <nav className="nav-rail" aria-label={t('Main')} onKeyDown={e => { if (e.key === 'Escape' && menu) { setMenu(false); document.getElementById('menu-btn')?.focus(); } }}>
      <a className="nav-brand" href={hashFor({page: 'today', ch: route.ch})}><span className="egg" aria-hidden="true" /><span className="nav-brand-t">Mascot Engine</span></a>
      <div className="nav-scope">
        <label className="sr" htmlFor="scope">Channel</label>
        <select id="scope" value={route.ch} onChange={e => setRoute({ch: e.target.value})}>
          <option value="all">All channels</option>
          {chans.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {route.ch !== 'all' && !chans.some(c => c.id === route.ch) && <option value={route.ch}>{route.ch}</option>}
        </select>
      </div>
      <button type="button" id="menu-btn" className="menu-btn" aria-expanded={menu} aria-controls="rail-body" onClick={() => setMenu(m => !m)}>{menu ? <X size={18} /> : <Menu size={18} />}<span>{t('Menu')}</span></button>
      <div className="nav-body" id="rail-body" data-open={menu}>
        <a className="btn primary nav-new" href={hashFor({page: 'new', ch: route.ch})}><Plus size={16} />{t('New video')}</a>
        <div className="nav-group">{MAIN.map(link)}</div>
        <div className="nav-group nav-foot">
          {FOOT.map(link)}
          <button type="button" className="nav-link" onClick={() => { const n = nextTheme(theme); setTheme(n); setT(n); }} title="Switch between system, light and dark"><ThemeIcon size={18} /><span>{THEME_LABEL[theme]}</span></button>
        </div>
      </div>
    </nav>
  );
}
