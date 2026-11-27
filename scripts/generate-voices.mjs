#!/usr/bin/env node
/**
 * Numberblock Rally — Gemini 3.8 Flash TTS Pre-Generation Pipeline
 *
 * Pre-generates crisp, expressive British cartoon character & commentator
 * voice clips into `public/audio/voices/` and updates `manifest.json` for
 * zero-latency, zero-API-key runtime playback (including static GitHub Pages).
 *
 * Pure Node.js 22 ESM — zero external npm dependencies.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npm run generate:voices
 *   GEMINI_API_KEY=your_key node scripts/generate-voices.mjs --design-voices
 *   GEMINI_API_KEY=your_key node scripts/generate-voices.mjs --only=num_1,countdown_go --force
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'audio', 'voices');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const VOICE_CACHE_PATH = path.join(__dirname, '.voice-cache.json');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash-tts';
const POLITE_DELAY_MS = 350;

/**
 * Character Voice Profiles — synced cleanly with `src/data/voiceManifest.ts`.
 */
export const CHARACTER_VOICE_PROFILES = {
  announcer: {
    speaker: 'announcer',
    label: 'Major Three (Commentator)',
    geminiPrebuiltVoice: 'Puck',
    geminiDesignPrompt:
      'Theatrical, bubbly, high-energy British animation voice actress performing a cheerful circus ringmaster and upbeat sports commentator, bright lively timbre, crisp storybook charm.',
    actingStyle: 'excited, bouncy British sports announcer',
  },
  1: {
    speaker: 1,
    label: 'One',
    geminiPrebuiltVoice: 'Leda',
    geminiDesignPrompt:
      'High-pitched, bubbly, bright-voiced British animation actress performing a cheerful whimsical sprite mascot, energetic, warm, and sparkling with joy.',
    actingStyle: 'bubbly, high-pitched, delighted British animation mascot',
  },
  2: {
    speaker: 2,
    label: 'Two',
    geminiPrebuiltVoice: 'Puck',
    geminiDesignPrompt:
      'Upbeat, bouncy, slightly quirky British male animation voice actor performing a cheerful musical tap-dancing character with playful rhythm.',
    actingStyle: 'cheerful, rhythmic, playful British voice',
  },
  3: {
    speaker: 3,
    label: 'Three',
    geminiPrebuiltVoice: 'Zephyr',
    geminiDesignPrompt:
      'Theatrical, lively, bouncy British female animation voice actor performing a cheeky, proud stage juggler with bright joyful energy.',
    actingStyle: 'theatrical, cheeky, proud British cartoon performer',
  },
  4: {
    speaker: 4,
    label: 'Four',
    geminiPrebuiltVoice: 'Achird',
    geminiDesignPrompt:
      'Warm, friendly, steady British male animation voice actor performing an enthusiastic, dependable buddy character with gentle good cheer.',
    actingStyle: 'warm, sturdy, friendly British cartoon buddy',
  },
  5: {
    speaker: 5,
    label: 'Five',
    geminiPrebuiltVoice: 'Aoede',
    geminiDesignPrompt:
      'Confident, bright, musical British female animation voice actor performing an upbeat pop-star character, cool, warm, and encouraging.',
    actingStyle: 'bright, musical, upbeat pop-star energy',
  },
  6: {
    speaker: 6,
    label: 'Six',
    geminiPrebuiltVoice: 'Kore',
    geminiDesignPrompt:
      'Playful, expressive British female animation voice actor performing a witty, game-loving character with jazzy rhythm and sparkling energy.',
    actingStyle: 'playful, jazzy, game-loving British charm',
  },
  7: {
    speaker: 7,
    label: 'Seven',
    geminiPrebuiltVoice: 'Vindemiatrix',
    geminiDesignPrompt:
      'Sunny, breezy, optimistic British male animation voice actor performing a cheerful lucky adventurer full of rainbow wonder and lighthearted warmth.',
    actingStyle: 'sunny, cheerful, breezy British voice',
  },
  8: {
    speaker: 8,
    label: 'Eight (Octoblock)',
    geminiPrebuiltVoice: 'Fenrir',
    geminiDesignPrompt:
      'Heroic, booming, friendly British baritone animation voice actor performing a bold, theatrical animated superhero with warm comedic flair.',
    actingStyle: 'heroic, booming, joyful cartoon superhero',
  },
  9: {
    speaker: 9,
    label: 'Nine',
    geminiPrebuiltVoice: 'Charon',
    geminiDesignPrompt:
      'Calm, gentle, slightly nasal British male animation voice actor performing a relaxed, good-natured gentle giant with dry comedic warmth.',
    actingStyle: 'calm, gentle, slightly stuffy British tone',
  },
  10: {
    speaker: 10,
    label: 'Ten',
    geminiPrebuiltVoice: 'Callirrhoe',
    geminiDesignPrompt:
      'Energetic, bright, courageous British female animation voice actor performing an adventurous rocket-captain hero, triumphant and inspiring.',
    actingStyle: 'energetic, heroic, bright rocket captain',
  },
};

