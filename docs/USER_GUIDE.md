# Felhasználói útmutató: Mascot Engine Studio (lépésről lépésre)

Minden ingyenes és helyi, kulcs nem kell. Parancsok a projekt gyökeréből futnak.

## 1. Első indítás
1. `npm ci` (egyszer).
2. `npm run doctor`: kiír minden hiányzó dolgot a javítással. A Studióban ugyanez a Settings oldalon (és hiány esetén a Today/Overview oldalon) látszik, a **Copy** gomb a javító parancsot a vágólapra másolja (pl. `brew install ffmpeg`, `ollama pull qwen2.5:7b`).
3. `npm run app`, majd böngészőben `http://localhost:4177`.

## 2. Első videó
1. **Today**: írj be egy témát, **Make video**. Lefut: script, hang, rendezés, előnézet.
2. A **Queue** oldalon látod a haladást (lépés és százalék). **Cancel run** megállítja.
3. Ha egy futás hibára fut, a Queue "Recent" listájában ott az ok, a **Log** (kinyitható) és a **Retry** gomb. Ha a Studio újraindult futás közben, a futás "Interrupted" hibaként jelenik meg, a Retry újraindítja.

## 3. Szerkesztés
- **Library**: minden epizód, keresés, státusz-szűrő, **Select** (tömeges előnézet/archiválás). 100-nál több epizódnál a **Show more** tölt tovább.
- Epizód megnyitása: lépések 1-5 (Script, Voice, Visuals, Render, Publish). Szerkesztésnél a rendszer automatikusan pillanatképet ment a scriptről; **Versions** oldal: régi változat megnézése, **Restore** (visszaállítás előtt is készül pillanatkép). A rendezői döntések (`decisions.json`) a scriptből újra előállnak: `Direct` lépés.
- Saját hang: scene-enként feltölthető felvétel az Inspectorban.

## 4. Billentyűk
`?` súgó · `Cmd-K` Palette (epizód-váltás, "This episode: make full video / preview / go to ... / export ZIP") · `g` majd `t p l i c s q k` oldalváltás · `Cmd-Enter` generálás · `Cmd-Shift-Enter` előnézet · `1`-`5` lépés · `[` `]` scene · `Cmd-Z` visszavonás.

## 5. Mentés, áthelyezés (ZIP)
- Export: Library, **Select**, kijelölés, **Export ZIP** (vagy Palette: "export ZIP"). Tartalma: script, státusz, jegyzetek, hang, képek, decisions, timings. A renderelt videó NEM.
- Import: Library, **Import ZIP**. Ha ilyen azonosító már van, hibát kapsz; parancssorból új azonosítóval: `curl -X POST -H 'Content-Type: application/zip' --data-binary @ep.zip 'http://localhost:4177/api/episodes/import?id=uj-azonosito'`.
- Import után `Voice` (ha kell) és `Preview` újra futtatható, a render gyorsítótár ritkán kell.

## 6. Kiadás
Publish lépés: címek, leírás, címkék, fejezetek, feliratok (.srt/.vtt), thumbnail; ütemezés a **Calendar** oldalon (.ics és feltöltési .csv export). Kiadás előtt: `docs/PUBLISHING-CHECKLIST.md`.

## 7. Hiba esetén
- `npm run doctor`: környezet.
- Helyi hibanapló: `data/logs/studio.log` (semmi nem megy ki a gépről).
- `npm run support-bundle`: egy szöveges fájl az `out/` mappába (doctor + napló + utolsó hibás futások, titkok kitakarva). Küldés előtt nézd át.
- Ellenőrző végigfutás: `npm run e2e -- --fixture` (LLM nélkül, ~1 perc: hang, rendezés, előnézet, publish-pack, ZIP) vagy `npm run e2e` (teljes, Ollamával).
- Típus- és egységtesztek: `npm run typecheck && npm test`.

Régebbi, Linux/offline telepítési útmutató: `docs/GUIDE.md`, `docs/OFFLINE.md`.
