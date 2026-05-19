import { useAppStore } from '@/store/useAppStore';
import type { RouteName, RouteParamMap } from '@/navigation/routes';

/**
 * Replacement for the prototype's `useNav()` context.
 *
 * The prototype packed nav helpers + global state into a single object
 * passed around via React context. We keep the same surface but back it
 * with Zustand so any screen can poke navigation without prop drilling
 * or wrapping in a provider.
 */
export type NavApi = {
  go: <R extends RouteName>(name: R, params?: RouteParamMap[R]) => void;
  back: () => void;
};

export function useNav(): NavApi {
  const go = useAppStore((s) => s.go);
  const back = useAppStore((s) => s.back);
  return { go, back };
}
