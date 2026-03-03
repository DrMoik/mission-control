// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Centralised place for all static configuration values.
// Change role names, career options, or icon sets here; nothing else needs to change.

/** Ordered from lowest to highest privilege. */
export const ROLE_ORDER = [
  'aspirant', 'rookie', 'junior', 'senior', 'leader', 'facultyAdvisor', 'teamAdmin',
];

/** English display labels for each role (used in dropdowns / selects). */
export const ROLE_LABELS = {
  aspirant:      'Aspirant',
  rookie:        'Rookie',
  junior:        'Junior',
  senior:        'Senior',
  leader:        'Leader',
  facultyAdvisor:'Faculty Advisor',
  teamAdmin:     'Team Admin',
};

/** Fast numeric lookup: roleId → rank index (used for atLeast() comparisons). */
export const ROLE_RANK = Object.fromEntries(ROLE_ORDER.map((r, i) => [r, i]));

/** Roles that can assign a given logro. One per logro. */
export const ASSIGNABLE_BY_OPTIONS = ['leader', 'teamAdmin', 'facultyAdvisor'];

/** Suggested tags for collaboration fields — shown in dropdown to avoid duplicates. */
export const COLLAB_TAG_SUGGESTIONS = [
  'OpenCV', 'Python', 'C++', 'CAD', 'SolidWorks', 'Arduino', 'Raspberry Pi',
  'ROS', 'control theory', 'soldering', '3D printing', 'circuit design',
  'machine learning', 'computer vision', 'documentation', 'presentation',
  'mentoring', 'project management',
];

/** Suggested tags for logros — used for search/filter. Add custom tags via TagInput. */
export const MERIT_TAG_SUGGESTIONS = [
  'mecánica', 'software', 'diseño', 'electrónica', 'robótica',
  'liderazgo', 'colaboración', 'innovación', 'investigación',
  'comunicación', 'documentación', 'presentación',
];

/** Achievement type — for filtering 500+ logros. Leaders award only in their category. */
export const MERIT_ACHIEVEMENT_TYPES = [
  'technical', 'leadership', 'collaboration', 'innovation', 'milestone',
  'research', 'communication', 'documentation', 'presentation', 'other',
];

/** Domain — area of the achievement. */
export const MERIT_DOMAINS = [
  'software', 'hardware', 'mechanical', 'electronics', 'design',
  'research', 'general',
];

/** Tier — optional difficulty/value level. */
export const MERIT_TIERS = ['bronze', 'silver', 'gold'];

/** Career options shown in the profile editor. Empty string = "not set". */
export const CAREER_OPTIONS = [
  '',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Software Engineering',
  'Computer Science',
  'Industrial Engineering',
  'Systems Engineering',
  'Robotics',
  'Business Administration',
  'Marketing / Communications',
  'Media Production',
  'Graphic Design',
  'Physics',
  'Mathematics',
  'Chemistry',
  'Biology',
  'Education / Teaching',
  'Faculty / Research',
  'Other',
];

/** Semester / academic level options. Empty string = "not set". */
export const SEMESTER_OPTIONS = [
  '', '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', 'Graduate', 'Faculty',
];

/** Default values for a fresh membership profile. */
export const EMPTY_PROFILE = {
  bio:           '',
  hobbies:       '',
  career:        '',
  semester:      '',
  university:    '',
  coverPhotoURL: '',
};

/**
 * Emoji and symbol options for merit logos.
 * Organised into thematic groups for easier browsing.
 */
export const MERIT_ICONS = [
  // Awards & Achievement
  '🏆','🥇','🥈','🥉','🎖️','🏅','🎗️','👑','💎','⭐',
  '🌟','✨','💫','🔥','⚡','💥','🎯','🎪','🎠','🎡',
  // Tech & Engineering
  '🤖','🚀','🛸','🔬','🧬','🔭','📡','💻','🖥️','⌨️',
  '🖱️','💾','📱','🔋','💡','🔦','🔧','🔩','⚙️','🛠️',
  '🔌','🧲','📐','📏','🏗️','⚗️','🧪','🧫','🧰','🪛',
  // People & Team
  '👥','🤝','🦾','🧠','👨‍💻','👩‍💻','👨‍🔬','👩‍🔬','👨‍🏫','👩‍🏫',
  '🙌','💪','🫡','🧑‍🚀','👨‍🏭','👩‍🏭','🤓','😎','🥸','🎓',
  // Creativity & Learning
  '🎨','🖌️','✏️','📝','📚','📖','📊','📈','📉','🗂️',
  '🗃️','📌','📍','🔖','🏷️','📰','🗞️','📓','📔','📒',
  // Sports & Competition
  '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸',
  '🥊','🎿','🛷','🏋️','🤸','🧗','🏄','🚴','🏊','🎽',
  // Nature & Science
  '🌱','🌿','🍀','🌳','🦋','🐝','🌊','🌋','🌌','🌠',
  '☄️','🌤️','⛅','🌈','❄️','🔮','🪐','🌙','☀️','🌞',
  // Music & Media
  '🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎤','📢','🔔',
  // Places & Navigation
  '🏠','🏢','🏭','🗼','🗽','⛩️','🎑','🏞️','🗺️','🧭',
];
