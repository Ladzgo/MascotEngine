# Offline csomag a Linux munkagépre

Cél: a Linux gépen nincs internet. Egy internetes gépen (itt: a Mac) összeállítunk egy `tar.gz`-t, a Linux gépen kicsomagoljuk és lefuttatunk egy scriptet. A nagy fájlok nem kerülnek gitbe (`dist/` a `.gitignore`-ban), csak a két script és ez a leírás.

## 1. Csomag készítése (internetes gépen)

Előfeltétel: a repó ki van checkoutolva, `npm ci` lefutott, `npx remotion browser ensure` megvolt (ebből tudjuk a Chromium pontos verzióját), `ollama pull qwen2.5:7b` megvolt, a `data/models/ggml-base.en.bin` megvan (vagy letölti a script).

```bash
npm run bundle              # = bash scripts/bundle-offline.sh
npm run bundle -- --dry     # csak kiírja, mit csinálna
```
Eredmény: `dist/offline-bundle-<dátum>.tar.gz` (a legnagyobb része az Ollama modell, ~5 GB a qwen2.5:7b).

Mi kerül bele és miért:

| Rész | Tartalom | Megjegyzés |
|---|---|---|
| `repo/` | `git archive HEAD` (forrás, docs, assets) | az utolsó **commitolt** állapot; commitolj bundle előtt |
| `npm-cache/` | `npm ci --os=linux --cpu=x64` által feltöltött npm cache | a `node_modules`-t NEM másoljuk: natív binárisok vannak benne (esbuild, `@remotion/compositor-*`), a Mac-es nem fut Linuxon. Másik architektúra: `TARGET_CPU=arm64` |
| `chromium/` | Chrome headless shell linux64 zip, a Remotion által rögzített verzió | a setup a Remotion saját mappájába (`node_modules/.remotion/...`) csomagolja ki |
| `whisper/` | whisper.cpp forrás (`v1.7.5`) + `ggml-base.en.bin` | a `whisper-cli`-t a célgépen építjük (`cmake`, `g++`), mert a Mac-es bináris nem használható |
| `ollama/` | Ollama Linux bináris (`.tar.zst`) + **csak** a választott modell manifestje és blobjai a `~/.ollama/models`-ből | a modell neve: `OLLAMA_MODEL` (alap `qwen2.5:7b`) |
| `piper/` | piper Linux bináris + `en_US-lessac-medium` hang (`.onnx` + `.json`) | opcionális szebb hang; nélküle espeak-ng |
| `apt-packages.txt`, `apt/` | a szükséges apt csomagok listája; a `.deb` fájlokat egy Debian/Ubuntu gépen kell letölteni (a fájl tetején a parancs) | ffmpeg, espeak-ng, cmake, build-essential, Chromium futtató könyvtárak, zstd |
| `MANIFEST.sha256` | minden fájl ellenőrző összege | a setup első lépése ellenőrzi |

Beállítások környezeti változókkal: `TARGET_OS`, `TARGET_CPU`, `OLLAMA_MODEL`, `WHISPER_CPP_VERSION`, `PIPER_VOICE`, `PIPER_TAG`, `OLLAMA_URL` (ha az Ollama átrakta a letöltési címet), `SKIP="npm chromium whisper ollama piper"` (kihagyandó részek).

Ismert korlát: a letöltési címeket (GitHub, Hugging Face, ollama.com, Google storage) nem tudtam itt végig kipróbálni; ha valamelyik 404, a script megáll és kiírja, melyik; `OLLAMA_URL` / `PIPER_TAG` / `WHISPER_CPP_VERSION` felülírja. Az Ollama letöltő alapértelmezetten a `.tar.zst` formát várja, az ennél régebbi `.tgz` is kezelve van a setupban.

## 2. Telepítés a Linux gépen

1. Másold át a csomagot (pendrive, `scp`), majd:
   ```bash
   tar xzf offline-bundle-*.tar.gz && cd offline-bundle-*
   ./setup-linux.sh            # alap cél: ~/ytAutomation, user-szintű programok: ~/.local
   ```
2. A script sorban: ellenőrzőösszeg, apt csomagok (csak root/sudo esetén, `dpkg -i apt/*.deb`), repó másolása, `npm ci --offline`, Chromium kicsomagolás, whisper.cpp építés és modell, Ollama + modell (`~/.ollama/models`), piper (`.env`-be `PIPER_BIN`, `PIPER_MODEL`), végül `npm run doctor`.
3. Ha a `PATH` nem tartalmazza a `~/.local/bin`-t, a script kiírja az `export` sort; tedd a `~/.bashrc`-be.
4. Indítás: `ollama serve &` (a Studio is el tudja indítani), majd `npm run app`, böngésző: `http://localhost:4177`. SSH-n át: `ssh -L 4177:localhost:4177 gép`.

## 3. Kézi lépések, ha a script valamelyik része nem megy

- **Ollama modell kézzel**: másold a `ollama/models/` tartalmát a `~/.ollama/models/` alá (a `manifests/` és a `blobs/` mappák), aztán `ollama list` mutatja a modellt.
- **whisper.cpp kézzel**: `tar xzf whisper.cpp-*.tar.gz && cd whisper.cpp-* && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j --target whisper-cli`, majd a `build/bin/whisper-cli` a `PATH`-ra; a modell a `data/models/ggml-base.en.bin`.
- **Chromium kézzel**: bármilyen Chromium megteszi: `.env`-ben `REMOTION_BROWSER_EXECUTABLE=/út/chromium` (a `doctor` is elfogadja). Futtató könyvtárak hiányakor (`libnss3.so` stb.) az `apt-packages.txt` listája a támpont.
- **Magyar hang és felismerés**: `say` (macOS) a `Tünde` hanggal beszél magyarul (alap, ha a csatorna nyelve `hu`). Linuxon: `espeak-ng -v hu` automatikus; piper-hez magyar modell kell, pl. `hu_HU-anna-medium.onnx` + `.onnx.json` a `rhasspy/piper-voices` tárból (a bundle-be: `PIPER_VOICE=hu_HU-anna-medium npm run bundle` nem fedi le a 2 hangot egyszerre, ezért a magyar modellt töltsd le külön a `piper/` mappába), `.env`: `PIPER_MODEL_HU=/út/hu_HU-anna-medium.onnx` (az angolé marad `PIPER_MODEL`). Szószintű időzítéshez többnyelvű whisper modell kell: `ggml-base.bin` (vagy `ggml-small.bin`) a `data/models/`-be és `WHISPER_MODEL=data/models/ggml-base.bin`; az `.en` modell magyarra nem jó (becsült időzítésre vált). A csatornát `npm run channel -- create hu-finance --preset hu-finance` hozza létre.
- **espeak-ng / piper**: `espeak-ng` az apt-ból; piper: `PIPER_BIN` és `PIPER_MODEL` a `.env`-ben, a hang `.onnx` mellett ott kell lennie a `.onnx.json`-nak.

## 4. Ellenőrzés

`npm run doctor` kiír minden hiányzó elemet a javítással. `MISSING` = kötelező (node, npm csomagok, ffmpeg + libx264, Chromium), `WARN` = a funkció romlik (whisper, Ollama, hang, zene), de a rendszer fut. Ugyanezt a függvényt használja a Studio `GET /api/readiness` végpontja is, ha a `studio/server.ts` a `src/doctor/doctor.ts` `checkReadiness()`-ét hívja (javaslat az A agentnek).

Első próba a célgépen: `npm run e2e` (lásd `docs/GUIDE.md`): friss téma, rövid előnézet, QA, felirat export.
