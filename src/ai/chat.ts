import type { Persona } from '@/personas';

/**
 * Mock for the on-device chat model.
 *
 * The prototype called `window.claude.complete(...)` with a fallback to
 * the persona's canned replies. We preserve the same shape and the same
 * fallback contract here so swapping in a real on-device runtime later
 * is a drop-in change.
 *
 * Behavior in this mock:
 *  - 80 % of the time we resolve after a short delay with a canned line
 *    chosen by the persona's system prompt + the user's text.
 *  - 20 % of the time we reject (simulating a timeout) so the screen
 *    exercises its fallback branch.
 */
export async function complete(persona: Persona, userText: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));

  if (Math.random() < 0.2) {
    throw new Error('timeout');
  }

  const text = userText.toLowerCase();
  // Pick a canned reply biased by surface keywords so it feels persona-aware.
  const idx =
    text.includes('bee') || text.includes('wasp') || text.includes('hornet')
      ? 4
      : text.includes('hover')
      ? 1
      : text.includes('photo') || text.includes('blurry')
      ? 3
      : Math.floor(Math.random() * persona.canned.length);
  return persona.canned[idx % persona.canned.length] as string;
}
