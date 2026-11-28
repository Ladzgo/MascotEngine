import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {api, type ChannelRow, type Settings as SettingsT, type Summary} from './api';
import {Alert} from './icons';
import {Library} from './Library';
import {NewVideo} from './NewVideo';
import {Overview} from './Overview';
import {Toasts} from './toast';
import {Palette} from './Palette';
import {Rail} from './Rail';
import {Settings} from './Settings';
import {ShortcutSheet, useGlobalShortcuts} from './Shortcuts';
import {TopBar, useJobs} from './TopBar';
import {PAGE_LABEL, STEP_LABEL, hasPage, nextStep, optionalPages, setRoute, useRoute, type RouteInput} from './router';
import {t, useLang} from './i18n';
import {Loading} from './Loading';

// rarely visited pages load on demand (smaller first bundle)
const lazyNamed = <T extends React.ComponentType<any>>(f: () => Promise<Record<string, unknown>>, n: string) => React.lazy(() => f().then(m => ({default: m[n] as T})));
const Analytics = lazyNamed(() => import('./Analytics'), 'Analytics');
const Clipper = lazyNamed(() => import('./Clipper'), 'Clipper');
const Channels = lazyNamed<typeof import('./Channels').Channels>(() => import('./Channels'), 'Channels');
const Ideas = lazyNamed<typeof import('./Ideas').Ideas>(() => import('./Ideas'), 'Ideas');

type Loaded = React.ComponentType<Record<string, unknown>>;
const lazyCache = new Map<string, React.LazyExoticComponent<Loaded>>();
/** Lazy-mount an optional lane page by export name; null when its file is not there yet. */
function lazyPage(name: string): React.LazyExoticComponent<Loaded> | null {
  if (!hasPage(name)) return null;
  let c = lazyCache.get(name);
  if (!c) { c = React.lazy(() => optionalPages[`./${name}.tsx`]().then(m => ({default: (m[name] ?? m.default) as Loaded}))); lazyCache.set(name, c); }
  return c;
}

class Boundary extends React.Component<{children: React.ReactNode; name: string}, {err: Error | null}> {
  state = {err: null as Error | null};
  static getDerivedStateFromError(err: Error) { return {err}; }
  componentDidUpdate(p: {name: string}) { if (p.name !== this.props.name && this.state.err) this.setState({err: null}); }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="page"><div className="alert" role="alert"><Alert size={18} /><span>{this.props.name} failed to load: {this.state.err.message}</span><button className="btn sm" onClick={() => this.setState({err: null})}>Try again</button></div></div>;
  }
}

function Soon({name, hint}: {name: string; hint: string}) {
  return <div className="page"><div className="page-head"><div><h1 className="display" tabIndex={-1}>{name}</h1></div></div><div className="panel empty-box"><h2 className="display">{name} is not ready yet</h2><p>{hint}</p><a className="btn primary" href="#/library">Open Library</a></div></div>;
}