/**
 * Studio Voice Clips — synced cleanly with `src/data/voiceManifest.ts`.
 */
export const STUDIO_VOICE_CLIPS = [
  // Counting 1-10 (spoken cheerfully by each matching Numberblock!)
  { id: 'num_1', speaker: 1, text: 'One!', geminiText: 'One!' },
  { id: 'num_2', speaker: 2, text: 'Two!', geminiText: 'Two!' },
  { id: 'num_3', speaker: 3, text: 'Three!', geminiText: 'Three!' },
  { id: 'num_4', speaker: 4, text: 'Four!', geminiText: 'Four!' },
  { id: 'num_5', speaker: 5, text: 'Five!', geminiText: 'Five!' },
  { id: 'num_6', speaker: 6, text: 'Six!', geminiText: 'Six!' },
  { id: 'num_7', speaker: 7, text: 'Seven!', geminiText: 'Seven!' },
  { id: 'num_8', speaker: 8, text: 'Eight!', geminiText: 'Eight!' },
  { id: 'num_9', speaker: 9, text: 'Nine!', geminiText: 'Nine!' },
  { id: 'num_10', speaker: 10, text: 'Ten!', geminiText: 'Ten!' },

  // Modular equation words for dynamic stitching
  { id: 'op_plus', speaker: 'announcer', text: 'plus' },
  { id: 'op_minus', speaker: 'announcer', text: 'minus' },
  { id: 'op_equals', speaker: 'announcer', text: 'equals' },

  // Character catchphrases (Garage & selection)
  { id: 'char_1_catchphrase', speaker: 1, text: 'One! Only one can lift the trophy!', geminiText: '<laugh> One! Only one can lift the trophy!' },
  { id: 'char_2_catchphrase', speaker: 2, text: 'Two! Two dancing shoes and cool glasses!' },
  { id: 'char_3_catchphrase', speaker: 3, text: 'Three! Look at me, one two three!' },
  { id: 'char_4_catchphrase', speaker: 4, text: 'Four! Four-wheel drive!' },
  { id: 'char_5_catchphrase', speaker: 5, text: 'Five! High five, super star!' },
  { id: 'char_6_catchphrase', speaker: 6, text: 'Six! Roll the dice, vroom vroom!' },
  { id: 'char_7_catchphrase', speaker: 7, text: 'Seven! Lucky rainbow racer!' },
  { id: 'char_8_catchphrase', speaker: 8, text: 'Eight! Octoblock, race!' },
  { id: 'char_9_catchphrase', speaker: 9, text: 'Nine! Nice day for it! Ah-choo!', geminiText: 'Nine! Nice day for it! <short pause> Ah-choo!' },
  { id: 'char_10_catchphrase', speaker: 10, text: 'Ten! Blast off to the finish line!' },

  // Iconic Episode Hero Equations (S3E12 Numberblock Rally)
  { id: 'eq_10_minus_1_9', speaker: 'announcer', text: 'Ten minus one equals nine!', style: 'excited and clear educational sports announcer' },
  { id: 'eq_8_minus_2_6', speaker: 'announcer', text: 'Eight minus two equals six!', style: 'excited and clear educational sports announcer' },
  { id: 'eq_7_minus_3_4', speaker: 'announcer', text: 'Seven minus three equals four!', style: 'excited and clear educational sports announcer' },
  { id: 'eq_9_minus_3_6', speaker: 'announcer', text: 'Nine minus three equals six!', style: 'excited and clear educational sports announcer' },
  { id: 'eq_6_minus_3_3', speaker: 'announcer', text: 'Six minus three equals three!', style: 'excited and clear educational sports announcer' },
  { id: 'eq_3_plus_3_6', speaker: 'announcer', text: 'Three plus three equals six!', style: 'joyful celebratory British announcer' },
  { id: 'eq_9_minus_1_8', speaker: 8, text: 'Nine minus one equals eight! Octoblock, back in action!', style: 'heroic and delighted' },

  // Rally Commentary, Countdown & Celebrations
  { id: 'countdown_ready', speaker: 'announcer', text: 'Welcome to the Numberblock Rally! Ready, steady, three!' },
  { id: 'countdown_go', speaker: 'announcer', text: 'GO! Pedal power!' },
  { id: 'double_dipper_warn', speaker: 'announcer', text: 'Mind the Double-Dipper up ahead!' },
  { id: 'three_arguing', speaker: 3, text: 'Do you mind? I am commentating here!' },
  { id: 'sneeze_nine', speaker: 9, text: 'Ah-CHOO! Oh dear!', geminiText: 'Ah-ah-CHOO! <sigh> Nice day for it!' },
  { id: 'mud_splash', speaker: 'announcer', text: 'Splash! Almost at the finish line!' },
  { id: 'super_jump', speaker: 'announcer', text: 'Woohoo! Super jump!' },
  { id: 'cheer_hooray', speaker: 'announcer', text: 'Hooray! Super counting!', geminiText: '<laugh> Hooray! Super counting!' },
  { id: 'one_wins_trophy', speaker: 1, text: 'Only ONE can lift the trophy! Hooray!', geminiText: '<laugh> Only ONE can lift the trophy! Hooray!' },
  { id: 'finish_celebrate', speaker: 'announcer', text: 'What a fantastic Numberblock Rally! You did it!' },
  { id: 'pitstop_try_again', speaker: 'announcer', text: 'Good try! Let us count them together!' },
];

