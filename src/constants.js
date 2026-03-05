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

/** Sugerencias de colaboración — shown in profile dropdown. Defaults in Spanish. */
export const COLLAB_TAG_SUGGESTIONS = [
  'OpenCV', 'Python', 'C++', 'CAD', 'SolidWorks', 'Arduino', 'Raspberry Pi',
  'ROS', 'teoría de control', 'soldadura', 'impresión 3D', 'diseño de circuitos',
  'aprendizaje automático', 'visión por computadora', 'documentación', 'presentación',
  'mentoría', 'gestión de proyectos', 'diseño mecánico', 'electrónica', 'programación',
  'diseño industrial', 'prototipado', 'ensamblaje', 'pruebas', 'investigación',
  'comunicación', 'documentación técnica', 'trabajo en equipo',
];

/** Admin default placeholders (Spanish). */
export const ADMIN_PLACEHOLDERS = {
  careers:    'Ingeniería Mecánica, Informática, Robótica, …',
  semesters:  '1º, 2º, 3º, Posgrado, Docente, …',
  personality:'clave: texto mostrado\nptag_creative: Creativo/a\nptag_analytical: Analítico/a\nptag_solver: Resolvedor de problemas\nptag_mentor: Mentor/a',
  collab:     'OpenCV, Python, CAD, soldadura, impresión 3D, mentoría, documentación, …',
  types:      'técnico, liderazgo, colaboración, innovación, hito, …',
  domains:    'software, hardware, mecánica, electrónica, diseño, investigación, …',
  tiers:      'bronce, plata, oro',
};

/** Suggested tags for logros — used for search/filter. Add custom tags via TagInput. */
export const MERIT_TAG_SUGGESTIONS = [
  'mecánica', 'software', 'diseño', 'electrónica', 'robótica',
  'liderazgo', 'colaboración', 'innovación', 'investigación',
  'comunicación', 'documentación', 'presentación',
];

/** Achievement type — for filtering 500+ logros. Leaders award only in their category. Defaults in Spanish. */
export const MERIT_ACHIEVEMENT_TYPES = [
  'técnico', 'liderazgo', 'colaboración', 'innovación', 'hito',
  'investigación', 'comunicación', 'documentación', 'presentación', 'otro',
];

/** Domain — area of the achievement. Defaults in Spanish. */
export const MERIT_DOMAINS = [
  'software', 'hardware', 'mecánica', 'electrónica', 'diseño',
  'investigación', 'general',
];

/** Tier — optional difficulty/value level. Defaults in Spanish. */
export const MERIT_TIERS = ['bronce', 'plata', 'oro'];

/** Career options shown in the profile editor. Empty string = "not set". Defaults in Spanish. */
export const CAREER_OPTIONS = [
  '',
  'Ingeniería Mecánica',
  'Ingeniería Eléctrica',
  'Ingeniería de Software',
  'Ciencias de la Computación',
  'Ingeniería Industrial',
  'Ingeniería de Sistemas',
  'Robótica',
  'Administración de Empresas',
  'Marketing / Comunicaciones',
  'Producción de Medios',
  'Diseño Gráfico',
  'Física',
  'Matemáticas',
  'Química',
  'Biología',
  'Educación / Docencia',
  'Facultad / Investigación',
  'Otro',
];

/** Semester / academic level options. Empty string = "not set". Defaults in Spanish. */
export const SEMESTER_OPTIONS = [
  '', '1º', '2º', '3º', '4º', '5º', '6º',
  '7º', '8º', '9º', '10º', 'Posgrado', 'Docente',
];

/** Personality tags: { key: displayLabel }. Admins can override per team. Defaults in Spanish. */
export const PERSONALITY_TAGS_DEFAULT = {
  ptag_creative:     'Creativo/a',
  ptag_analytical:   'Analítico/a',
  ptag_detail:       'Orientado/a al detalle',
  ptag_bigpicture:   'Pensamiento global',
  ptag_solver:       'Resolvedor de problemas',
  ptag_collaborator: 'Colaborador/a',
  ptag_independent:  'Trabajo independiente',
  ptag_mentor:       'Mentor/a',
  ptag_learner:      'Aprendiz de por vida',
  ptag_builder:      'Constructor/a',
  ptag_researcher:   'Investigador/a',
};

/** Legacy: array of keys for backward compatibility when team has old format. */
export const PERSONALITY_TAGS = Object.keys(PERSONALITY_TAGS_DEFAULT);

/** Default values for a fresh membership profile. */
export const EMPTY_PROFILE = {
  bio:           '',
  birthdate:     '',
  hobbies:       '',
  career:        '',
  semester:      '',
  university:    '',
  coverPhotoURL: '',
  whatIListenTo:       [],
  bookThatMarkedMe:   [],
  ideaThatMotivatesMe:[],
  quoteThatMovesMe:   [],
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

/** Task review grades (assigner rates completed work). Points configurable in Admin. */
export const TASK_GRADES = ['ok', 'good', 'excellent', 'perfect'];

/** Default points per grade when task is individual (1 assignee). Admin can override. */
export const TASK_GRADE_POINTS_INDIVIDUAL_DEFAULT = { ok: 5, good: 10, excellent: 15, perfect: 20 };

/** Default points per assignee when task is team (2+ assignees). Admin can override. */
export const TASK_GRADE_POINTS_TEAM_DEFAULT = { ok: 2, good: 4, excellent: 7, perfect: 10 };

/** System merit points (auto-awards). Admin can override. Retroactive on save. */
export const SYSTEM_MERIT_POINTS_DEFAULT = {
  weeklyUpdate:    25,  // Actualización semanal
  profileComplete: 50,  // Perfil completo
  milestone50:     100, // 50 actualizaciones
};

/** Merit names for system auto-awards. Used for retroactive updates. */
export const SYSTEM_MERIT_NAMES = {
  weeklyUpdate:    'Actualización semanal',
  profileComplete: 'Perfil completo',
  milestone50:     '50 actualizaciones',
};
