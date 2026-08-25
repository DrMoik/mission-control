// ─── NAVIGATION CONFIG ────────────────────────────────────────────────────────
// Domain structure for sidebar and mobile nav. Two levels only.

import {
  LayoutDashboard, Rss, Grid, Users, Trophy, Award, Calendar, CalendarDays, Wrench,
  GraduationCap, Wallet, CheckSquare, Settings, MessagesSquare, Map, Package, ClipboardList,
  Cog, Landmark, ShieldCheck, Handshake, Truck,
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
  // Administrative domains, split so engineering content never mixes with
  // business/operations content — different teams own each one.
  {
    id: 'admin_engineering',
    labelKey: 'nav_domain_admin_engineering',
    Icon: Cog,
    items: [
      { id: 'bom', labelKey: 'nav_bom', Icon: ClipboardList, access: 'member' },
    ],
  },
  {
    id: 'admin_operations',
    labelKey: 'nav_domain_admin_operations',
    Icon: Landmark,
    items: [
      { id: 'funding', labelKey: 'nav_funding', Icon: Wallet, access: 'member' },
      { id: 'inventory', labelKey: 'nav_inventory', Icon: Package, access: 'member' },
      { id: 'sponsors', labelKey: 'nav_sponsors', Icon: Handshake, access: 'member' },
      { id: 'eventLogistics', labelKey: 'nav_event_logistics', Icon: Truck, access: 'member' },
    ],
  },
  {
    id: 'admin_platform',
    labelKey: 'nav_domain_admin_platform',
    Icon: ShieldCheck,
    items: [
      { id: 'admin', labelKey: 'nav_admin', Icon: Settings, access: 'admin' },
    ],
  },
];

/** Map view id → domain id for sidebar expansion. */
export const VIEW_TO_DOMAIN = {};
NAV_DOMAINS.forEach((d) => {
  d.items.forEach((it) => { VIEW_TO_DOMAIN[it.id] = d.id; });
});