function printUsage() {
  console.log(`
Numberblock Rally — Gemini 3.8 Flash TTS Voice Generator

Usage:
  GEMINI_API_KEY=<key> npm run generate:voices [-- options]

Options:
  --model=<id>       TTS model: gemini-3.8-flash-tts (default) or gemini-3.8-flash-lite-tts
  --design-voices    Create & cache custom British cartoon voices via Gemini 3.8 Voice Design
  --force            Re-generate clips even if already saved on disk
  --compress         Convert 24kHz WAV to compact 64kbps mono MP3 via ffmpeg (default if available)
  --no-compress      Keep raw 24kHz .wav files instead of converting to .mp3
  --only=<ids>       Comma-separated list of clip IDs to generate (e.g. --only=num_1,countdown_go)
  -h, --help         Show this help message
`);
}

function printMissingApiKeyGuide() {
  console.error(`
========================================================================
  GEMINI_API_KEY is not set!
========================================================================

To pre-generate studio character voices with Gemini 3.8 Flash TTS:

  1. Visit Google AI Studio to get a free API key:
     https://aistudio.google.com/apikey

  2. Run the generator with your key:
     GEMINI_API_KEY=your_api_key_here npm run generate:voices

  Optional flags:
     --design-voices              Create persistent custom British cartoon voices
     --model=gemini-3.8-flash-lite-tts   Use the faster/lighter TTS model
     --no-compress                Save uncompressed .wav files
     --only=num_1,countdown_go    Generate only specific clip IDs

Tip: The game already plays smoothly without pre-generated clips using
     its built-in Web Speech + Family Voice Studio fallback!
========================================================================
`);
}

function parseArgs(argv) {
  const options = {
    model: DEFAULT_MODEL,
    designVoices: false,
    force: false,
    compress: null, // null = auto-detect ffmpeg
    only: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '--design-voices') {
      options.designVoices = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--compress') {
      options.compress = true;
    } else if (arg === '--no-compress') {
      options.compress = false;
    } else if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length).trim();
    } else if (arg === '--model' && argv[i + 1]) {
      options.model = argv[++i].trim();
    } else if (arg.startsWith('--only=')) {
      const raw = arg.slice('--only='.length).trim();
      options.only = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--only' && argv[i + 1]) {
      options.only = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      console.warn(`Warning: Unknown CLI flag ignored: ${arg}`);
    }
  }

  return options;
}

