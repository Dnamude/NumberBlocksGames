# Numberblock Rally! 🏁

A vibrant 3D educational racing & counting game inspired by *Numberblocks* Series 3, Episode 12 (**"Numberblock Rally"**), built with **Three.js**, **TypeScript**, **Vite**, procedural **Web Audio**, and **Web Speech** narration.

## Educational Modes

1. **Count & Cruise (Ages 2–4)**
   - Ultra-forgiving downhill cruise down Mount Numberland with optional toddler auto-steer assist.
   - Drive through glowing **Counting Gates (1 → 10)** in order, collect cheerful **Numberblobs**, hear clear spoken counting + ascending xylophone chimes, and watch your Numberblock grow!
2. **Rally Math (Ages 4–6)**
   - Full 10-racer pedal-powered rally faithful to the episode!
   - Dodge or bump rocks (`10 − 1 = 9`, `8 − 2 = 6`, `7 − 3 = 4`), leap or split through the **Double-Dipper** (`9 − 3 = 6`, `6 − 3 = 3`), boost through **Combine Gates** (`+1`, `+2`, `+3`), experience Nine's sneeze (`9 − 1 = 8`), splash through the **Mud Puddle**, solve visual Pit-Stop counting challenges, and cross the finish line to lift the **Golden Numberblock Rally Trophy**!
3. **Interactive 3D Garage**
   - Pick any of the 10 authentic Numberblocks (**1–10**) on a spinning rainbow turntable, hear their catchphrase, and tap **Count Blocks!** for an animated 1-by-1 glowing block count!

## Controls

- **iPad / Tablet Touch:** Ergonomic bottom-left **LEFT / RIGHT** paddles + bottom-right **JUMP! / BOOST!** button.
- **Desktop Keyboard:** `Arrow Left / Right` or `A / D` to steer, `Space` / `W` / `Arrow Up` to Jump & Boost, `1–9` / `0` to pick racers in the Garage.
- **Parent Settings (⚙️):** Toggle Music, SFX, Spoken Voice, Toddler Auto-Steer Assist, Count Goal (`1–5` or `1–10`), and Pit-Stop Quizzes.

## Run Locally

```bash
npm install
npm run dev
```

## Build Production Bundle

```bash
npm run build
```

## Studio Voice Pack (Gemini 3.8 Flash TTS) & Family Voice Recorder

The game ships with a **3-tier voice engine**:
1. **Family Voice Studio (Built-in, zero setup):** Open **⚙️ Parent Settings → Family Voice Studio 🎙️** on your iPad or laptop to record your own `"One!"`–`"Ten!"`, `"GO!"`, and `"Hooray!"` cheers (stored privately in IndexedDB).
2. **Gemini 3.8 Flash TTS Character Voice Pack (Optional build-time generator):** Pre-generate all 41 expressive British cartoon voice lines (10 distinct Numberblock personas + Major Three's rally commentary + episode equations) into `public/audio/voices/` with zero runtime API keys:
   ```bash
   # Fast mode using curated Gemini 3.8 studio voices + acting style directions:
   GEMINI_API_KEY=your_key npm run generate:voices

   # Or design custom British cartoon personas for all 10 characters via Voice Design:
   GEMINI_API_KEY=your_key npm run generate:voices -- --design-voices
   ```
   The script is resumable, automatically compresses to `.mp3` if `ffmpeg` is installed, and updates `public/audio/voices/manifest.json` so the game picks up the clips automatically on the next deploy.
3. **Expressive Per-Character Web Speech Fallback:** Automatically selects a British English voice when available and applies distinct character pitch/rate profiles.

