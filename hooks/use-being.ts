import { useCallback, useEffect, useState } from 'react';

import { beingStore } from '@/services/being-store';
import type { Being, Personality } from '@/services/being-types';

export function useBeing() {
  const [being, setBeing] = useState<Being | null>(() => beingStore.current());
  const [ready, setReady] = useState<boolean>(() => beingStore.current() !== null);

  useEffect(() => {
    let cancelled = false;
    if (!beingStore.current()) {
      beingStore.load().then((loaded) => {
        if (cancelled) return;
        setBeing(loaded);
        setReady(true);
        if (loaded) beingStore.start();
      });
    } else {
      setReady(true);
      beingStore.start();
    }
    const unsub = beingStore.subscribe(setBeing);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const birth = useCallback(async (name: string, personality: Personality) => {
    const b = await beingStore.birth(name, personality);
    beingStore.start();
    return b;
  }, []);

  const touch = useCallback(() => beingStore.touch(), []);
  const reset = useCallback(() => beingStore.reset(), []);

  return { being, ready, birth, touch, reset };
}
