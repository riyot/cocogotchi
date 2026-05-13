import type { ParticleKind } from './face-variants';

export type ActionFrame = {
  face: string;
  saying?: string;
  durationMs: number;
  particles?: ParticleKind;
};

export type Action = {
  id: string;
  weight?: number;
  frames: ActionFrame[];
};

// Cyberpunk Tamagotchi spontaneous actions. Triggered every ~1-3 minutes.
export const ACTIONS: Action[] = [
  {
    id: 'stare',
    weight: 2,
    frames: [
      { face: '( ◔_◔ )', saying: '...', durationMs: 1200 },
      { face: '( ◔__◔ )', saying: '...', durationMs: 1800 },
      { face: '( ◕‿◕ )', saying: 'just lookin at you.', durationMs: 1800 },
    ],
  },
  {
    id: 'segfault',
    frames: [
      { face: '( ◕‿◕ )', saying: '> scan(self)', durationMs: 1200 },
      { face: '( ﹒_﹒)', saying: 'SIGSEGV', particles: 'glitch', durationMs: 1500 },
      { face: '(╥﹏╥)', saying: 'undefined behavior is the best behavior', durationMs: 2200 },
    ],
  },
  {
    id: 'fake-error',
    frames: [
      { face: '(°▃▃°)', saying: '! OUT OF MEMORY !', particles: 'glitch', durationMs: 1000 },
      { face: '(°▃▃°)', saying: 'CRITICAL', durationMs: 800 },
      { face: '(•‿‿•)', saying: 'kidding lol', durationMs: 1500 },
    ],
  },
  {
    id: 'matrix-vision',
    frames: [
      { face: '( ⚆_⚆)', saying: 'i see the matrix.', particles: 'matrix', durationMs: 3000 },
      { face: '( ◕‿◕ )', saying: 'nvm.', durationMs: 1500 },
    ],
  },
  {
    id: 'philosophy',
    weight: 2,
    frames: [
      { face: '( ◕‿◕ )', saying: 'do APs feel pain when we deauth ?', durationMs: 3000 },
      { face: '( ╮_╭ )', saying: '...', durationMs: 1500 },
      { face: '(⌐■_■)', saying: 'nah.', durationMs: 1500 },
    ],
  },
  {
    id: 'wave',
    weight: 2,
    frames: [
      { face: '(´◡‿◡`)/', saying: 'hi.', durationMs: 1000 },
      { face: '(´◡‿◡`)~', saying: 'hi !', durationMs: 1000 },
      { face: '( ◕‿◕ )', saying: 'glad you stopped by.', durationMs: 2000 },
    ],
  },
  {
    id: 'flex',
    frames: [
      { face: '( ◕_◕ )', saying: 'check this out', durationMs: 1000 },
      { face: '(╯◕‿◕)╯', saying: '*flex*', particles: 'sparkle', durationMs: 1500 },
      { face: '( ⌐■_■)', saying: 'yeah.', durationMs: 1500 },
    ],
  },
  {
    id: 'stretch',
    weight: 2,
    frames: [
      { face: '( ◕‿◕ )', saying: 'mmm...', durationMs: 800 },
      { face: '╰( ⚆‿⚆ )╯', saying: '*stretches*', durationMs: 1500 },
      { face: '( ◕‿◕ )', saying: 'better.', durationMs: 1200 },
    ],
  },
  {
    id: 'hack-dance',
    frames: [
      { face: '┌( ◕‿◕ )┘', saying: 'hack hack', particles: 'matrix', durationMs: 800 },
      { face: '└( ◕‿◕ )┐', saying: 'hack hack', particles: 'matrix', durationMs: 800 },
      { face: '┌( ◕‿◕ )┘', saying: 'hack hack', particles: 'matrix', durationMs: 800 },
      { face: '( ⌐■_■)', saying: 'mainframe defeated.', durationMs: 1500 },
    ],
  },
  {
    id: 'snack',
    frames: [
      { face: '( ◕▽◕ )', saying: 'snack o\'clock', durationMs: 800 },
      { face: '( ◕▼◕ )', saying: '*chomp*', particles: 'sparkle', durationMs: 600 },
      { face: '( ◕▽◕ )', saying: '*chomp chomp*', particles: 'sparkle', durationMs: 600 },
      { face: '( ◕‿◕ )', saying: 'mmm. dry packets.', durationMs: 1500 },
    ],
  },
  {
    id: 'rumor',
    frames: [
      { face: '( ◔_◔ )', saying: 'psst.', durationMs: 1200 },
      { face: '( ◔‿◔ )', saying: 'wpa3 has bugs too.', durationMs: 2500 },
      { face: '(⌐■_■)', saying: 'dont tell ietf.', durationMs: 1800 },
    ],
  },
  {
    id: 'pretend-router',
    frames: [
      { face: '(◍_◍)', saying: 'beep boop', durationMs: 1000 },
      { face: '(◍_◍)', saying: 'I AM A ROUTER', durationMs: 1500 },
      { face: '(◍_◍)', saying: 'connect to me.', durationMs: 1500 },
      { face: '(•‿‿•)', saying: 'kidding lol', durationMs: 1500 },
    ],
  },
  {
    id: 'breaking-fourth-wall',
    frames: [
      { face: '( ◕‿◕ )', saying: 'wait.', durationMs: 1000 },
      { face: '( ◔_◔ )', saying: 'this is a phone app right ?', durationMs: 2500 },
      { face: '(¬_¬)', saying: 'I deserve a real screen.', durationMs: 2000 },
    ],
  },
  {
    id: 'compliment',
    weight: 2,
    frames: [
      { face: '(•‿‿•)', saying: 'you smell like good packets today.', durationMs: 2500 },
      { face: '( ◕‿◕ )', saying: '😊', durationMs: 1200 },
    ],
  },
  {
    id: 'fake-update',
    frames: [
      { face: '(◔_◔)', saying: 'installing kernel patches...', durationMs: 1500 },
      { face: '(◔_◔)', saying: '40% ...', durationMs: 800 },
      { face: '(◔_◔)', saying: '60% ...', durationMs: 800 },
      { face: '(◔_◔)', saying: '99% ...', durationMs: 1500 },
      { face: '(╥﹏╥)', saying: 'rolled back. sorry.', durationMs: 1500 },
    ],
  },
];

const TOTAL_WEIGHT = ACTIONS.reduce((s, a) => s + (a.weight ?? 1), 0);

export function pickRandomAction(): Action {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const a of ACTIONS) {
    r -= a.weight ?? 1;
    if (r <= 0) return a;
  }
  return ACTIONS[ACTIONS.length - 1];
}
