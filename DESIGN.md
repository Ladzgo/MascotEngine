---
name: Mascot Engine Studio
description: An ink-on-paper production desk for a faceless finance video channel; the tool wears the channel's own hand-drawn look.
colors:
  paper: "#f6f1e4"
  paper-panel: "#fcf9f0"
  paper-sunk: "#ece5d1"
  ink: "#1b1b1f"
  ink-soft: "#4a483f"
  muted: "#5f5b4f"
  field-line: "#7d786b"
  accent-violet: "#7b4bb7"
  ok-green: "#1f7a46"
  error-tomato: "#b8321a"
  stale-mustard: "#f6d77a"
typography:
  display:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  sm: "7px"
  md: "10px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-violet}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "11px 16px"
  button-secondary:
    backgroundColor: "{colors.paper-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 16px"
  panel:
    backgroundColor: "{colors.paper-panel}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "#fffdf7"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
---

# Design System: Mascot Engine Studio

## Overview

**Creative North Star: "The Production Desk"**

A solo creator's desk covered in paper and ink: the tool looks like the channel it produces. Panels are sheets of paper with a hand-boiled ink outline, the rail is an ink-black spine, and the accent colour changes with the episode being worked on, so the interface already carries the video's identity.

Density is that of a working editor: a clear shell (rail, top bar, player and storyboard, inspector, stage track) with standard controls. The world supplies type, palette, density and one signature move, never the layout.

**Key Characteristics:**
- Paper ground, ink rail, one accent that follows the episode.
- Wobbling 2px ink panel borders (SVG displacement); the wobble animates only while a stage runs.
- Archivo Black for titles, Poppins for everything else.
- Explicit states: running, done, failed, out of date.

## Colors

Restrained paper-and-ink palette with one live accent and functional state colours.

### Primary
- **Episode Accent** (#7b4bb7 fallback): the current episode's accent from `decisions.json` (tomato, teal, mustard, violet, green, blue, pink). Used for the Generate button, selected card, active tab underline and the progress stroke. Text on it flips between white and ink by contrast.

### Neutral
- **Desk Paper** (#f6f1e4): page ground.
- **Clean Sheet** (#fcf9f0): panels.
- **Sunk Paper** (#ece5d1): stage track, chips, table rows.
- **Ink** (#1b1b1f): rail, borders, primary text.
- **Soft Ink** (#4a483f) and **Pencil** (#5f5b4f): secondary text; both pass 4.5:1 on paper.
- **Field Line** (#7d786b): input and card borders.

### State
- **Done Green** (#1f7a46), **Error Tomato** (#b8321a), **Out-of-date Mustard** (#f6d77a).

### Named Rules
**The Live Accent Rule.** The accent is never hard-coded in components; it always reads `--accent`, set from the open episode.
**The State Colour Rule.** Green, tomato and mustard mean done, failed and out of date, nothing else.

## Typography

**Display Font:** Archivo Black. **Body Font:** Poppins 500/700.

**Character:** a blunt headline face over a friendly, legible UI sans, the same pair the videos use.

### Hierarchy
- **Display** (400, 1.5rem, 1.2): episode title, empty states, settings title.
- **Body** (500, 0.875rem, 1.5): all UI copy and fields.
- **Label** (700, 0.75rem): field labels, chips, tabs. Nothing below 12px.

### Named Rules
**The Tabular Rule.** Durations, counts and percentages use tabular numerals.

## Layout

Fixed 252px ink rail (channel switcher with initial badge on top, then Overview / Ideas / Channels links, then the active channel's episodes), 72px top bar, main area with a 360px inspector beside the player and storyboard, and a stage track pinned below. Below 1180px the inspector drops under the storyboard; below 820px the rail becomes a horizontal strip and the page scrolls as one column. Spacing rhythm: 8, 14, 24.

## Elevation & Depth

Flat by default. Depth comes from the ink outline and one soft shadow under the primary button (`0 6px 14px -6px` accent mix). No hard offset shadows, no glass.

## Shapes

Rounded rectangles: 10px panels, 7-9px controls, fully round only for status dots and number badges. Panel borders are 2px ink and wobble through the `#boil` filter; dashed 1.5px borders group related fields.

## Components

### Buttons
- **Primary:** accent fill, 11px 16px padding, 7px radius; `big` variant 14px 24px for Generate.
- **Secondary:** clean-sheet fill with 2px ink border; ghost variant shows the border on hover.
- **Danger:** tomato text and border on transparent.
- **Focus:** 2.5px accent outline, 2px offset.

### Panels
Clean-sheet fill, 10px radius, wobbling ink outline.

### Inputs / Fields
Off-white fill, 1.5px field-line border that turns ink on hover and focus; label above in 12px bold.

### Storyboard card
Paper card, 1.5px field-line border; selected: 2px accent border with a 12% accent tint. Width scales with scene duration (150-300px).

### Stage track
Five steps (Voice, Direct, Preview, Final, Shorts) as bordered tiles: done = green, running = ink border plus an accent ink stroke that draws with progress, failed = tomato with Retry.

## Do's and Don'ts

### Do:
- **Do** read the accent from `--accent`.
- **Do** keep controls standard (tabs, selects, buttons) and let the paper-and-ink world live in type, colour and the boiled outline.
- **Do** show out-of-date renders explicitly.

### Don't:
- **Don't** add gradients, glass, neon or dark-dashboard styling.
- **Don't** use hard offset shadows or side-stripe borders on cards.
- **Don't** put text below 12px or use grey for secondary text on coloured surfaces.
- **Don't** animate the wobble when idle or when reduced motion is requested.


## Multi-channel pages

Overview, Channels and Ideas are full-width pages (max 1100px) on the same paper/ink system: boiled-outline panels, one accent, 12px minimum text, no modals. The channel badge is an accent-filled square with an ink border and the channel's initial. Idea cards and publish-pack rows are ink-on-paper chips and lists; copy actions give inline "Copied" feedback. Below 1180px the Channels list and form stack; the Ideas and Overview grids auto-fill from 300px.
