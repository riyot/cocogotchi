import { useEffect, useState } from 'react';

import type { EspEvent, EspStatus } from '@/services/esp';
import { espService } from '@/services/esp-router';

const MAX_EVENTS = 20;

export function useEsp() {
  const [status, setStatus] = useState<EspStatus>(() => espService.getStatus());
  const [recentEvents, setRecentEvents] = useState<EspEvent[]>([]);

  useEffect(() => {
    espService.start();
    const unsub = espService.subscribe((event) => {
      if (event.type === 'tick') {
        setStatus(event.status);
        return;
      }
      setRecentEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
    });
    return () => {
      unsub();
    };
  }, []);

  return { status, recentEvents };
}
