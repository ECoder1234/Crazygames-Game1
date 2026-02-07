# Quantum Leap: Infinity

## Overview
- HTML5 canvas platformer designed for CrazyGames.
- Entry point is `index.html`.
- Uses CrazyGames SDK v3 for gameplay events and cloud persistence.
- Level Select unlocks only completed levels.
- Daily reward is auto-claimed on load with a 7-day streak.
- Game auto-starts into Classic to meet CrazyGames “land in gameplay immediately” requirement.
- Daily reward shows as a non-blocking toast (no extra click).
- Upgrade caps: Jump/Speed/Coin multiplier max at 5.
- Settings include Sound FX toggle, a loudness slider, and adjustable Jump/Speed strength sliders.
- Double jump can be disabled in settings even when owned.
- The game resumes at the last played Classic level on next load.
- Spikes only appear from Level 45 onward.
- Enemies start appearing from Level 30, and guns unlock with multiple gun types.
- Enemy types by level: crawlers (30+), hoppers (35+), floaters (40+).

## Files
- `index.html` markup, loads SDK, `styles.css`, and `game.js`.
- `styles.css` UI styling and overlays.
- `game.js` gameplay, tutorial, UI, and persistence logic.

## Run
- Open `index.html` in a browser or serve the folder with a simple static server.

## Controls
- Move: `A`/`D`, `Q`/`D` (AZERTY), or Arrow keys.
- Jump: `Space`, `W`, `Z`, or `ArrowUp`.
- Pause: `P`.
- Shoot: `F` (after gun purchase).

## Persistence
- Cloud save/load via `CG.data.get` and `CG.data.set` key `save`.
- No `localStorage`, `alert()`, or `confirm()` usage to avoid leaving fullscreen.
- Level progress is saved only on completion (per-level seeds + max level).
- Gun unlock is saved in the same cloud save.
- Daily streak is saved and rewarded on first load each day.
- Last played Classic level is saved and restored on next launch.
