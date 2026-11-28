# Új session indító prompt (másold be egy friss Claude Code session-be)

```
Folytasd a /Users/laci/ytAutomation (MascotEngine: Remotion + helyi Studio, http://localhost:4177) fejlesztését. A cél: profi, alig AI-nak látszó, CSAK ANGOL videók. Előbb a 9:16 Shorts, utána a 16:9 hosszú videók. Működő HU kódot ne törölj, de ne fókuszálj rá. Minden INGYENES maradjon (ingyenes tier-ek, helyi modellek, CC0/MIT/Apache/CC-BY assetek; fizetős API/asset/szolgáltatás tilos; ANTHROPIC_API_KEY soha).

Olvasd el először: docs/QUALITY-PLAN.md ("The bar" + 4 fázis), docs/STOCK.md vége (16:9 rések), docs/TTS.md, `git log --oneline -40`, és ezt a fájlt.

Szabályok:
- Magyarul válaszolj, röviden.
- CLAUDE.md: rtk parancsok, Grep/Glob tilos (rtk grep / rtk find). Read csak Edit előtt, csak a szükséges sorokra. A hookot ne kerüld meg.
- Minden lépés után commit ("Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>") és push (`git pull --rebase --autostash origin main` előtte). A CI (ubuntu) zöld maradjon.
- Ne kérj engedélyt projekten belüli, visszafordítható lépéshez. Skilleket telepíthetsz (előtte olvasd el a SKILL.md-t).

Ügynökök (max 2, Opus 5.5, diszjunkt sávok, cron-kör ~17 percenként):
- A (vizuál): src/fullbleed, src/fx, src/visuals, src/stock, src/draft/storyboard.ts, scripts/qa, docs/STOCK.md.
- B (szkript/hang/infra): src/director, src/pipeline, src/draft/* (kivéve storyboard.ts), src/llm, src/assets, scripts/assets, scripts/tts, src/schema.ts, package.json, assets/LICENSES.md, docs/TTS.md, studio/, scripts/smoke-ui.ts, scripts/draft-measure.ts.
- KÖTELEZŐ az ügynök-promptba: fájlt CSAK Edit/Write eszközzel szerkesszen, SOHA python/sed/perl heredoc-kal (3 ügynök órákra beragadt egy jóváhagyásra váró `python3 - <<EOF` hívásban); nincs run_in_background + várakozás; ~30 percenként commit.
- Ha egy ügynök csendes: nézd meg a jsonl utolsó tool_use-át (`tail -n 1 <agent>.jsonl | jq ...`), mielőtt újraindítod.
- Az Ollama közös: B hívásai keep_alive 30s + withOllamaLock (src/llm/ollamaLock.ts); A semantic QA-ja ezt használja.

Állapot (2026-11-28, HEAD 5dcc39e, CI zöld):
- Shorts: ep015, ep016, ep011-v3 semantic medián 7 (cél elérve); QA 20/20 (ep011-v3 18/20: régi szkript 185 wpm, 7.9 s jelenet).
- Kész: zoom-fegyelem (stock álló, fotó ≤4.5%, push ≤6%, frame-alapú zoom QA), qwen-pontozott stock-választás, asset-katalógus (src/assets: Fluent 3D, Noto Lottie, Open Peeps, hátterek, 391 Kenney SFX; `npm run assets:fetch`), hook 5 jelölt + bíró + overlay, story bíró szempontonként + átírás/újramesélés, Wikipédia-tények (facts.json), determinisztikus igazság-kapuk (src/draft/truth.ts), számjegyek mindenhol (loadEpisode numeralize), CTA témához, ingyenes LLM-lánc Groq→Cerebras→OpenRouter→Ollama, 16:9 full-bleed (stockScore ≥7 teljes kép, megnevezett dolgok → zászló/karakter, hook-számláló, homográf-szűrő, égitestek).
- 16:9 hosszú: episodes/lf-inflation (B szkriptje, 90 beat, 7.9 min TTS) → episodes/lf-inflation-fb render QA 20/20, de semantic medián 5 (újrarender a 86e2c4a..0c7407b javítások után még NEM volt).
- Nem commitolt WIP (B, félbemaradt a heti limit miatt): src/llm/llm.ts (lépésenkénti modell-térkép), src/draft/draft.ts, story.ts — nézd meg a diffet, tsc + teszt, befejez vagy elvet.

Nyitott feladatok:
A (vizuál):
1. lf-inflation-fb és sc-moon2 újrarender + 1 semantic futás (minden beat) + QA + contact sheet (`npx tsx scripts/qa/stills.ts <id>`); medián beat-típusonként (előző: 5).
2. 16:9 semantic ≥7 (lf-inflation-fb, fbw-ep014): absztrakt mondatok vizuálja.
3. Valódi match cut egy epizódban, videóban ellenőrizve.
B (szkript/hang/infra):
1. WIP befejezése: ingyenes modellek összehasonlítása (Groq gpt-oss-120b, llama-3.3-70b, Cerebras qwen-3, OpenRouter :free) 3 témán story-bíró + igazság-kapukkal; lépésenkénti modell-térkép commit.
2. Story ≥75 3 friss Short drafton (scripts/draft-measure.ts); jelenleg ~60, a fő akadály a draftoló modell minősége.
3. Igaz szkriptű bemutató Short kézi javítás nélkül, végső renderig, `npm run qa` zöld, contact sheet útvonal.
4. YouTube Data API témaválasztás (QUALITY-PLAN 13) – kulcs kell a usertől (`YOUTUBE_API_KEY` a .env-be).

Hasznos: npm run qa (20 check), qa:semantic [--fix], qa:golden, qa:restoryboard, scripts/qa/stills.ts <id>, scripts/qa/cover.ts, scripts/draft-measure.ts. Studio szerverkód változás után a Studiót újra kell indítani.
```
