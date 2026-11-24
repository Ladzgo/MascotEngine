// Tiny UI dictionary: t('English text') -> Hungarian when the UI language is hu. Unknown strings stay English.
import {useSyncExternalStore} from 'react';

export type Lang = 'en' | 'hu';
const KEY = 'studio.lang';
export const HU: Record<string, string> = {
  Today: 'Ma', Pipeline: 'Folyamat', Library: 'Könyvtár', Ideas: 'Ötletek', Clipper: 'Vágó', Analytics: 'Elemzés', Channels: 'Csatornák', Settings: 'Beállítások', Queue: 'Sor', Calendar: 'Naptár', Episode: 'Epizód', Menu: 'Menü', 'Main': 'Fő',
  Script: 'Script', Voice: 'Hang', Visuals: 'Képek', Render: 'Renderelés', Publish: 'Kiadás',
  'Skip to content': 'Ugrás a tartalomra', 'Loading…': 'Betöltés…', Language: 'Nyelv', 'UI language': 'Felület nyelve',
  // Today
  'What needs you next': 'Mi vár rád legközelebb', 'New channel': 'Új csatorna', 'Setup needed': 'Beállítás szükséges', 'Open Settings': 'Beállítások megnyitása',
  'Getting started': 'Első lépések', Unfinished: 'Befejezetlen', 'Start something': 'Kezdj valamit', 'From a topic': 'Témából', 'Angle': 'Szemszög', 'Draft script': 'Script írása', 'Make video': 'Videó készítése',
  'Stop at preview': 'Megállás az előnézetnél', 'Or a blank episode': 'Vagy üres epizód', Create: 'Létrehozás', Episodes: 'Epizódok', Rendered: 'Renderelve', 'Ideas waiting': 'Várakozó ötletek', 'Switch to': 'Váltás erre', 'Nothing rendered yet.': 'Még nincs render.',
  'Every episode here has a final render.': 'Minden epizódnak van végső rendere.', 'Get ideas': 'Ötletek kérése', 'Open episode': 'Epizód megnyitása', 'Review ideas': 'Ötletek átnézése', 'Start an episode': 'Epizód indítása',
  // Library
  'Every episode': 'Minden epizód', Select: 'Kijelölés', 'Done selecting': 'Kész a kijelölés', 'Import ZIP': 'ZIP import', 'Export ZIP': 'ZIP export', 'New episode': 'Új epizód', 'Search title, id or channel': 'Keresés: cím, azonosító, csatorna',
  All: 'Mind', Draft: 'Vázlat', Scheduled: 'Ütemezve', Published: 'Kiadva', 'Select all shown': 'Látható mind', 'Queue previews': 'Előnézetek sorba', Archive: 'Archiválás', 'No episodes match': 'Nincs találat', 'No episodes yet': 'Még nincs epizód',
  'Clear filters': 'Szűrők törlése', 'Out of date': 'Elavult', 'Clear the search or pick another status.': 'Töröld a keresést vagy válassz másik állapotot.', 'Draft one from a topic and it will show up here.': 'Írj egyet egy témából, és itt megjelenik.',
  // Queue
  'One run at a time; the rest wait here in order.': 'Egyszerre egy futás megy, a többi sorban vár.', 'Nothing is running or waiting.': 'Semmi nem fut és nem vár.', 'Open library to generate': 'Könyvtár megnyitása', Running: 'Fut', Waiting: 'Vár', Recent: 'Legutóbbi',
  Retry: 'Újra', 'Cancel run': 'Futás leállítása', Remove: 'Eltávolítás', Log: 'Napló', 'Notify me when runs finish': 'Értesíts, ha a futás kész',
  // Settings / onboarding
  'Voice engine': 'Hangmotor', 'Save settings': 'Beállítások mentése', 'This machine': 'Ez a gép', 'Missing on this machine': 'Hiányzik ezen a gépen', Copy: 'Másolás',
  'Free voice (built into your Mac)': 'Ingyenes hang (a Mac beépített hangja)', 'Silent (estimated timing, for quick previews)': 'Néma (becsült időzítés, gyors előnézethez)', 'My own recordings (local)': 'Saját felvételeim (helyi)',
  'Welcome to Mascot Engine Studio': 'Üdv a Mascot Engine Studióban', 'First-run setup': 'Első indítás', Channel: 'Csatorna', 'Channel name': 'Csatorna neve', 'Language of the videos': 'A videók nyelve', Model: 'Modell', 'Script model': 'Script modell',
  Next: 'Tovább', Back: 'Vissza', Finish: 'Kész', Skip: 'Kihagyás', 'Check this machine': 'Gép ellenőrzése', 'Everything is ready.': 'Minden kész.', English: 'Angol', Hungarian: 'Magyar',
};
let lang: Lang = (() => { try { const s = localStorage.getItem(KEY); if (s === 'hu' || s === 'en') return s; } catch { /* blocked */ } return navigator.language?.toLowerCase().startsWith('hu') ? 'hu' : 'en'; })();
const subs = new Set<() => void>();
export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; try { localStorage.setItem(KEY, l); } catch { /* blocked */ } document.documentElement.lang = l; subs.forEach(f => f()); }
export const translate = (s: string, l: Lang = lang) => (l === 'hu' ? HU[s] ?? s : s);
export const t = (s: string) => translate(s);
export const useLang = (): Lang => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, getLang, getLang);
