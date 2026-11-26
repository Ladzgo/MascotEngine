#!/usr/bin/env python3
"""TTS bridge: reads a JSON job on stdin, writes one wav/mp3 per segment.
job = {"engine": "kokoro|piper|edge", "voice": str, "lang": "en|hu|...", "models": dir, "segments": [{"text": str, "speed": 1.0, "out": path}]}
Prints OK <n> on success; errors go to stderr with exit code 1."""
import sys, json, os, asyncio, wave

job = json.load(sys.stdin)
eng, voice, lang, models, segs = job["engine"], job["voice"], job.get("lang", "en"), job.get("models", "."), job["segments"]

if eng == "kokoro":
    import soundfile as sf
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
    kl = {"en": "en-us", "gb": "en-gb", "fr": "fr-fr", "es": "es", "it": "it", "pt": "pt-br", "ja": "ja", "zh": "cmn"}.get(lang, "en-us")
    for s in segs:
        a, sr = k.create(s["text"], voice=voice, speed=s.get("speed", 1.0), lang=kl)
        sf.write(s["out"], a, sr)
elif eng == "piper":
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    v = PiperVoice.load(os.path.join(models, voice + ".onnx"))
    for s in segs:
        with wave.open(s["out"], "wb") as w:
            # piper length_scale is the inverse of speed
            v.synthesize_wav(s["text"], w, SynthesisConfig(length_scale=1.0 / max(0.5, s.get("speed", 1.0)), noise_scale=0.62, noise_w_scale=0.7))
elif eng == "edge":
    import edge_tts
    async def go():
        for s in segs:
            pct = round((s.get("speed", 1.0) - 1.0) * 100)
            await edge_tts.Communicate(s["text"], voice, rate=f"{pct:+d}%").save(s["out"])
    asyncio.run(go())
else:
    sys.exit("unknown engine " + eng)
print("OK", len(segs))
