#!/usr/bin/env bash
# Generates the mood ambient beds in assets/music with ffmpeg sine synthesis (own work, no third-party rights).
# 60 s, integer-Hz sines and tremolo rates k/60 Hz: phase is exactly 0 at the end, so the loop (-stream_loop) is seamless.
set -euo pipefail
cd "$(dirname "$0")/../assets/music"
D=60
gen() { # name, expression
  ffmpeg -y -loglevel error -f lavfi -i "aevalsrc=$2:s=44100:d=$D:c=stereo" -af "lowpass=f=$3,volume=0.5" -b:a 160k "$1.mp3"
}
t() { echo "(1+$2*sin(2*PI*$1/$D*t))"; } # tremolo k cycles per $D seconds, depth $2
# tense: low drone + beating fifth-ish minor second, slow swell
gen ambient-tense "0.30*sin(2*PI*55*t)*$(t 3 0.25)+0.18*sin(2*PI*58*t)+0.10*sin(2*PI*82*t)*$(t 5 0.4)+0.06*sin(2*PI*116*t)|0.30*sin(2*PI*55*t)*$(t 3 0.25)+0.18*sin(2*PI*57*t)+0.10*sin(2*PI*82*t)*$(t 5 0.4)+0.06*sin(2*PI*117*t)" 900
# upbeat: bright major-7 pad with a gentle 1 Hz pulse
gen ambient-upbeat "0.14*sin(2*PI*262*t)+0.12*sin(2*PI*330*t)+0.12*sin(2*PI*392*t)*$(t 60 0.3)+0.08*sin(2*PI*494*t)*$(t 30 0.3)|0.14*sin(2*PI*262*t)+0.12*sin(2*PI*330*t)*$(t 60 0.3)+0.12*sin(2*PI*392*t)+0.08*sin(2*PI*495*t)*$(t 30 0.3)" 2500
# curious: open minor-9 pad (Am9), slow independent swells
gen ambient-curious "0.13*sin(2*PI*110*t)+0.11*sin(2*PI*220*t)*$(t 4 0.35)+0.10*sin(2*PI*262*t)*$(t 6 0.35)+0.08*sin(2*PI*330*t)*$(t 9 0.4)+0.06*sin(2*PI*494*t)*$(t 12 0.4)|0.13*sin(2*PI*110*t)+0.11*sin(2*PI*221*t)*$(t 4 0.35)+0.10*sin(2*PI*262*t)*$(t 6 0.35)+0.08*sin(2*PI*330*t)*$(t 9 0.4)+0.06*sin(2*PI*495*t)*$(t 12 0.4)" 1800
