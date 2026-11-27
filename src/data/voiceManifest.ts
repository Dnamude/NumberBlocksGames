import { NumberblockId } from '../types/game';

export type VoiceSpeakerId = NumberblockId | 'announcer';

export interface CharacterVoiceProfile {
  speaker: VoiceSpeakerId;
  label: string;
  /** Prebuilt Gemini 3.8 TTS studio voice fallback */
  geminiPrebuiltVoice: string;
  /** Natural-language Voice Design prompt for Gemini 3.8 Flash TTS */
  geminiDesignPrompt: string;
  /** Turn-level acting direction passed in speechMetadata.style */
  actingStyle: string;
  /** Expressive pitch & rate tuning for Web Speech fallback */
  webSpeechPitch: number;
  webSpeechRate: number;
}

export interface VoiceClipDefinition {
  id: string;
  speaker: VoiceSpeakerId;
  text: string;
  /** Verbatim transcript with optional Gemini 3.8 inline vocal tags (<laugh>, <sigh>, <short pause>) */
  geminiText?: string;
  style?: string;
}

export interface FamilyVoiceSlot {
  id: string;
  label: string;
  promptText: string;
  accentColor: string;
}

export const CHARACTER_VOICE_PROFILES: Record<VoiceSpeakerId, CharacterVoiceProfile> = {
  announcer: {
    speaker: 'announcer',
    label: 'Major Three (Commentator)',
    geminiPrebuiltVoice: 'Puck',
    geminiDesignPrompt:
      'Theatrical, bubbly, high-energy young British animated circus ringmaster and sports commentator, bright cheerful timbre, playful CBeebies storybook charm.',
    actingStyle: 'excited, bouncy British sports announcer for young children',
    webSpeechPitch: 1.24,
    webSpeechRate: 1.0,
  },
  1: {
    speaker: 1,
    label: 'One',
    geminiPrebuiltVoice: 'Leda',
    geminiDesignPrompt:
      'Tiny, squeaky, adorable, super-cheerful young British childlike cartoon voice, curious and sparkling with joy.',
    actingStyle: 'bubbly, tiny, delighted young British voice',
    webSpeechPitch: 1.48,
    webSpeechRate: 1.02,
  },
  2: {
    speaker: 2,
    label: 'Two',
    geminiPrebuiltVoice: 'Puck',
    geminiDesignPrompt:
      'Upbeat, bouncy, slightly quirky young British cartoon voice with musical rhythm like a cheerful tap dancer.',
    actingStyle: 'cheerful, rhythmic, playful British voice',
    webSpeechPitch: 1.28,
    webSpeechRate: 1.0,
  },
  3: {
    speaker: 3,
    label: 'Three',
    geminiPrebuiltVoice: 'Zephyr',
    geminiDesignPrompt:
      'Show-off, theatrical, bouncy British cartoon voice with bright joyful energy and cheeky pride.',
    actingStyle: 'theatrical, cheeky, proud British cartoon performer',
    webSpeechPitch: 1.32,
    webSpeechRate: 1.02,
  },
  4: {
    speaker: 4,
    label: 'Four',
    geminiPrebuiltVoice: 'Achird',
    geminiDesignPrompt:
      'Warm, friendly, steady young British cartoon buddy voice, enthusiastic and dependable with gentle cheer.',
    actingStyle: 'warm, sturdy, friendly British cartoon buddy',
    webSpeechPitch: 1.06,
    webSpeechRate: 0.96,
  },
  5: {
    speaker: 5,
    label: 'Five',
    geminiPrebuiltVoice: 'Aoede',
    geminiDesignPrompt:
      'Confident, bright, musical British cartoon pop-star voice, cool and encouraging.',
    actingStyle: 'bright, musical, upbeat pop-star energy',
    webSpeechPitch: 1.18,
    webSpeechRate: 0.99,
  },
  6: {
    speaker: 6,
    label: 'Six',
    geminiPrebuiltVoice: 'Kore',
    geminiDesignPrompt:
      'Playful, cheeky, game-loving British cartoon voice with sparkling rhythm and fun energy.',
    actingStyle: 'playful, jazzy, game-loving British charm',
    webSpeechPitch: 1.22,
    webSpeechRate: 1.01,
  },
  7: {
    speaker: 7,
    label: 'Seven',
    geminiPrebuiltVoice: 'Vindemiatrix',
    geminiDesignPrompt:
      'Sunny, breezy, optimistic British cartoon voice full of rainbow wonder and lighthearted cheer.',
    actingStyle: 'sunny, cheerful, breezy British voice',
    webSpeechPitch: 1.16,
    webSpeechRate: 0.98,
  },
  8: {
    speaker: 8,
    label: 'Eight (Octoblock)',
    geminiPrebuiltVoice: 'Fenrir',
    geminiDesignPrompt:
      'Heroic, booming, friendly animated British superhero voice, bold and theatrical yet warm for toddlers.',
    actingStyle: 'heroic, booming, joyful cartoon superhero',
    webSpeechPitch: 0.86,
    webSpeechRate: 0.95,
  },
  9: {
    speaker: 9,
    label: 'Nine',
    geminiPrebuiltVoice: 'Charon',
    geminiDesignPrompt:
      'Calm, gentle, slightly stuffy-nosed British cartoon gentle-giant voice, relaxed and humorous.',
    actingStyle: 'calm, gentle, slightly stuffy British tone',
    webSpeechPitch: 0.92,
    webSpeechRate: 0.92,
  },
  10: {
    speaker: 10,
    label: 'Ten',
    geminiPrebuiltVoice: 'Callirrhoe',
    geminiDesignPrompt:
      'Energetic, bright, courageous British cartoon rocket-captain voice, triumphant and inspiring.',
    actingStyle: 'energetic, heroic, bright rocket captain',
    webSpeechPitch: 1.12,
    webSpeechRate: 1.0,
  },
};

export const FAMILY_VOICE_SLOTS: FamilyVoiceSlot[] = [
  { id: 'num_1', label: '1', promptText: 'One!', accentColor: '#E53935' },
  { id: 'num_2', label: '2', promptText: 'Two!', accentColor: '#FB8C00' },
  { id: 'num_3', label: '3', promptText: 'Three!', accentColor: '#FDD835' },
  { id: 'num_4', label: '4', promptText: 'Four!', accentColor: '#43A047' },
  { id: 'num_5', label: '5', promptText: 'Five!', accentColor: '#29B6F6' },
  { id: 'num_6', label: '6', promptText: 'Six!', accentColor: '#7E57C2' },
  { id: 'num_7', label: '7', promptText: 'Seven!', accentColor: '#AB47BC' },
  { id: 'num_8', label: '8', promptText: 'Eight!', accentColor: '#EC407A' },
  { id: 'num_9', label: '9', promptText: 'Nine!', accentColor: '#757575' },
  { id: 'num_10', label: '10', promptText: 'Ten!', accentColor: '#E53935' },
  { id: 'countdown_go', label: 'GO!', promptText: 'GO! Pedal power!', accentColor: '#43A047' },
  { id: 'cheer_hooray', label: 'Yay!', promptText: 'Hooray! Super counting!', accentColor: '#FF9800' },
];

export const STUDIO_VOICE_CLIPS: VoiceClipDefinition[] = [
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

export interface GeneratedVoiceManifest {
  generatedAt: string | null;
  model: string;
  clips: Record<string, string>;
}

export function getEquationClipId(left: number, op: '+' | '-', right: number, result: number): string {
  const opName = op === '+' ? 'plus' : 'minus';
  return `eq_${left}_${opName}_${right}_${result}`;
}
