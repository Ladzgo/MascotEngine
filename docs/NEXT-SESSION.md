# Új session indító prompt (másold be egy friss Claude Code session-be)

```
Folytasd a /Users/laci/ytAutomation (MascotEngine: Remotion + helyi Studio, http://localhost:4177) fejlesztését. A cél: profi, alig AI-nak látszó, CSAK ANGOL videók. Előbb a 9:16 Shorts, utána a 16:9 hosszú videók. Működő HU kódot ne törölj, de ne fókuszálj rá.

Olvasd el először: docs/ARCHITECTURE.md, docs/REFERENCE-ANALYSIS.md, docs/STOCK.md, docs/DECISIONS.md vége, és ezt a fájlt.

Szabályok:
- Magyarul válaszolj, röviden.
- CLAUDE.md: rtk parancsok, Grep/Glob tilos (rtk grep / rtk find). Read csak Edit előtt, csak a szükséges sorokra. A hookot ne kerüld meg.
- Minden lépés után commit ("Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>") és push. A CI (ubuntu) zöld maradjon.
- Ne kérj engedélyt a projekten belüli, visszafordítható lépésekhez. Csak fizetős, külső vagy visszafordíthatatlan lépésnél kérdezz.
- ANTHROPIC_API_KEY csak kérésre (kredit).

Ügynökök:
- Max 2, Opus 5.5, szigorúan diszjunkt fájl-sávokkal.
  - A (vizuál): src/fullbleed, src/fx, src/visuals, src/stock, src/draft/outline.ts, src/draft/storyboard.ts, scripts/qa, docs/STOCK.md.
  - B (szkript/hang/infra): src/director, src/pipeline, src/draft/{draft,lint,story,beats,speech,cli}.ts, src/llm, studio/, scripts/smoke-ui.ts.
- Folyamatosan dolgozzanak, a main mindig adjon nekik következő feladatot (cron-kör ~17 percenként).
- Ha elfogy a roadmap, a main találja ki a következő legjobb feladatot: friss EN Short render, contact sheet (scripts/qa/stills.ts), QA-számok és a referencia-rés alapján.
- Hosszú parancsokat előtérben futtassanak, ne háttérben.

Állapot (2026-11-27, HEAD 7f6cf96, CI zöld):
- LLM: Groq működik (GROQ_API_KEY a .env-ben). A modellt a /models listából rangsorolja, 429-nél a következő modellre lép. Cerebras/OpenRouter is van. A Gemini AQ. kulcs használhatatlan (401).
- Stock: Pixabay (PIXABAY_API_KEY a .env-ben). Topic gate, ötlet-beatek a koncepcióból, minden második stock beat videóklip, fotó fallbackkel.
- Kész:
  - sub-shotok 2–3 mp-enként;
  - fényes padló a sötét sáv helyett;
  - átmenetek csak kameramozgások (whip/tilt/push) vagy vágás;
  - DOF blur és key light;
  - szám-tagmondatok lassabban;
  - captionön nincs TAKEAWAY;
  - a zárómondat visszautal a hookra;
  - legfeljebb 2 rewrite kör 75 pont alatt;
  - Shorts hossz a kimondott szavakból.
- Mérések:
  - ep011: stock 6/6 on-topic, semantic medián 6 (cél 7), képváltás átlag 1.97 mp;
  - ep012: 15/18 QA PASS;
  - hang -14.5 LUFS, TP -1.7.
- Nem commitolt: src/fullbleed/objects4.tsx (egy A-ügynök félbehagyott munkája). Nézd meg a diffet, és döntsd el, hogy befejezed vagy elveted.

Nyitott feladatok:
A (vizuál):
1. Friss EN Short (ep011 + egy tech téma) render. Contact sheet előtte/utána, és vizsgáld meg:
   - nincs-e levágott objektum (malacpersely);
   - nem ütközik-e a caption a charttal;
   - az "if you invested" beat illik-e a tartalomhoz.
2. Semantic medián >= 7, 3 futás átlaga (npm run qa:semantic, qwen2.5vl:7b). Elsőként az absztrakt mondatok vizuálját javítsd (en-sleep: 5).
3. qa:golden referenciák frissítése az új kinézetre.
4. 16:9 hosszú videó kinézetének felhozása a Shorts szintjére.
B (szkript/hang/infra):
1. Shorts 35–55 mp, 150–170 wpm. Mérd 3 Groq drafton.
2. Hook: 5 jelölt, bíró, >= 75 pont. Story device-ok, szám vagy név minden 2. beatben. Ellenőrizd 3 drafton.
3. Derítsd ki, mi írta felül az ep011-v2 episode.json-t.
4. Showcase EN Short a Studióból Groq-kal a végső renderig: npm run qa zöld, és add meg a contact sheet útvonalát.

Hasznos: npm run qa (18 Shorts check), qa:semantic, qa:golden, qa:restoryboard, scripts/qa/stills.ts <id>. A Studio szerverkód változása után a Studiót újra kell indítani.
```
