// ─── NAVIGATION CONFIG ────────────────────────────────────────────────────────
// Domain structure for sidebar and mobile nav. Two levels, except the
// "Administración" domain, whose items are themselves groups (Ingeniería /
// Operación / Plataforma) so engineering, business/ops, and platform-config
// tools stay visually separated without becoming three separate top-level
// domains. A domain item is a *group* when it has its own `items` array;
// everything else is a leaf that maps to a real view id.

import {
  LayoutDashboard, Rss, Grid, Users, Trophy, Award, Calendar, CalendarDays, Wrench,
  GraduationCap, Wallet, CheckSquare, Settings, MessagesSquare, Map, Package, ClipboardList,
  Cog, Landmark, ShieldCheck, Handshake, Truck,
} from 'lucide-react';

/** Navigation domain structure. */
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
  // Administración: one top-level domain, three internal groups so
  // engineering content never mixes with business/operations content.
  {
    id: 'administracion',
    labelKey: 'nav_domain_admin',
    Icon: Settings,
    items: [
      {
        id: 'admin_engineering',
        labelKey: 'nav_domain_admin_engineering',
        Icon: Cog,
        items: [
          { id: 'bom', labelKey: 'nav_bom', Icon: ClipboardList, access: 'member' },
          { id: 'inventory', labelKey: 'nav_inventory', Icon: Package, access: 'member' },
        ],
      },
      {
        id: 'admin_operations',
        labelKey: 'nav_domain_admin_operations',
        Icon: Landmark,
        items: [
          { id: 'funding', labelKey: 'nav_funding', Icon: Wallet, access: 'member' },
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
    ],
  },
];

/** True when a domain-item entry is a group (has its own sub-items) rather than a leaf view. */
export const isGroup = (entry) => Array.isArray(entry.items);

/** Map view id → top-level domain id for sidebar expansion (recurses into groups). */
export const VIEW_TO_DOMAIN = {};
NAV_DOMAINS.forEach((d) => {
  const visit = (entries) => entries.forEach((entry) => {
    if (isGroup(entry)) { visit(entry.items); return; }
    VIEW_TO_DOMAIN[entry.id] = d.id;
  });
  visit(d.items);
});