function hasFfmpeg() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures raw 24kHz 16-bit mono PCM bytes have a valid 44-byte RIFF/WAVE header.
 */
function ensureWavBuffer(audioBytes) {
  if (
    audioBytes.length >= 12 &&
    audioBytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    audioBytes.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return audioBytes;
  }

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = audioBytes.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioBytes]);
}

function convertWavToMp3(wavPath, mp3Path) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-ac',
      '1',
      '-ar',
      '24000',
      '-b:a',
      '64k',
      mp3Path,
    ],
    { stdio: 'inherit' }
  );
}

async function readManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      generatedAt: parsed.generatedAt ?? null,
      model: parsed.model ?? DEFAULT_MODEL,
      clips: typeof parsed.clips === 'object' && parsed.clips !== null ? parsed.clips : {},
    };
  } catch {
    return {
      generatedAt: null,
      model: DEFAULT_MODEL,
      clips: {},
    };
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const orderedClips = {};
  for (const clip of STUDIO_VOICE_CLIPS) {
    if (manifest.clips[clip.id]) {
      orderedClips[clip.id] = manifest.clips[clip.id];
    }
  }
  for (const [key, value] of Object.entries(manifest.clips)) {
    if (!orderedClips[key] && value) {
      orderedClips[key] = value;
    }
  }

  const payload = {
    generatedAt: manifest.generatedAt,
    model: manifest.model,
    clips: orderedClips,
  };
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function readVoiceCache() {
  try {
    const raw = await fs.readFile(VOICE_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.voices === 'object' && parsed.voices !== null) {
      return parsed;
    }
    return { model: DEFAULT_MODEL, updatedAt: null, voices: parsed || {} };
  } catch {
    return { model: DEFAULT_MODEL, updatedAt: null, voices: {} };
  }
}

async function writeVoiceCache(cache) {
  await fs.mkdir(path.dirname(VOICE_CACHE_PATH), { recursive: true });
  await fs.writeFile(VOICE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function extractVoiceId(data) {
  const candidate =
    data?.voice?.name ||
    data?.voice?.voiceId ||
    data?.voice?.id ||
    data?.name ||
    data?.voiceId ||
    data?.id;

  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }

  // Normalize "voices/voice_123" -> "voice_123" if prefixed, otherwise keep as-is
  return candidate.startsWith('voices/') ? candidate.slice('voices/'.length) : candidate;
}

class RateLimitError extends Error {
  constructor(message, retryAfterMs = 0) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

async function createDesignedVoice(apiKey, model, profile) {
  const endpoint = `${API_BASE}/voices`;
  const payloads = [
    {
      voice: {
        model,
        type: 'VOICE_TYPE_PROMPTED',
        prompted: { input: profile.geminiDesignPrompt },
      },
      store: true,
    },
    {
      voice: {
        model,
        type: 'prompted',
        prompted: { input: profile.geminiDesignPrompt },
      },
      store: true,
    },
  ];

  let lastErrorText = '';
  for (let attempt = 0; attempt < payloads.length; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payloads[attempt]),
    });

    if (res.status === 429) {
      const retryAfterSec = Number(res.headers.get('retry-after')) || 0;
      throw new RateLimitError(
        `HTTP 429 rate limited while designing voice for ${profile.label}`,
        retryAfterSec * 1000
      );
    }

    if (res.ok) {
      const data = await res.json();
      const voiceId = extractVoiceId(data);
      if (!voiceId) {
        throw new Error(
          `Voice Design succeeded for ${profile.label} but returned unexpected payload: ${JSON.stringify(data)}`
        );
      }
      return voiceId;
    }

    lastErrorText = await res.text();
    // Retry with alternate enum casing only on HTTP 400 validation errors
    if (res.status !== 400) {
      throw new Error(`HTTP ${res.status} designing voice for ${profile.label}: ${lastErrorText}`);
    }
  }

  throw new Error(`HTTP 400 designing voice for ${profile.label}: ${lastErrorText}`);
}

