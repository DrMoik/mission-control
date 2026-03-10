// ─── Achievement icon registry ───────────────────────────────────────────────
// Primary: icon keys (Game-Icons) → local SVG. Fallback: emoji → icon key.
// Custom URLs (http/data:) passed through as-is.
// Icons from Game-Icons.net (CC BY 3.0) — see ASSETS_ATTRIBUTION.md

const iconModules = import.meta.glob('../assets/achievement-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Icon key → resolved URL */
const ICON_URL_MAP = {};
for (const [path, mod] of Object.entries(iconModules)) {
  const url = typeof mod === 'string' ? mod : (mod?.default ?? mod);
  const base = path.split(/[/\\]/).pop() || '';
  const key = base.replace(/\.svg$/i, '');
  if (key && url) ICON_URL_MAP[key] = url;
}

/** Preset colors for merit icon tinting. filter = CSS filter to convert white icon to this color. */
export const ACHIEVEMENT_ICON_COLORS = [
  { id: '', label: 'Por defecto', hex: null, filter: null },
  { id: 'amber', label: 'Ámbar', hex: '#f59e0b', filter: 'brightness(0) saturate(100%) invert(70%) sepia(89%) saturate(1020%) hue-rotate(357deg)' },
  { id: 'emerald', label: 'Esmeralda', hex: '#10b981', filter: 'brightness(0) saturate(100%) invert(70%) sepia(68%) saturate(1000%) hue-rotate(130deg)' },
  { id: 'cyan', label: 'Cian', hex: '#06b6d4', filter: 'brightness(0) saturate(100%) invert(72%) sepia(65%) saturate(800%) hue-rotate(165deg)' },
  { id: 'blue', label: 'Azul', hex: '#3b82f6', filter: 'brightness(0) saturate(100%) invert(55%) sepia(98%) saturate(1500%) hue-rotate(210deg)' },
  { id: 'violet', label: 'Violeta', hex: '#8b5cf6', filter: 'brightness(0) saturate(100%) invert(60%) sepia(90%) saturate(1200%) hue-rotate(250deg)' },
  { id: 'rose', label: 'Rosa', hex: '#f43f5e', filter: 'brightness(0) saturate(100%) invert(45%) sepia(95%) saturate(1500%) hue-rotate(330deg)' },
  { id: 'orange', label: 'Naranja', hex: '#f97316', filter: 'brightness(0) saturate(100%) invert(65%) sepia(92%) saturate(1100%) hue-rotate(5deg)' },
  { id: 'lime', label: 'Lima', hex: '#84cc16', filter: 'brightness(0) saturate(100%) invert(75%) sepia(85%) saturate(900%) hue-rotate(55deg)' },
  { id: 'teal', label: 'Verde azulado', hex: '#14b8a6', filter: 'brightness(0) saturate(100%) invert(72%) sepia(60%) saturate(900%) hue-rotate(155deg)' },
  { id: 'indigo', label: 'Índigo', hex: '#6366f1', filter: 'brightness(0) saturate(100%) invert(58%) sepia(88%) saturate(1200%) hue-rotate(230deg)' },
  { id: 'fuchsia', label: 'Fucsia', hex: '#d946ef', filter: 'brightness(0) saturate(100%) invert(55%) sepia(95%) saturate(1400%) hue-rotate(280deg)' },
  { id: 'slate', label: 'Pizarra', hex: '#64748b', filter: 'brightness(0) saturate(100%) invert(55%) sepia(15%) saturate(500%) hue-rotate(200deg)' },
];

/** Categories (merit families) — icons aligned to family meaning. Matches MERIT_FAMILIES_DEFAULT. */
export const ACHIEVEMENT_ICON_CATEGORIES = {
  general:       { label: 'Logros generales',                icons: ['trophy', 'medal', 'ribbon', 'crown-coin', 'star-prominences', 'star-cycle', 'gems', 'medal-skull', 'emerald', 'diamond-hard', 'sun', 'moon'] },
  technical:     { label: 'Técnico',                         icons: ['gears', 'cog', 'anvil', 'gear-hammer', 'robot-golem', 'test-tubes', 'erlenmeyer', 'molecule', 'atomic-slashes', 'arcing-bolt', 'bubbling-flask', 'compass', 'fire-ring', 'processor', 'microchip', 'ram', 'laptop', 'pc', 'database', 'keyboard'] },
  leadership:    { label: 'Liderazgo',                       icons: ['crown', 'laurel-crown', 'eagle-emblem', 'rally-the-troops', 'winged-sword', 'checked-shield', 'sword-clash'] },
  collaboration: { label: 'Colaboración',                    icons: ['all-for-one', 'paw-heart', 'conversation', 'muscle-up', 'feather'] },
  innovation:    { label: 'Innovación',                      icons: ['bulb', 'light-bulb', 'spark-spirit', 'bright-explosion', 'candle-flame', 'fireball', 'dragon-breath', 'fire-ring'] },
  learning:      { label: 'Aprendizaje',                     icons: ['open-book', 'book-cover', 'brain', 'brainstorm', 'quill', 'quill-ink', 'fountain-pen', 'owl'] },
  reliability:   { label: 'Confiabilidad',                   icons: ['checked-shield', 'energy-shield', 'bordered-shield', 'scales', 'gavel'] },
  documentation: { label: 'Documentación',                   icons: ['open-book', 'scroll-unfurled', 'quill', 'fountain-pen', 'bookmark'] },
  communication: { label: 'Comunicación',                   icons: ['conversation', 'feather', 'rally-the-troops'] },
  community:     { label: 'Comunidad',                      icons: ['rally-the-troops', 'paw-heart', 'all-for-one', 'flower-twirl', 'sprout', 'butterfly'] },
};

/** Areas (domains) — icons aligned to domain meaning. */
export const ACHIEVEMENT_ICON_AREAS = {
  mechanical_design:   { label: 'Diseño mecánico',            icons: ['gear-hammer', 'anvil', 'compass', 'claw-hammer', 'flat-hammer', 'gears'] },
  cad:                 { label: 'CAD / diseño asistido',      icons: ['compass', 'gears', 'targeting', 'anvil-impact', 'gear-hammer'] },
  manufacturing:       { label: 'Manufactura y fabricación',  icons: ['anvil', 'anvil-impact', 'gear-hammer', 'fire-axe', 'claw-hammer', 'flat-hammer'] },
  electronics:         { label: 'Electrónica',                icons: ['arcing-bolt', 'molecule', 'atomic-slashes', 'bubbling-flask'] },
  embedded_systems:    { label: 'Sistemas embebidos',         icons: ['cog', 'gears', 'robot-golem', 'arcing-bolt', 'processor', 'microchip', 'ram'] },
  power_systems:       { label: 'Sistemas de potencia',       icons: ['arcing-bolt', 'energy-shield', 'flame-spin'] },
  control:             { label: 'Control',                   icons: ['targeting', 'on-target', 'archery-target', 'target-arrows'] },
  computer_vision:     { label: 'Visión por computadora',      icons: ['targeting', 'owl', 'archery-target', 'processor', 'laptop', 'pc'] },
  autonomy_navigation: { label: 'Autonomía y navegación',      icons: ['rocket', 'compass', 'globe', 'targeting'] },
  ros:                 { label: 'ROS / middleware robótico',   icons: ['robot-golem', 'gears', 'cog'] },
  communications:      { label: 'Comunicaciones',             icons: ['conversation', 'arcing-bolt', 'feather', 'keyboard'] },
  science_mission:     { label: 'Misión científica',           icons: ['test-tubes', 'erlenmeyer', 'molecule', 'globe', 'compass', 'rocket', 'sun'] },
  manipulator:         { label: 'Manipulador / brazo robótico', icons: ['robot-golem', 'fist', 'claw-hammer', 'gear-hammer'] },
  navigation_systems:  { label: 'Sistemas de navegación',     icons: ['compass', 'globe', 'targeting'] },
  documentation:       { label: 'Documentación técnica',      icons: ['open-book', 'scroll-unfurled', 'quill', 'fountain-pen', 'bookmark', 'database'] },
  project_management:  { label: 'Gestión de proyectos',       icons: ['scales', 'gavel', 'checked-shield'] },
  testing_validation:  { label: 'Pruebas y validación',        icons: ['archery-target', 'on-target', 'checked-shield', 'targeting'] },
  systems_integration: { label: 'Integración de sistemas',     icons: ['gears', 'cog', 'energy-shield'] },
  training:            { label: 'Capacitación y formación',  icons: ['open-book', 'brain', 'owl', 'quill', 'fountain-pen'] },
};

/** Flat list of all icon keys (for backward compatibility). */
export const ACHIEVEMENT_ICON_KEYS = [
  ...new Set([
    ...Object.values(ACHIEVEMENT_ICON_CATEGORIES).flatMap((g) => g.icons),
    ...Object.values(ACHIEVEMENT_ICON_AREAS).flatMap((g) => g.icons),
    'trophy', 'medal', 'ribbon', 'crown-coin', 'medal-skull', 'star-prominences', 'star-cycle',
    'gems', 'emerald', 'diamond-hard', 'sun', 'moon', 'butterfly', 'sprout', 'sword-clash',
  ]),
];

/** Emoji → icon key (fallback for legacy data only). */
const EMOJI_FALLBACK = {
  '🏆': 'trophy', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🎖️': 'medal', '🏅': 'medal',
  '👑': 'crown', '💎': 'gems', '⭐': 'star-prominences', '🌟': 'star-cycle', '✨': 'spark-spirit',
  '💫': 'spark-spirit', '🔥': 'flame-spin', '⚡': 'arcing-bolt', '💥': 'bright-explosion',
  '🎯': 'archery-target', '🤖': 'robot-golem', '🚀': 'rocket', '💡': 'bulb', '🔬': 'test-tubes',
  '👥': 'rally-the-troops', '🤝': 'all-for-one', '🎨': 'flower-twirl', '📚': 'open-book',
  '✅': 'checked-shield', '📝': 'quill',
};

const DEFAULT_ICON = 'trophy';

/**
 * Resolve icon URL for a merit logo.
 * Primary: icon key. Fallback: emoji → icon key. Custom URLs passed through.
 * @param {string} logo - Icon key, emoji, or URL
 * @returns {{ type: 'svg' | 'url'; path: string } | null}
 */
export function resolveAchievementIcon(logo) {
  if (!logo || typeof logo !== 'string') return null;
  const trimmed = logo.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return { type: 'url', path: trimmed };
  }
  let key = trimmed;
  if (!ICON_URL_MAP[key]) {
    key = EMOJI_FALLBACK[trimmed] || DEFAULT_ICON;
  }
  const path = ICON_URL_MAP[key] || ICON_URL_MAP[DEFAULT_ICON];
  return path ? { type: 'svg', path } : null;
}

/** Get URL for an icon key (for picker preview). */
export function getIconUrl(key) {
  return ICON_URL_MAP[key] || ICON_URL_MAP[DEFAULT_ICON];
}

/** Resolve color: id → hex from preset, or pass-through hex string. Returns null for empty/invalid. */
export function resolveIconColor(colorIdOrHex) {
  if (!colorIdOrHex || typeof colorIdOrHex !== 'string') return null;
  const trimmed = colorIdOrHex.trim();
  if (trimmed.startsWith('#')) return /^#[0-9A-Fa-f]{3,8}$/.test(trimmed) ? trimmed : null;
  const preset = ACHIEVEMENT_ICON_COLORS.find((c) => c.id === trimmed);
  return preset?.hex ?? null;
}

/** Resolve CSS filter for icon tinting. Returns filter string or null. */
export function resolveIconFilter(colorIdOrHex) {
  if (!colorIdOrHex || typeof colorIdOrHex !== 'string') return null;
  const trimmed = colorIdOrHex.trim();
  const preset = ACHIEVEMENT_ICON_COLORS.find((c) => c.id === trimmed);
  return preset?.filter ?? null;
}
