import { useEffect, useReducer, useRef } from 'react';

import { type Action, pickRandomAction } from '@/constants/actions';
import { MOOD_FRAMES, MOOD_PARTICLES, type ParticleKind } from '@/constants/face-variants';
import type { Mood } from '@/services/esp';

const IDLE_FRAME_MIN_MS = 900;
const IDLE_FRAME_MAX_MS = 2200;
const ACTION_GAP_MIN_MS = 60_000;
const ACTION_GAP_MAX_MS = 180_000;

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

type State = {
  face: string;
  saying: string;
  particles: ParticleKind;
  inAction: boolean;
};

type Inputs = {
  mood: Mood;
  defaultSaying: string;
};

export function useFaceAnimator({ mood, defaultSaying }: Inputs): State {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const stateRef = useRef<State>({
    face: MOOD_FRAMES[mood][0],
    saying: defaultSaying,
    particles: MOOD_PARTICLES[mood],
    inAction: false,
  });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionStepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodRef = useRef(mood);
  const sayingRef = useRef(defaultSaying);

  moodRef.current = mood;
  sayingRef.current = defaultSaying;

  // Update state and force re-render.
  const patch = (partial: Partial<State>) => {
    stateRef.current = { ...stateRef.current, ...partial };
    force();
  };

  // Idle frame cycling — runs when no action is playing.
  useEffect(() => {
    const tick = () => {
      if (!stateRef.current.inAction) {
        const frames = MOOD_FRAMES[moodRef.current] ?? MOOD_FRAMES.awake;
        patch({
          face: pick(frames),
          saying: sayingRef.current,
          particles: MOOD_PARTICLES[moodRef.current],
        });
      }
      idleTimerRef.current = setTimeout(
        tick,
        IDLE_FRAME_MIN_MS + Math.random() * (IDLE_FRAME_MAX_MS - IDLE_FRAME_MIN_MS)
      );
    };
    tick();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // When mood/saying changes between actions, refresh immediately.
  useEffect(() => {
    if (!stateRef.current.inAction) {
      const frames = MOOD_FRAMES[mood] ?? MOOD_FRAMES.awake;
      patch({ face: frames[0], saying: defaultSaying, particles: MOOD_PARTICLES[mood] });
    }
  }, [mood, defaultSaying]);

  // Spontaneous action scheduler.
  useEffect(() => {
    const scheduleNext = () => {
      const delay = ACTION_GAP_MIN_MS + Math.random() * (ACTION_GAP_MAX_MS - ACTION_GAP_MIN_MS);
      actionTimerRef.current = setTimeout(() => {
        playAction(pickRandomAction(), scheduleNext);
      }, delay);
    };
    scheduleNext();
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      if (actionStepRef.current) clearTimeout(actionStepRef.current);
    };
  }, []);

  const playAction = (action: Action, onDone: () => void) => {
    let i = 0;
    patch({ inAction: true });
    const step = () => {
      if (i >= action.frames.length) {
        // restore idle baseline
        const frames = MOOD_FRAMES[moodRef.current] ?? MOOD_FRAMES.awake;
        patch({
          face: frames[0],
          saying: sayingRef.current,
          particles: MOOD_PARTICLES[moodRef.current],
          inAction: false,
        });
        onDone();
        return;
      }
      const f = action.frames[i++];
      patch({
        face: f.face,
        saying: f.saying ?? '',
        particles: f.particles ?? null,
      });
      actionStepRef.current = setTimeout(step, f.durationMs);
    };
    step();
  };

  return stateRef.current;
}