async function ensureDesignedVoices(apiKey, model, speakersNeeded) {
  const cache = await readVoiceCache();
  let updated = false;

  console.log(`\nDesigning persistent custom British cartoon voices (${model})...`);

  for (const speakerKey of speakersNeeded) {
    const key = String(speakerKey);
    const profile = CHARACTER_VOICE_PROFILES[speakerKey];
    if (!profile) continue;

    if (cache.voices[key]) {
      console.log(`  [cached] ${profile.label} -> ${cache.voices[key]}`);
      continue;
    }

    const voiceId = await createDesignedVoice(apiKey, model, profile);
    cache.voices[key] = voiceId;
    cache.model = model;
    cache.updatedAt = new Date().toISOString();
    updated = true;
    await writeVoiceCache(cache);
    console.log(`  [created] ${profile.label} -> ${voiceId}`);
    await sleep(POLITE_DELAY_MS);
  }

  if (updated) {
    console.log(`Saved custom voice IDs to ${path.relative(ROOT_DIR, VOICE_CACHE_PATH)}`);
  }

  return cache.voices;
}

async function synthesizeClip(apiKey, model, clip, profile, voiceIdOrPrebuilt) {
  const endpoint = `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const text = clip.geminiText || clip.text;
  const style = clip.style || profile.actingStyle;

  const body = {
    contents: [
      {
        parts: [
          {
            text,
            speechMetadata: {
              style,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          voice: voiceIdOrPrebuilt,
        },
      },
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get('retry-after')) || 0;
    throw new RateLimitError(`HTTP 429 rate limited on clip "${clip.id}"`, retryAfterSec * 1000);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} on clip "${clip.id}": ${errText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p) => p?.inlineData?.data) || parts[0];
  const base64Data = audioPart?.inlineData?.data;

  if (!base64Data) {
    throw new Error(
      `No inlineData.data returned for clip "${clip.id}": ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return Buffer.from(base64Data, 'base64');
}

