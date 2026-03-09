// ─── Achievement badge tier styling ─────────────────────────────────────────
// Visual tiers: bronze, silver, gold, platinum, legendary.
// Maps tier IDs (e.g. bronce, plata, oro) to frame, glow, and text styles.

/** @type {Record<string, { frame: string; glow: string; ring: string; label: string }>} */
export const ACHIEVEMENT_TIER_STYLES = {
  bronce: {
    frame: 'from-amber-900/80 to-amber-950/90',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-600/60',
    label: 'text-amber-400',
  },
  bronze: {
    frame: 'from-amber-900/80 to-amber-950/90',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-600/60',
    label: 'text-amber-400',
  },
  plata: {
    frame: 'from-slate-400/30 to-slate-600/50',
    glow: 'shadow-slate-400/25',
    ring: 'ring-slate-500/50',
    label: 'text-slate-300',
  },
  silver: {
    frame: 'from-slate-400/30 to-slate-600/50',
    glow: 'shadow-slate-400/25',
    ring: 'ring-slate-500/50',
    label: 'text-slate-300',
  },
  oro: {
    frame: 'from-amber-400/40 to-amber-600/60',
    glow: 'shadow-amber-400/30',
    ring: 'ring-amber-500/70',
    label: 'text-amber-300',
  },
  gold: {
    frame: 'from-amber-400/40 to-amber-600/60',
    glow: 'shadow-amber-400/30',
    ring: 'ring-amber-500/70',
    label: 'text-amber-300',
  },
  platinum: {
    frame: 'from-cyan-400/30 to-slate-500/60',
    glow: 'shadow-cyan-400/25',
    ring: 'ring-cyan-400/50',
    label: 'text-cyan-300',
  },
  legendary: {
    frame: 'from-purple-500/40 to-amber-600/50',
    glow: 'shadow-purple-500/35',
    ring: 'ring-purple-400/60',
    label: 'text-purple-300',
  },
};

const DEFAULT_TIER = {
  frame: 'from-slate-600/40 to-slate-800/60',
  glow: 'shadow-slate-500/15',
  ring: 'ring-slate-600/40',
  label: 'text-slate-400',
};

export function getTierStyles(tier) {
  const key = (tier || '').toLowerCase().trim();
  return ACHIEVEMENT_TIER_STYLES[key] || DEFAULT_TIER;
}
