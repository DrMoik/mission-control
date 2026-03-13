// ─── NAVIGATION CONFIG ────────────────────────────────────────────────────────
// Domain structure for sidebar and mobile nav. Two levels only.

import {
  LayoutDashboard, Rss, Grid, Users, Trophy, Award, Calendar, CalendarDays, Wrench,
  GraduationCap, Wallet, CheckSquare, Settings, MessagesSquare, Map, Package,
} from 'lucide-react';

/** Navigation domain structure (two levels only). */
export const NAV_DOMAINS = [
  {
    id: 'comunidad',
    labelKey: 'nav_domain_comunidad',
    Icon: Users,
    items: [
      { id: 'overview', labelKey: 'nav_overview', Icon: LayoutDashboard },
      { id: 'feed', labelKey: 'nav_feed', Icon: Rss },
      { id: 'channels', labelKey: 'nav_channels', Icon: MessagesSquare, access: 'leader' },
      { id: 'categories', labelKey: 'nav_categories', Icon: Grid },
      { id: 'members', labelKey: 'nav_members', Icon: Users },
      { id: 'sessions', labelKey: 'nav_sessions', Icon: CalendarDays },
      { id: 'hr', labelKey: 'nav_hr', Icon: MessagesSquare },
    ],
  },
  {
    id: 'trabajo',
    labelKey: 'nav_domain_trabajo',
    Icon: CheckSquare,
    items: [
      { id: 'tasks', labelKey: 'nav_tasks', Icon: CheckSquare },
      { id: 'calendar', labelKey: 'nav_calendar', Icon: Calendar },
      { id: 'tools', labelKey: 'nav_tools', Icon: Wrench },
    ],
  },
  {
    id: 'aprendizaje',
    labelKey: 'nav_domain_aprendizaje',
    Icon: GraduationCap,
    items: [
      { id: 'academy', labelKey: 'nav_academy', Icon: GraduationCap },
      { id: 'mapa', labelKey: 'nav_knowledge_map', Icon: Map },
    ],
  },
  {
    id: 'reconocimiento',
    labelKey: 'nav_domain_reconocimiento',
    Icon: Trophy,
    items: [
      { id: 'merits', labelKey: 'nav_merits', Icon: Trophy },
      { id: 'leaderboard', labelKey: 'nav_leaderboard', Icon: Award },
    ],
  },
  {
    id: 'admin_group',
    labelKey: 'nav_domain_admin',
    Icon: Settings,
    items: [
      { id: 'inventory', labelKey: 'nav_inventory', Icon: Package, access: 'member' },
      { id: 'funding', labelKey: 'nav_funding', Icon: Wallet, access: 'leader' },
      { id: 'admin', labelKey: 'nav_admin', Icon: Settings, access: 'admin' },
    ],
  },
];

/** Map view id → domain id for sidebar expansion. */
export const VIEW_TO_DOMAIN = {};
NAV_DOMAINS.forEach((d) => {
  d.items.forEach((it) => { VIEW_TO_DOMAIN[it.id] = d.id; });
});
