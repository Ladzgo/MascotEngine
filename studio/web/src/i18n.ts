// Tiny UI dictionary: t('English text') -> Hungarian when the UI language is hu. Unknown strings stay English.
import {useSyncExternalStore} from 'react';

export type Lang = 'en' | 'hu';
const KEY = 'studio.lang';
export const HU: Record<string, string> = {
  Today: 'Ma', Pipeline: 'Folyamat', Library: 'Könyvtár', Ideas: 'Ötletek', Clipper: 'Vágó', Analytics: 'Elemzés', Channels: 'Csatornák', Settings: 'Beállítások', Queue: 'Sor', Calendar: 'Naptár', Episode: 'Epizód', Menu: 'Menü', 'Main': 'Fő',
  Script: 'Script', Voice: 'Hang', Visuals: 'Képek', Render: 'Renderelés', Publish: 'Kiadás',
  'Skip to content': 'Ugrás a tartalomra', 'Loading…': 'Betöltés…', Language: 'Nyelv', 'UI language': 'Felület nyelve',
  'Stopped.': 'Leállítva.', 'Start over': 'Újrakezdés', 'Running for': 'Fut már', about: 'körülbelül', left: 'van hátra', 'usually 2 to 6 minutes': 'általában 2-6 perc', Cancel: 'Mégse',
  'Chosen for the channel language': 'A csatorna nyelvéhez igazítva', 'Auto picks the best natural voice for it.': 'Az automatikus a legjobb természetes hangot választja hozzá.',
  'Background picture': 'Háttérkép', Now: 'Most', 'This beat uses the drawn visuals.': 'Ez a jelenet a rajzolt grafikát használja.', 'Swapped. Re-render the preview to see it.': 'Kicserélve. Az előnézet újrarenderelése után látszik.', 'Swap image': 'Kép cseréje',
  'Search stock': 'Keresés a képtárban', 'English search word, e.g. credit card': 'Angol keresőszó, pl. credit card', Photo: 'Fotó', Video: 'Videó', 'Searching…': 'Keresés…', Search: 'Keresés', Close: 'Bezár', 'No licensed pictures found. Try a simpler English word.': 'Nincs találat. Próbálj egyszerűbb angol szót.', 'Downloading…': 'Letöltés…',
  'Working on': 'Folyamatban', 'so far': 'eddig', 'Finished. Everything is up to date.': 'Kész. Minden naprakész.', 'Cancelled.': 'Megszakítva.', 'Idle.': 'Nincs futó munka.', Stop: 'Leállít', 'Hide log': 'Napló elrejtése', 'Thinking…': 'Gondolkodik…', 'Generate ideas': 'Ötletek generálása', 'usually 1 to 2 minutes': 'általában 1-2 perc',
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
  For: 'Kinek', 'Surprising facts': 'Meglepő tények',
  // New video flow, Today, purposes
  'New video': 'Új videó', 'Make your first video in 3 steps': 'Készítsd el az első videód 3 lépésben', 'Pick a topic': 'Válassz témát', 'Type one, or let the Studio suggest ideas.': 'Írj be egyet, vagy kérj ötleteket a Studiótól.',
  'Choose Short or Long': 'Válassz Shortot vagy hosszú videót', 'And the voice you want to hear.': 'És a hangot, amit hallani szeretnél.', 'Press Make video': 'Nyomd meg a Videó készítése gombot',
  'Script, voice and a preview, made for you in a few minutes.': 'Script, hang és előnézet, pár perc alatt elkészül neked.', 'Pick up where you left off, or start something new.': 'Folytasd ott, ahol abbahagytad, vagy kezdj újat.',
  Continue: 'Folytatás', Preview: 'Előnézet', 'See every episode': 'Minden epizód', 'Final video is ready': 'A végső videó kész', 'Preview is ready; check it, then make the final': 'Az előnézet kész; nézd meg, aztán készítsd el a véglegest',
  'Voice is recorded; render a preview': 'A hang felvéve; renderelj előnézetet', 'Script is written; record the voice': 'A script megvan; vedd fel a hangot',
  'Three quick steps. Nothing is published; you review everything.': 'Három gyors lépés. Semmi nem kerül ki; mindent te nézel át.', 'What is it about?': 'Miről szóljon?', Topic: 'Téma',
  'e.g. why paying the minimum on a credit card costs thousands': 'pl. miért kerül ezreket a hitelkártya minimum fizetése', 'Suggest ideas': 'Ötletek kérése', 'Thinking of ideas… about a minute': 'Ötleteken gondolkodik… kb. egy perc',
  'or pick one below': 'vagy válassz lent egyet', 'How should it look and sound?': 'Hogyan nézzen ki és hogyan szóljon?', Format: 'Formátum', Short: 'Short', Long: 'Hosszú',
  'Vertical, 30 to 55 seconds, full-screen pictures': 'Álló, 30–55 másodperc, teljes képernyős képek', 'Landscape, 3 to 5 minutes, mascot and paper look': 'Fekvő, 3–5 perc, kabala és papír megjelenés',
  'Channel and language': 'Csatorna és nyelv', 'not set up': 'nincs beállítva', 'Best available': 'Legjobb elérhető', 'Hear this voice': 'Hang meghallgatása',
  Automatic: 'Automatikus', 'Bigger models write better scripts but take longer (a few minutes).': 'A nagyobb modellek jobb scriptet írnak, de tovább tartanak (pár perc).',
  'Make it': 'Készítsd el', 'The Studio writes the script, records the voice and renders a preview. You can watch the progress.': 'A Studio megírja a scriptet, felveszi a hangot és renderel egy előnézetet. Követheted a haladást.',
  'Starting…': 'Indítás…', 'Enter a topic or pick an idea first.': 'Előbb írj be egy témát vagy válassz ötletet.', 'Started. Your video is being made.': 'Elindult. A videód készül.',
  'Writing the script': 'A script megírása', 'Recording the voice': 'A hang felvétele', 'Planning the shots': 'A jelenetek megtervezése', 'Rendering the preview': 'Az előnézet renderelése', part: 'rész',
  'Making your video': 'A videód készül', 'Your video is ready': 'A videód kész', 'This did not work.': 'Ez nem sikerült.', 'Try again': 'Újra', Progress: 'Haladás',
  'You can leave this page; the work continues. Find it under Today or Jobs.': 'Elhagyhatod az oldalt; a munka folytatódik. Megtalálod a Ma oldalon vagy a Munkák alatt.',
  'The Studio lost track of this run (it may have been restarted). Your episode may still exist in the Library.': 'A Studio elvesztette ennek a futásnak a nyomát (talán újraindult). Az epizód még lehet a Könyvtárban.',
  'Make final': 'Végső render', 'Edit script': 'Script szerkesztése', 'Publish pack': 'Kiadási csomag', 'Make another': 'Újabb videó', 'Final render started.': 'A végső render elindult.',
  'See every idea and episode by stage and what each one needs next.': 'Minden ötlet és epizód szakaszonként, és mi kell nekik legközelebb.', 'Every episode in one place: search, filter, open or archive.': 'Minden epizód egy helyen: keresés, szűrés, megnyitás, archiválás.',
  'Video ideas for a channel. Pick one and the video is made for you.': 'Videóötletek egy csatornához. Válassz egyet, és elkészül a videó.', 'Each channel has its own voice, topics and look.': 'Minden csatornának saját hangja, témái és megjelenése van.',
  'Voice, script model and keys. Defaults work; change only what you need.': 'Hang, script modell és kulcsok. Az alapok működnek; csak azt változtasd, amit kell.', 'Renders run one at a time; the rest wait here.': 'A renderek egyesével futnak; a többi itt vár.',
  'Schedule finished videos and record what went live.': 'Ütemezd a kész videókat, és jegyezd fel, mi ment élőbe.', 'Cut a long video into vertical clips.': 'Vágj egy hosszú videót álló klipekre.',
  'What keeps viewers watching, from YouTube Studio exports.': 'Mi tartja meg a nézőket, YouTube Studio exportokból.',
};
let lang: Lang = (() => { try { const s = localStorage.getItem(KEY); if (s === 'hu' || s === 'en') return s; } catch { /* blocked */ } return navigator.language?.toLowerCase().startsWith('hu') ? 'hu' : 'en'; })();
const subs = new Set<() => void>();
export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; try { localStorage.setItem(KEY, l); } catch { /* blocked */ } document.documentElement.lang = l; subs.forEach(f => f()); }
export const translate = (s: string, l: Lang = lang) => (l === 'hu' ? HU[s] ?? s : s);
export const t = (s: string) => translate(s);
export const useLang = (): Lang => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, getLang, getLang);
