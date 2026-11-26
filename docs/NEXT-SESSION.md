# Új session indító prompt (másold be egy friss Claude Code session-be)

```
Folytasd a /Users/laci/ytAutomation (MascotEngine, Remotion + helyi Studio) fejlesztését. Olvasd el először: docs/ARCHITECTURE.md, docs/REFERENCE-ANALYSIS.md, docs/DECISIONS.md vége (62+ tételek), docs/TTS.md, és ezt a fájlt (docs/NEXT-SESSION.md). Magyarul válaszolj, röviden. A CLAUDE.md szabályait tartsd be (rtk parancsok, Grep/Glob tilos). Commitolj minden lépés után (Co-Authored-By sor), pusholj; a CI (ubuntu) zöld maradjon.

CÉL: igazán profi, alig-AI-nak ható videók (Shorts 9:16 elsősorban, hosszú 16:9 másodsorban), ingyenes/helyi eszközökkel. Minőségi referencia: docs/REFERENCE-ANALYSIS.md (4 Shorts: teljes képernyős illusztráció, 2–3 mp-enként új kép, folyamatos kamera, 2–4 szavas feliratok, 150–170 szó/perc, -12..-15 LUFS).

ÁLLAPOT (2026-11-26):
- Szkript: helyi Ollama, alapértelmezett qwen2.5:14b (gemma3:12b választható; ANTHROPIC_API_KEY a .env-ben van, LLM_PROVIDER=anthropic bekapcsolja – csak a felhasználó kérésére). Outline→szakaszonkénti draft, számellenőrzés (src/draft/outline.ts).
- Hang: src/pipeline tts adapter: kokoro (EN, helyi), piper (HU/EN, helyi), edge (online, csak TTS_ONLINE=1), say (tartalék). Telepítés: npm run setup:voice (.venv-tts). Meghallgatás: npm run voice-test. A felhasználó szerint a hang "sokkal jobb". Ajánlás: docs/TTS.md.
- Képek: src/fullbleed (teljes képernyős 2.5D SVG jelenetek, 31+ tárgy, akció-animációk, kamera), src/visuals, src/stock (Pixabay – PIXABAY_API_KEY a .env-ben, élőben tesztelve; tartalék: Openverse, Wikimedia), Punch feliratok.
- Studio: npm run app → http://localhost:4177 ; "+ New video" folyamat (#/new), háttérben futó draft (GET /api/drafts/:id). Szerverkód változás után újraindítás kell.
- Zene: 12 procedurális szint, assets/LICENSES.md.
- QA: npm run qa (Shorts-tudatos), npm run qa:golden, npm run qa:semantic (qwen2.5vl:7b látásmodellel pontozza, hogy a kép illik-e a mondathoz).
- Magyar csatorna: channels/hu-futas (futás témájú, teszt), channels/hu-finance. Utolsó futó generálás: ep009-hogyan-kell-helyesen-futni (HU Short, hu-futas) – nézd meg, lefutott-e, és nézd át a képkockákat + a hangot.

FELHASZNÁLÓI VISSZAJELZÉSEK (ezekre kell megoldás):
1. A videógenerálás felhasználói élménye (UX) rossz, több hiba van a Studióban, amikor videót akarunk csinálni. Az első feladat: végigcsinálni a teljes utat egy valódi böngészőben (Claude in Chrome vagy headless Chrome + screenshot) – Today → + New video → téma / Suggest ideas → formátum, csatorna, nyelv, hang → Make video → progress → player → Make final / Publish pack – és MINDEN hibát, értelmetlen címkét, zsákutcát, hiányzó visszajelzést, lassú vagy néma lépést javítani. Egy elsőre használó embernek egyértelmű legyen, mit kell csinálnia; hibák emberi nyelven; minden hosszú művelet mutasson élő előrehaladást és becsült időt; a csatorna/nyelv/hang választásnak együtt kell működnie (magyar csatorna → magyar hang automatikusan); legyen "Cancel" és "Retry"; a szerver ne álljon le, és újraindításkor a futó munkák maradjanak meg. Írj Playwright/smoke tesztet erre a teljes útra (scripts/smoke-ui.ts screenshot lépése hibás: Remotion page objektumnak nincs screenshot-ja – javítani).
2. A videók elemei legyenek sokkal változatosabbak, és értelmük legyen az adott pillanatban (kép–mondat illeszkedés). Eszköz: npm run qa:semantic; cél a medián pontszám emelése, előtte-utána számokkal. A `shot` spec (subject, action, setting, label, mood, camera) a drafterből jöjjön, kontrollált szókészlettel (src/visuals/kinds.ts + src/fullbleed katalógus).
3. A szkriptek legyenek sokkal érdekesebbek: váltakozó történetmesélő eszközök (névvel ellátott szereplő, mítosz-vs-valóság, "mi lenne ha 10 évig", hibafeltárás, visszaszámlálás), 5 hook-jelölt + LLM-bíráló, szkriptpontszám 0–100 küszöbbel, hook-ra visszautaló zárás. Magyar nyelvű minőség külön ellenőrzendő (nyelvtan, természetes hangzás).
3b. STOCK BEKÖTÉSE A FOLYAMATBA (jelenleg NINCS bekötve): a Pixabay-kód kész (src/stock, PIXABAY_API_KEY a .env-ben), de a "Make video" nem használja. Kell: (a) a drafter/storyboard minden beathez `stock: {query, kind: photo|video}` mezőt írjon (angol keresőszó a `shot.subject`-ből, még magyar videónál is; Pixabay `lang=hu` is lehet), a beatek ~40–50%-a stock, a többi procedurális; (b) a letöltés (npm run stock) legyen a Make video lépése a voice és a preview között, élő előrehaladással, cache-elve, és ha nincs kulcs/találat, csendben procedurális tartalék; (c) videóklip trim/loop a beat hosszára, Ken Burns a fotóra, színezés a palettához; (d) forráskredit a publish csomagba; (e) Studio: beatenként "Swap image" találati rács; (f) mérd a semantic QA-val, hogy a stock-képek illenek-e a mondathoz (márkás/témán kívüli találatok kiszűrése, pl. logók, szöveges képek, arcok).
4. Ne indíts egyszerre sok ügynököt: a felhasználó szerint "túl sok" – legfeljebb két ügynök, szigorúan külön fájlterülettel, és ne küldj újabb munkát, amíg a futók nem végeztek.

NYITOTT ISMERT HIBÁK/GYENGESÉGEK:
- Fullbleed: alsó ~20% üres padló; sík vektor-tárgyak (nem 3D) – a referenciákhoz képest még látszik a különbség; feliratok nehezebbek, mint a referenciákban; timeline/checklist címkék kicsik.
- Stock: a kulcs nélküli (Openverse/Wikimedia) találatok gyakran témán kívüliek; "Swap image" rács a Studióban még nincs; a drafter még nem ír `stock` mezőt; videóklip trim/loop a beat hosszára hiányos.
- Ideas oldalon még két elsődleges gomb van egy ötletnél; nem minden oldalon van egy fő gomb.
- Hosszú (3–5 perces) szkriptek: a 7B kevés; a 14B-vel még nem mértük.
- A Chrome-bővítmény kapcsolata megszakadt a session közben (ide: ECONNREFUSED) – ha kell, a felhasználóval újrakapcsoltatni.
- Pixabay-kulcs a beszélgetésben látszott: a felhasználónak érdemes a Rotate gombbal újat generálni, és a Studio Settingsben megadni.

ELSŐ LÉPÉSEK: (1) git log + gh run list (CI zöld?), npm run typecheck && npm test; (2) a Studio újraindítása, ep009 ellenőrzése; (3) a teljes UX-út végigjárása és hibalista, (4) javítás kisebb, commitolt lépésekben; (5) a felhasználótól egy rövid visszajelzés kérése a végén.
```