async function findExistingClipFile(clipId, preferMp3) {
  const candidates = preferMp3
    ? [`${clipId}.mp3`, `${clipId}.wav`]
    : [`${clipId}.wav`, `${clipId}.mp3`];

  for (const filename of candidates) {
    if (await fileExists(path.join(OUTPUT_DIR, filename))) {
      return filename;
    }
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    printMissingApiKeyGuide();
    process.exit(1);
  }

  const ffmpegAvailable = hasFfmpeg();
  let useCompression = options.compress === null ? ffmpegAvailable : options.compress;
  if (options.compress === true && !ffmpegAvailable) {
    console.warn('Warning: --compress requested, but ffmpeg is not installed on PATH. Falling back to .wav.');
    useCompression = false;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const manifest = await readManifest();
  manifest.model = options.model;

  let targetClips = STUDIO_VOICE_CLIPS;
  if (options.only && options.only.length > 0) {
    const wanted = new Set(options.only);
    const knownIds = new Set(STUDIO_VOICE_CLIPS.map((c) => c.id));
    for (const id of wanted) {
      if (!knownIds.has(id)) {
        console.warn(`Warning: Unknown clip ID in --only: "${id}"`);
      }
    }
    targetClips = STUDIO_VOICE_CLIPS.filter((c) => wanted.has(c.id));
    if (targetClips.length === 0) {
      console.error('Error: No valid clip IDs matched --only filter.');
      process.exit(1);
    }
  }

  console.log(`Numberblock Rally Voice Generator`);
  console.log(`  Model:        ${options.model}`);
  console.log(`  Voice Mode:   ${options.designVoices ? 'Gemini 3.8 Voice Design (custom cached voices)' : 'Prebuilt Studio Voices + speechMetadata.style'}`);
  console.log(`  Output Format:${useCompression ? ' 64kbps mono MP3 (via ffmpeg)' : ' 24kHz 16-bit mono WAV'}`);
  console.log(`  Clips Queued: ${targetClips.length} / ${STUDIO_VOICE_CLIPS.length}`);

  let designedVoiceMap = {};
  if (options.designVoices) {
    const speakersNeeded = [...new Set(targetClips.map((c) => c.speaker))];
    try {
      designedVoiceMap = await ensureDesignedVoices(apiKey, options.model, speakersNeeded);
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.error(`\nRate limit reached during Voice Design (${err.message}).`);
        console.error('Cached voices so far are saved in scripts/.voice-cache.json. Re-run in a moment to resume!');
        await writeManifest(manifest);
        process.exit(1);
      }
      throw err;
    }
  }

  let generatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetClips.length; i++) {
    const clip = targetClips[i];
    const profile = CHARACTER_VOICE_PROFILES[clip.speaker];
    const progressTag = `[${String(i + 1).padStart(2, '0')}/${String(targetClips.length).padStart(2, '0')}]`;

    if (!options.force) {
      const existingFilename = await findExistingClipFile(clip.id, useCompression);
      if (existingFilename) {
        manifest.clips[clip.id] = existingFilename;
        skippedCount++;
        console.log(`${progressTag} [skip] ${clip.id} (${existingFilename} already exists)`);
        continue;
      }
    }

    const voiceIdOrPrebuilt = options.designVoices
      ? designedVoiceMap[String(clip.speaker)] || profile.geminiPrebuiltVoice
      : profile.geminiPrebuiltVoice;

    let rawAudio = null;
    try {
      rawAudio = await synthesizeClip(apiKey, options.model, clip, profile, voiceIdOrPrebuilt);
    } catch (err) {
      if (err instanceof RateLimitError) {
        const waitMs = Math.min(Math.max(err.retryAfterMs || 4000, 2000), 15000);
        console.warn(`${progressTag} [429] Rate limited on ${clip.id}. Waiting ${Math.round(waitMs / 1000)}s and retrying once...`);
        await sleep(waitMs);
        try {
          rawAudio = await synthesizeClip(apiKey, options.model, clip, profile, voiceIdOrPrebuilt);
        } catch (retryErr) {
          await writeManifest(manifest);
          console.error(`
========================================================================
  Quota / Rate Limit Reached (HTTP 429) on "${clip.id}"
========================================================================
  Progress saved! ${Object.keys(manifest.clips).length} clip(s) are recorded in:
  public/audio/voices/manifest.json

  Re-run the same command in a minute to resume where you left off:
  GEMINI_API_KEY=... npm run generate:voices${options.designVoices ? ' -- --design-voices' : ''}
========================================================================`);
          process.exit(1);
        }
      } else {
        failedCount++;
        console.error(`${progressTag} [fail] ${clip.id}: ${err.message}`);
        await sleep(POLITE_DELAY_MS);
        continue;
      }
    }

    const wavBuffer = ensureWavBuffer(rawAudio);
    const wavFilename = `${clip.id}.wav`;
    const wavPath = path.join(OUTPUT_DIR, wavFilename);

    let finalFilename = wavFilename;
    if (useCompression) {
      const mp3Filename = `${clip.id}.mp3`;
      const mp3Path = path.join(OUTPUT_DIR, mp3Filename);
      await fs.writeFile(wavPath, wavBuffer);
      try {
        convertWavToMp3(wavPath, mp3Path);
        await fs.unlink(wavPath);
        finalFilename = mp3Filename;
      } catch (convErr) {
        console.warn(`  Warning: ffmpeg failed for ${clip.id}, keeping ${wavFilename}: ${convErr.message}`);
        finalFilename = wavFilename;
      }
    } else {
      await fs.writeFile(wavPath, wavBuffer);
    }

    manifest.clips[clip.id] = finalFilename;
    manifest.generatedAt = new Date().toISOString();
    await writeManifest(manifest);

    generatedCount++;
    console.log(
      `${progressTag} [ok]   ${clip.id} -> ${finalFilename} (${profile.label}, voice=${voiceIdOrPrebuilt})`
    );

    if (i < targetClips.length - 1) {
      await sleep(POLITE_DELAY_MS);
    }
  }

  if (generatedCount > 0 || !manifest.generatedAt) {
    manifest.generatedAt = generatedCount > 0 ? new Date().toISOString() : manifest.generatedAt;
  }
  await writeManifest(manifest);

  console.log(`\nDone!`);
  console.log(`  Generated: ${generatedCount}`);
  console.log(`  Skipped:   ${skippedCount}`);
  console.log(`  Failed:    ${failedCount}`);
  console.log(`  Manifest:  ${path.relative(ROOT_DIR, MANIFEST_PATH)} (${Object.keys(manifest.clips).length} total clips)`);
}

main().catch((err) => {
  console.error('Fatal error in generate-voices:', err);
  process.exit(1);
});
