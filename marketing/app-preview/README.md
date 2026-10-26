# Haptic Heist — App Store Preview

A 29.9-second promo video and App Store screenshots, made **from the real app**. Every image of the interface comes from the app's own code, played and filmed frame by frame.

| File | Content |
|---|---|
| `out/haptic-heist-preview.mp4` | Main version: iPhone in motion, camera moves, text, real sound effects |
| `out/haptic-heist-preview-store.mp4` | Same film, with the app screen alone: no drawn iPhone and no 3D tilt (the safest for App Store review) |
| `out/screenshots/*.png` | 6 App Store screenshots at 6.9" (1290 × 2796), taken from the same shots |
| `STORYBOARD.md` | Project analysis, storyboard shot by shot, visual direction |

**App Store specs met:** 886 × 1920 (6.9" and 6.5" displays), 30 fps, H.264 High, AAC stereo 48 kHz 256 kb/s, under 30 s.

## Rendering

Prerequisites: `npm install`, Chromium for Playwright (`npx playwright install chromium`), and `ffmpeg` with `libx264`.

```bash
npm run preview            # does everything: capture, soundtrack, both videos, screenshots
# or step by step:
npm run preview:capture    # films the real app (web export) → .cache/clips
npm run preview:audio      # soundtrack → .cache/audio/soundtrack.wav
npm run preview:render     # videos + screenshots → out/
node marketing/app-preview/scripts/render.cjs --stills=4.8,13.6   # check a few frames
```

A full render takes about 10 minutes. The result is identical from one render to the next: the clock and the randomness are deterministic.

## How it works

1. **`scripts/capture.cjs` films the app.**
   - It loads the web export into Chromium at the exact format of an iPhone 15 Pro: 393 × 852 pt at ×3, with the Dynamic Island and home indicator safe areas imposed.
   - The browser clock is frozen and only moves 1/30 s per frame, so the app's animations come out perfectly smooth.
   - A first scouting pass finds where the anchor point and the decoys are hidden. The filmed take then turns the dial onto them, the way a player would.
   - Career saves are produced by the app's real loot generator (`scripts/careers.cjs`).
2. **`timeline.mjs` describes the whole film.** Which capture plays when, the camera, the text, the haptic waves and the scene colors.
3. **`composer/` draws each frame.** An HTML page renders the flat iPhone (status bar 9:41, Dynamic Island), the camera moves, the text animations, the touch point and the waves.
4. **`scripts/soundtrack.cjs` builds the soundtrack.**
   - The sound effects are the app's own (`src/engine/audio/synth.ts`), placed on the captured events: dial ticks, anchor, unlock, bolts, decoy, siren.
   - The music underneath is sober and synthesized, with chords that follow the story.
5. **`scripts/render.cjs` assembles everything.** It drives the composer frame by frame, then encodes with ffmpeg.

## Changing the video

- **Text, timing, camera:** `timeline.mjs`, then `npm run preview:render`.
- **New footage** (after an interface change): `npm run preview:capture`, then re-render. Any change to the app's screens shows up automatically in the video and the screenshots.

## App Store note

Apple asks that previews show the app itself. The `-store` version, with only the app screen and no drawn hardware, follows that rule to the letter. The version with the iPhone is better suited to the web, social networks and presentations.
