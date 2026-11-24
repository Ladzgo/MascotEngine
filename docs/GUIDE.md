# Felhasználói útmutató (magyarul)

Minden parancs a projekt gyökeréből fut (`/…/ytAutomation`). Minden ingyenes és helyi; fizetős API nem kell.

## 1. Telepítés a Linux gépen, internet nélkül

Előkészítés egy internetes gépen, aztán másolás (pendrive, `rsync`). A repó: `https://github.com/Ladzgo/MascotEngine`.

1. **Node 20+** és `npm ci`. Ha a célgépen nincs csomagtár, másold át a `node_modules` mappát is.
2. **Chromium a Remotionnak** (videó, felirat és thumbnail ezzel készül): online egyszer `npx remotion browser ensure`, majd másold át a `node_modules/.remotion` mappát (vagy telepíts `chromium`-ot).
3. **ffmpeg és espeak-ng**: `apt-get install --download-only ffmpeg espeak-ng` a függőségeikkel, majd `dpkg -i *.deb` a célon.
4. **Ollama** (script-írás, ötletek, publish-pack AI): telepítsd a Linux binárist, online `ollama pull qwen2.5:7b`, majd másold a `~/.ollama/models` mappát ugyanoda a célgépen.
5. **whisper.cpp**: építsd meg a `whisper-cli`-t, tedd a `PATH`-ra, a `ggml-base.en.bin` fájlt másold a `data/models/` mappába (vagy `WHISPER_MODEL=<út>`). Nélküle a szószintű felirat és a Clipper nem működik.
6. **Szebb hang (opcionális)**: `piper` + `.onnx` hang, `.env`-ben `PIPER_BIN` és `PIPER_MODEL`. Nélküle espeak-ng a hang (gépies, de működik).
7. **Zene**: a licencelt számok az `assets/music/` mappába kerülnek (a mellékelt hangulat-pad-ek benne vannak).
8. **Ellenőrzés**: `npm run app`, majd a böngészőben `http://localhost:4177`; a Settings oldal és a `GET /api/readiness` felsorol minden hiányzó dolgot a javítással együtt. SSH-n át: `ssh -L 4177:localhost:4177 gép`.

Render-gyorsítás: macOS-en alapból `angle` GL-t használ (2,4-szer gyorsabb előnézet). Linuxon az alap marad; próbáld ki: `RENDER_GL=angle npm run render -- <id>`, és mérd: `npx tsx scripts/qa/benchRender.ts <id> 300`.

## 2. Az első videó

Studio-val (egy gombbal): `npm run app`, Today oldal, "Make video", témát írsz be. Lefut: script, hang, rendezés, előnézet. Az előnézet 720p, ~1-2 perc egy 90 s-os videóra.

Parancssorból:
```bash
npm run draft -- "Miért veszít értéket a megtakarításod" --id ep010-megtakaritas
npm run tts -- ep010-megtakaritas            # hang (auto: say / piper / espeak-ng)
npm run direct -- ep010-megtakaritas         # rendezés
npm run render -- ep010-megtakaritas         # előnézet (720p)
npm run qa -- ep010-megtakaritas             # automatikus minőségellenőrzés
npm run render -- ep010-megtakaritas --final # végleges 1080p (előtte olvasd át a scriptet!)
```
Több videó felügyelet nélkül: `npm run batch -- --topics temak.txt --channel default [--qa]` (soronként egy téma, `#` komment) vagy `--scout 5` (friss hírekből). Hiba esetén a következő témával folytatja; napló: `batch-report.json`.

Mindig nézd meg a videót és hallgasd meg a hangot publikálás előtt, a script emberi átolvasása kötelező (a YouTube tömeggyártott tartalom elleni szabályai miatt).

## 3. Minőségellenőrzés (`npm run qa -- <id>`)

Lásd `docs/QA.md`. Zöld = hangerő (-16..-12,5 LUFS), true peak, szünetek (max 1,5 s), felirat-lefedettség, 5 képkocka rendben. Ha a "render is current" bukik, a videó régebbi a döntéseknél: renderelj újra.

## 4. Clipper (hosszú videóból 9:16 klipek)

```bash
npm run clip -- /út/videó.mp4 --min 20 --max 60 --count 5
```
Eredmény: `out/clips/<név>/clip1.mp4 …` és `timeline.json`. A vágás mondathatáron és valódi csendben történik, a kivágás követi a beszélőt, a felirat szószintű (sárga kiemelés). Kapcsolók: `--no-captions`, `--no-render` (csak időzítés), `--words words.json` (whisper nélkül). A Studióban a Clipper oldalon feltölthetsz és indíthatsz. Terv a további funkciókhoz: `docs/CLIPPER.md`.

Shorts a kész epizódokból: `npm run shorts -- <id> --count 3`; a parancs valós képkockákkal ellenőrzi a hookot és a loopot.

## 5. Publikálás

1. `npm run publish-pack -- <id>`: címek, leírás, tagek, fejezetek (`build/publish.json`). AI nélkül is ad offline javaslatot; a `uploadNotes` mező a YouTube Studio lépéseit tartalmazza (AI-hang jelölés).
2. `npm run thumbnail -- <id> --variants 2`: két thumbnail (A/B), a parancs kiírja a 150 px-es olvashatóságot. Gyenge (WEAK) esetén írj rövidebb szöveget: `--text "3 szó"`.
3. `npm run subs -- <id>`: `build/<id>.srt`, `.vtt` (szószintű) és `chapters.txt`.
4. Ellenőrzőlista: `docs/PUBLISHING-CHECKLIST.md`. Pénzügyi tartalomnál a felelősségkizáró a leírásban és a végkártyán marad, hozamígéret nincs a címben.
5. A feltöltés után a YouTube Studio CSV-it be lehet tölteni: `npm run analytics -- import export.csv [--id <epizód>]`, majd `npm run analytics -- summary` (melyik jelenettípus tartja a nézőt; 3 videó alatt csak tájékoztató).

## 6. Hibaelhárítás

| Tünet | Ok és megoldás |
|---|---|
| "No AI provider configured" / nincs script | Az Ollama nem fut vagy nincs modell: `ollama serve`, `ollama pull qwen2.5:7b`. |
| A hang csendes | Nincs hangmotor: telepíts `espeak-ng`-t vagy piper-t (`.env`), vagy használd `--engine silent`-et próbának. |
| Nincs szószintű felirat, a Clipper hibát ad | Hiányzik a `whisper-cli` vagy a `data/models/ggml-base.en.bin`. |
| Render hiba "Could not find a browser" | `npx remotion browser ensure` (online), vagy másold át a `node_modules/.remotion` mappát. |
| Lassú render | Nézd a `RENDER_GL`-t; kevesebb párhuzamosság ne legyen alap, mérd a `benchRender.ts`-sel. |
| A felirat nem látszik a Clipper klipen | A Chromium nem indult el (a CLI figyelmeztet); a klip felirat nélkül elkészül. Futtasd újra a Chromium telepítése után. |
| `qa`: "render is current" FAIL | Renderelj újra, mert a `decisions.json` újabb a videónál. |
| Régi epizód nem szép | `npm run direct -- <id>` majd `npm run render -- <id>` (és `tts`, ha a hang a szünet-vágás előtti). |
| `batch` megáll egy témán | Nézd a `batch-report.json` `error` mezőjét; a többi téma lefut. |

Karbantartás: `npm test` és `npm run typecheck` zöld legyen minden változtatás után; a nagyobb munkák után érdemes `/compact` vagy `/clear`.
