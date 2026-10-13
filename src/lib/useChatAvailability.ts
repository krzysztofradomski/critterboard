import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { chatAvailability, type ChatAvailability } from '@/ai/appleChat';
import { useAppStore } from '@/store/useAppStore';

/** Whether chat runs here, re-checked on return to the app (Apple Intelligence may have been turned on) and every 10 s while Apple's model downloads. */
export function useChatAvailability(): ChatAvailability {
  const language = useAppStore((s) => s.language);
  const [a, setA] = useState(() => chatAvailability(language));
  useEffect(() => {
    setA(chatAvailability(language));
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setA(chatAvailability(language));
    });
    // iOS can finish downloading Apple's model while the player waits on the gate.
    const poll = a === 'notReady' ? setInterval(() => setA(chatAvailability(language)), 10_000) : null;
    return () => {
      sub.remove();
      if (poll) clearInterval(poll);
    };
  }, [language, a]);
  return a;
}
