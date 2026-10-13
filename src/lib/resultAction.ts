/**
 * Result's main button. A species already caught by the model is shared, not added again (one
 * catch per species); one only ever named by the player can still be added by a fresh model
 * scan, so it starts earning XP. Opened without a scan, an uncaught species is one to hunt.
 */
export function resultAction(o: { inDex: boolean; manualOnly: boolean; fresh: boolean }): 'add' | 'share' | 'hunt' {
  if (o.inDex && !o.manualOnly) return 'share';
  if (o.fresh) return 'add';
  return o.inDex ? 'share' : 'hunt';
}
