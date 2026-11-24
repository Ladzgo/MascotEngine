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
  // Pipeline / Calendar / Analytics / Clipper / Publish
  'Every idea and episode by stage': 'Minden ötlet és epizód szakaszonként', in: 'ebben:', Idea: 'Ötlet', scene: 'jelenet', scenes: 'jelenet', Voiced: 'Felmondva',
  'No open ideas.': 'Nincs nyitott ötlet.', 'No episode is waiting on voice.': 'Egy epizód sem vár hangra.', 'Nothing voiced and unrendered.': 'Nincs felmondott, renderelésre váró epizód.', 'Nothing rendered, awaiting publish.': 'Nincs renderelt, kiadásra váró epizód.', 'Nothing published yet.': 'Még nincs kiadott epizód.',
  'Open library': 'Könyvtár megnyitása', 'Open calendar': 'Naptár megnyitása', 'Open pipeline': 'Folyamat megnyitása', 'Open': 'Megnyitás',
  'Which scene types keep viewers, and which hooks hold them. Needs YouTube Studio exports.': 'Mely jelenettípusok tartják meg a nézőket, és mely felvezetők. YouTube Studio exportot igényel.',
  'How to import': 'Az importálás menete', 'No retention data yet': 'Még nincs megtartási adat',
  'After a video has been public for a few days, export its numbers from YouTube Studio and import them here.': 'Miután egy videó pár napja nyilvános, exportáld a számait a YouTube Studióból, és importáld ide.',
  'YouTube Studio, then Analytics, then the video, then Engagement. Open the Audience retention chart and choose Export current view, CSV.': 'YouTube Studio, majd Analytics, a videó, majd Engagement. Nyisd meg a Közönség megtartása grafikont, és válaszd az Aktuális nézet exportálása, CSV opciót.',
  'In a terminal:': 'Terminálban:', 'Reload this page. With 3 or more videos the director starts nudging pacing by what held viewers (a gentle 0.9 to 1.1 weight).': 'Töltsd újra az oldalt. 3 vagy több videótól a rendező a nézők megtartása szerint finomítja a tempót (enyhe, 0,9-1,1 súly).',
  'imported without a retention curve or without a matching episode.': 'importálva megtartási görbe nélkül vagy egyező epizód nélkül.', 'Nothing imported yet.': 'Még nincs importálva semmi.', 'video is': 'videó van', 'videos are': 'videó van', video: 'videó', videos: 'videó', 'with a retention curve.': 'megtartási görbével.',
  'Loss by scene type': 'Veszteség jelenettípusonként', 'Audience lost per 10 seconds, by scene type': 'Elvesztett közönség 10 másodpercenként, jelenettípusonként', 'Scene type': 'Jelenettípus', Scenes: 'Jelenetek', 'Lost per 10 s': 'Veszteség / 10 mp', Bar: 'Oszlop', best: 'legjobb', worst: 'legrosszabb',
  Hooks: 'Felvezetők', Hook: 'Felvezető', 'Still watching after the hook': 'Még nézi a felvezető után',
  'Cut a long video into vertical clips that start and end on whole sentences. Free, runs on this computer.': 'Vágj egy hosszú videót álló klipekre, amelyek teljes mondatnál kezdődnek és végződnek. Ingyenes, ezen a gépen fut.',
  'New clip run': 'Új klipfutás', 'New run': 'Új futás', 'Video on this computer (path)': 'Videó ezen a gépen (útvonal)', 'Upload a video': 'Videó feltöltése', 'Or an earlier upload': 'Vagy egy korábbi feltöltés', None: 'Nincs', 'Shortest (s)': 'Legrövidebb (mp)', 'Longest (s)': 'Leghosszabb (mp)', Clips: 'Klipek',
  'Working… (a few minutes)': 'Dolgozik… (pár perc)', 'Find clips': 'Klipek keresése', 'Done:': 'Kész:', 'No clips yet. Add a video above and press Find clips.': 'Még nincs klip. Adj hozzá videót fent, és nyomd meg a Klipek keresése gombot.', preview: 'előnézet', 'Not rendered.': 'Nincs renderelve.', score: 'pontszám',
  'Publish record': 'Kiadási adatlap', State: 'Állapot', 'Scheduled for': 'Ütemezve erre', 'YouTube URL': 'YouTube URL', 'Save record': 'Mentés', Saved: 'Mentve', Copied: 'Másolva', 'The publish pack command is not installed yet.': 'A kiadási csomag parancs még nincs telepítve.',
  'Titles, description, tags, chapters and thumbnail text for YouTube. Review before you paste.': 'Címek, leírás, címkék, fejezetek és borítószöveg a YouTube-hoz. Beillesztés előtt nézd át.',
  'Generating…': 'Készül…', 'Regenerate pack': 'Csomag újragenerálása', 'Generate publish pack': 'Kiadási csomag generálása', 'AI-generated': 'MI-generált', 'Fallback (no AI)': 'Tartalék (MI nélkül)',
  'Chapters are most accurate after the voice step has run.': 'A fejezetek a hang lépés után a legpontosabbak.', Thumbnail: 'Borítókép', 'Rendering…': 'Renderelés…', 'Make thumbnail (free)': 'Borítókép készítése (ingyenes)', 'Thumbnail preview': 'Borítókép előnézet',
  'No thumbnail yet. It uses the first thumbnail text from the pack, or the title.': 'Még nincs borítókép. A csomag első borítószövegét használja, vagy a címet.',
  'Title options': 'Címjavaslatok', Description: 'Leírás', Tags: 'Címkék', Chapters: 'Fejezetek', description: 'leírás', tags: 'címkék', chapters: 'fejezetek', 'No chapters.': 'Nincsenek fejezetek.', 'Thumbnail text': 'Borítószöveg', Use: 'Használ',
  'on free days.': 'szabad napra.', 'Schedule rendered episodes and record what went live.': 'Ütemezd a renderelt epizódokat, és jegyezd fel, mi ment élőbe.',
  'Titles, descriptions, tags, files and language of every finished video, Short and clip': 'Minden kész videó, Short és klip címe, leírása, címkéi, fájlja és nyelve', 'Export upload sheet (.csv)': 'Feltöltési tábla exportja (.csv)',
  'Download scheduled episodes as .ics': 'Az ütemezett epizódok letöltése .ics-ben', 'Schedule an episode first': 'Előbb ütemezz egy epizódot', 'Export schedule (.ics)': 'Ütemezés exportja (.ics)',
  'Previous month': 'Előző hónap', Prev: 'Előző', 'Next month': 'Következő hónap', Month: 'Hónap', Mon: 'H', Tue: 'K', Wed: 'Sze', Thu: 'Cs', Fri: 'P', Sat: 'Szo', Sun: 'V',
  'Conflict: more than one episode of a channel on this day': 'Ütközés: egy csatornának több epizódja van ezen a napon', 'More than one episode of a channel on this day': 'Egy csatornának több epizódja van ezen a napon',
  'Pick an episode': 'Válassz epizódot', 'Select an episode below or on the calendar.': 'Válassz egy epizódot lent vagy a naptárban.', Date: 'Dátum', 'YouTube link (optional, for published)': 'YouTube link (opcionális, kiadotthoz)',
  Schedule: 'Ütemezés', 'Mark published': 'Megjelölés kiadottként', 'Back to draft': 'Vissza vázlatba', 'Ready to schedule': 'Ütemezhető', 'No rendered episode is waiting.': 'Nem vár renderelt epizód.', 'more still need a final render.': 'további még végső renderre vár.',
  'Repeat schedule': 'Ismétlődő ütemezés', 'Publishing weekdays': 'Kiadási napok', 'Schedule ready episodes on these days': 'Kész epizódok ütemezése ezekre a napokra', 'Conflicts:': 'Ütközések:', 'more than one episode of a channel': 'egy csatornának több epizódja van',
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
