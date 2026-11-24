# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite front end, served by a small local Node server that wraps the existing pipeline (`src/pipeline`, `src/director`, Remotion). Runs on the user's own machine, started with one command. No accounts, no hosting.

## Users

One solo creator running one or more faceless YouTube channels (the first is English-language personal finance), each with its own niche, audience, tone and voice. They work one episode at a time at their desk: pick a topic and angle, edit the script, press Generate, check the result, publish. They own topic, angle, opinion and the final script edit. Not a team tool (a later team or approver role is undecided).

## Product Purpose

"Mascot Engine Studio" is the control surface for the Mascot Engine pipeline. A few clicks turn a script into a finished, non-template educational finance video (plus Shorts cut-downs): TTS with word timestamps, director decisions, render, audio mix, captions. Success is a finished video of the quality of the largest AI-powered finance channels without the channel reading as template-made.

## Positioning

Variation comes from the content, not from randomness: the director derives layouts, camera, transitions and SFX from what each scene says and remembers past episodes to avoid repeating treatments, while the channel identity (mascot, ink-on-paper line style, fonts, tone) stays recognisable. A generic video generator cannot copy that history-aware, content-driven variety.

## Operating Context

- Local machine (macOS), Node/TypeScript, Remotion, ffmpeg. Pipeline stages: tts, direct, render (preview 720p / final 1080p), shorts.
- Source of truth per episode: `episodes/<id>/episode.json`; outputs in `episodes/<id>/build/` (timings.json, decisions.json, variety.md, mp4, srt).
- History in `data/history.json`; only a final render writes to it.
- ElevenLabs is the TTS engine in use (keys in `.env`); silent and local-recording engines exist or are planned.

## Capabilities and Constraints

- Screens: channel overview (landing), channels (create/edit), ideas board per channel (AI-generated, Anthropic key), episode list per channel, publish pack tab (titles, description, tags, chapters, thumbnail text),  script/scene editor, one-click Generate with live progress, video player, variety report, decisions.json editor, final render and Shorts, settings.
- Generate default: fully automatic (TTS, direct, preview, then final and Shorts without a manual approval step). Because only a final render writes history, auto mode writes history too. A per-run option to stop at preview is expected.
- UI language is English. Video content (script, captions, on-screen text) is English.
- All numbers on screen come from episode.json; each episode lists sources; an end-card disclaimer when `disclaimer: true`.
- Renders are slow and long-running: progress and failure states must be explicit and recoverable.
- Secrets live in `.env`, never in the UI bundle or logs.
- Undecided: channel name, mascot name/personality, final voice, real mascot art (placeholder mascot until PNGs exist), music tracks.

## Brand Commitments

Hand-drawn ink illustration on paper: paper off-white `#f6f1e4`, near-black ink, one accent colour, Archivo Black (display) and Poppins (sans). These come from the channel's visual identity in the original brief.

## Evidence on Hand

Real episodes `ep001-inflation` and `ep002-compound-interest` with rendered previews, SRT and variety reports under `episodes/*/build/`. No real mascot art, no music, no analytics data yet; do not fabricate any.

## Product Principles

1. One obvious path: a finished video should take a few clicks, with the pipeline's depth available but never in the way.
2. Honest status: long renders show real stage and progress; failures say what broke and how to retry that stage only.
3. Determinism and history are visible, not hidden: seed, variety report and decisions stay inspectable and editable.
4. The human owns the angle and the script; automation owns assembly.
5. Never invent content or numbers.

## Accessibility & Inclusion

No product-specific requirement established; follow standard web accessibility (keyboard operable, readable contrast, reduced-motion respected).