export function App() {
  const route = useRoute();
  const lang = useLang();
  const [eps, setEps] = useState<Summary[]>([]);
  const [epsLoaded, setEpsLoaded] = useState(false);
  const [chans, setChans] = useState<ChannelRow[]>([]);
  const [cfg, setCfg] = useState<SettingsT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pal, setPal] = useState(false), [help, setHelp] = useState(false);
  const jobs = useJobs();
  const first = useRef(true);

  const loadEps = useCallback(() => api.episodes().then(e => { setEps(e); setEpsLoaded(true); }).catch(e => setErr(e.message)), []);
  const loadChans = useCallback(() => api.channels().then(setChans).catch(e => setErr(e.message)), []);
  const loadCfg = useCallback(() => api.settings().then(setCfg).catch(() => {}), []);
  useEffect(() => { void loadEps(); void loadChans(); void loadCfg(); }, [loadEps, loadChans, loadCfg]);
  useEffect(() => { if (jobs.finished) void loadEps(); }, [jobs.finished, loadEps]);

  const openPalette = useCallback(() => setPal(true), []);
  const toggleHelp = useCallback(() => setHelp(h => !h), []);
  useGlobalShortcuts(openPalette, toggleHelp);

  // canonical URLs
  useEffect(() => {
    if (!location.hash || location.hash === '#' || location.hash === '#/') { setRoute({page: 'today'}, true); return; }
    if (route.page === 'ep' && route.ep && !route.step && epsLoaded) setRoute({step: nextStep(eps.find(e => e.id === route.ep))}, true);
    if (chans.length && route.chRaw && route.chRaw !== 'all' && !chans.some(c => c.id === route.chRaw)) setRoute({ch: chans[0].id}, true);
  }, [route, epsLoaded, eps, chans]);

  const ep = route.ep ? eps.find(e => e.id === route.ep) : undefined;
  const pageName = route.page === 'ep' ? `${ep?.title ?? route.ep}${route.step ? ` · ${t(STEP_LABEL[route.step])}` : ''}` : t(PAGE_LABEL[route.page]);
  useEffect(() => {
    const mark = jobs.running ? '● ' : jobs.finished ? (jobs.finished.status === 'done' ? '✓ ' : '! ') : '';
    document.title = `${mark}${pageName} · Mascot Engine Studio`;
  }, [pageName, jobs.running, jobs.finished]);
  // focus the page heading on navigation (not on first load)
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { const el = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main'); el?.focus({preventScroll: true}); }, 60);
    return () => clearTimeout(t);
  }, [route.page, route.ep, route.step, route.chanId]);

  const active = route.ch === 'all' ? null : chans.find(c => c.id === route.ch) ?? null;
  const onPick = useCallback((id: string) => setRoute({ch: id}), []);
  const onRoute = useCallback((p: {step?: string; scene?: number}) => setRoute(p as Partial<RouteInput>), []);
  const changed = useCallback(() => { void loadEps(); void loadChans(); }, [loadEps, loadChans]);

  const Workspace = useMemo(() => lazyPage('Workspace'), []);
  const Pipeline = useMemo(() => lazyPage('Pipeline'), []);
  const Calendar = useMemo(() => lazyPage('Calendar'), []);
  const Queue = useMemo(() => lazyPage('Queue'), []);

  const optional = (C: React.LazyExoticComponent<Loaded> | null, name: string, hint: string) => C
    ? <Boundary name={name}><Suspense fallback={<Loading />}><C ch={route.ch} /></Suspense></Boundary> : <Soon name={name} hint={hint} />;

  let body: React.ReactNode;
  {
    let page: React.ReactNode;
    switch (route.page) {
      case 'today': page = <Overview ch={route.ch} chans={chans} eps={eps} cfg={cfg} onChanged={changed} />; break;
      case 'new': page = <NewVideo ch={route.ch} chans={chans} ep={route.ep} onChanged={changed} />; break;
      case 'library': page = <Library route={route} eps={eps} chans={chans} loaded={epsLoaded} onChanged={changed} />; break;
      case 'ideas': page = <Ideas channel={active} cfg={cfg} chans={chans} f={route.f} />; break;
      case 'channels': page = <Channels route={route} active={route.ch} onPick={onPick} onChanged={changed} />; break;
      case 'settings': page = <Settings onSaved={loadCfg} />; break;
      case 'pipeline': page = optional(Pipeline, 'Pipeline', 'The board that shows every episode by stage is being built. Use the Library for now.'); break;
      case 'calendar': page = optional(Calendar, 'Calendar', 'The publishing calendar is being built. Use the Library for now.'); break;
      case 'analytics': page = <Boundary name="Analytics"><Analytics /></Boundary>; break;
      case 'clipper': page = <Boundary name="Clipper"><Clipper /></Boundary>; break;
      case 'queue': page = optional(Queue, 'Queue', 'The render queue is being built. The Jobs chip shows the current run.'); break;
      default: page = Workspace && route.ep
        ? <Boundary name="Episode"><Suspense fallback={<Loading />}><Workspace key={route.ep} id={route.ep} step={route.step} scene={route.scene} onRoute={onRoute} /></Suspense></Boundary> : null;
    }
    body = <main className="main" id="main" tabIndex={-1}>{err && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span><button className="btn ghost sm" onClick={() => setErr(null)}>Dismiss</button></div>}<Suspense fallback={<Loading />}><Boundary name={pageName}>{page}</Boundary></Suspense></main>;
  }

  return (
    <div className="app" key={lang}>
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Rail route={route} chans={chans} />
      <TopBar route={route} chans={chans} epTitle={ep?.title} epChannel={ep?.channel} jobs={jobs} onPalette={openPalette} />
      {body}
      <Palette open={pal} onClose={() => setPal(false)} eps={eps} chans={chans} ch={route.ch} onHelp={() => setHelp(true)} />
      <ShortcutSheet open={help} onClose={() => setHelp(false)} />
      <Toasts />
    </div>
  );
}
