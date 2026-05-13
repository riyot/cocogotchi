import type { Mood } from '@/services/esp';

// Micro-variants of each mood — picked at random every few hundred ms to give the
// pet a "breathing/blinking" feeling. First entry is the canonical face.
export const MOOD_FRAMES: Record<Mood, readonly string[]> = {
  awake: ['( ◕‿◕ )', '( ◔‿◔ )', '( ◕ω◕ )', '( ⚆‿⚆ )', '( ◠‿◠ )'],
  looking: ['( ⚆_⚆)', '(☉_☉ )', '( ◕ _◕)', '(◕ _ ◕ )', '( ◕‿◔)'],
  happy: ['(•‿‿•)', '(♡‿‿♡)', '(◕‿‿◕)', '(•ᴗ•)', '(◠‿◠)'],
  excited: ['(ᵔ◡◡ᵔ)', '(ᵔωᵔ)', '(★‿★)', '(◕▿◕)', '(ʘ‿ʘ)'],
  cool: ['(⌐■_■)', '(⌐■‿■)', '(⌐□_□)', '( ⌐■-■)', '(⌐◨_◨)'],
  intense: ['(°▃▃°)', '(◣_◢)', '(▣_▣)', '(>◣◢<)', '(ಠ_ಠ)'],
  bored: ['(︶︹︶)', '(︶_︶)', '(¬_¬)', '(•_•)', '(ㆆ_ㆆ)'],
  lonely: ['(ب__ب)', '(╥_╥)', '(´◔︎‿◔︎`)', '(っ﹏╥)', '(•́︵•̀)'],
  sad: ['(╥﹏╥)', '(ಥ﹏ಥ)', '(ಥ_ಥ)', '(•́︵•̀)', '(꒦ິ⌑꒦ີ)'],
  angry: ["(-_-')", '(╬•_•)', '(>_<)', '(╬◣_◢)', '(╬ಠ益ಠ)'],
  grateful: ['(^‿‿^)', '(◕‿‿◕)', '(♥‿‿♥)', '(◠‿◠)', '(◡‿◡✿)'],
  sleeping: ['(⇀‿‿↼)', '(≖‿‿≖)', '(-‿‿-)', '(˘‿‿˘)', '(´-‿-)'],
};

// What kind of ambient particles to show for each mood.
export type ParticleKind = 'z' | 'sparkle' | 'glitch' | 'matrix' | 'heart' | null;

export const MOOD_PARTICLES: Record<Mood, ParticleKind> = {
  awake: null,
  looking: null,
  happy: 'sparkle',
  excited: 'sparkle',
  cool: null,
  intense: 'glitch',
  bored: null,
  lonely: null,
  sad: null,
  angry: 'glitch',
  grateful: 'heart',
  sleeping: 'z',
};
