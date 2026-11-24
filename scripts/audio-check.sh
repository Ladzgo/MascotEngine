#!/usr/bin/env bash
# Usage: scripts/audio-check.sh [episode-dir]   (default episodes/ep001-inflation)
# Measures mix.wav (LUFS, true peak, LRA) and compares voice.wav vs sfx.wav levels. No API calls.
set -euo pipefail
D="${1:-episodes/ep001-inflation}/build"
for f in mix voice sfx; do [ -f "$D/$f.wav" ] || { echo "missing $D/$f.wav"; exit 1; }; done

ebu() { ffmpeg -nostats -hide_banner -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/Summary:/{s=1} s'; }
val() { echo "$1" | awk -v k="$2" '$1==k{print $2}' ; }

for f in mix voice sfx; do
  out=$(ebu "$D/$f.wav")
  echo "== $f.wav"; echo "$out" | grep -E "^\s+(I:|LRA:|Peak:)" | sed 's/^ */  /'
  eval "${f}_I=$(echo "$out" | awk '$1=="I:"{print $2}')"
  eval "${f}_TP=$(echo "$out" | awk '$1=="Peak:"{print $2}')"
done
# short-term loudness of sfx only (sfx.wav is mostly silence so integrated gating hides it): use RMS of non-silent part
sfx_rms=$(ffmpeg -nostats -hide_banner -i "$D/sfx.wav" -af "silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-60dB,astats=metadata=1:reset=0" -f null - 2>&1 | awk '/Overall/{o=1} o && /RMS level dB/{print $NF; exit}')
voice_rms=$(ffmpeg -nostats -hide_banner -i "$D/voice.wav" -af "silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-60dB,astats=metadata=1:reset=0" -f null - 2>&1 | awk '/Overall/{o=1} o && /RMS level dB/{print $NF; exit}')
echo "== voice vs sfx (RMS over non-silent parts)"
echo "  voice RMS: $voice_rms dBFS   sfx RMS: $sfx_rms dBFS"
awk -v v="$voice_rms" -v s="$sfx_rms" -v I="$mix_I" -v tp="$mix_TP" 'BEGIN{
  d=v-s; printf "  voice - sfx = %.1f dB (want >= 8 dB)\n", d;
  printf "  SFX masking voice: %s\n", (d<8?"YES - sfx too hot":"no");
  printf "  Loudness -14 +/-1: %s (I=%s)\n", (I>=-15&&I<=-13?"PASS":"FAIL"), I;
  printf "  True peak <= -1.0 dBTP: %s (TP=%s)\n", (tp<=-1.0?"PASS":"FAIL"), tp }'
