// ─── Breadcrumbs ──────────────────────────────────────────────────────────────
// Shows navigation path for context and quick back-navigation.
// Format: Inicio / Domain / Section (e.g. Inicio / Comunidad / Feed)

import React from 'react';
import { t } from '../strings.js';
import { ensureString } from '../utils.js';

const VIEW_LABELS = {
  inicio:      'nav_inicio',
  overview:    'nav_overview',
  feed:        'nav_feed',
  categories:  'nav_categories',
  members:     'nav_members',
  merits:      'nav_merits',
  leaderboard: 'nav_leaderboard',
  calendar:    'nav_calendar',
  tools:       'nav_tools',
  academy:     'nav_academy',
  funding:     'nav_funding',
  tasks:       'nav_tasks',
  sessions:    'nav_sessions',
  mapa:        'nav_knowledge_map',
  hr:          'nav_hr',
  myprofile:   'nav_myprofile',
  profile:     'nav_members',
  admin:       'nav_admin',
};

const VIEW_TO_DOMAIN = {
  overview: 'comunidad', feed: 'comunidad', categories: 'comunidad', members: 'comunidad',
  sessions: 'comunidad', hr: 'comunidad',
  tasks: 'trabajo', calendar: 'trabajo', tools: 'trabajo',
  academy: 'aprendizaje', mapa: 'aprendizaje',
  merits: 'reconocimiento', leaderboard: 'reconocimiento',
  admin: 'admin_group', funding: 'admin_group',
};

const DOMAIN_LABELS = {
  comunidad: 'nav_domain_comunidad',
  trabajo: 'nav_domain_trabajo',
  aprendizaje: 'nav_domain_aprendizaje',
  reconocimiento: 'nav_domain_reconocimiento',
  admin_group: 'nav_domain_admin',
};

const DOMAIN_FIRST_VIEW = {
  comunidad: 'overview',
  trabajo: 'tasks',
  aprendizaje: 'academy',
  reconocimiento: 'merits',
  admin_group: 'admin',
};

/**
 * @param {{
 *   view: string,
 *   profileMember?: object | null,
 *   onNavigate: (viewId: string) => void,
 *   lang?: string,
 * }} props
 */
export default function Breadcrumbs({ view, profileMember = null, onNavigate, lang = 'es' }) {
  const items = [];

  if (view === 'inicio') {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: true });
  } else if (view === 'myprofile') {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    items.push({ id: 'myprofile', label: t('nav_myprofile'), isLast: true });
  } else if (view === 'profile' && profileMember) {
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    items.push({ id: 'members', label: t('nav_members'), isLast: false });
    items.push({ id: 'profile', label: ensureString(profileMember.displayName, lang), isLast: true });
  } else {
    const domainId = VIEW_TO_DOMAIN[view];
    const domainLabelKey = domainId ? DOMAIN_LABELS[domainId] : null;
    const domainFirstView = domainId ? DOMAIN_FIRST_VIEW[domainId] : null;
    const viewLabelKey = VIEW_LABELS[view];
    items.push({ id: 'inicio', label: t('nav_inicio'), isLast: false });
    if (domainLabelKey && domainFirstView) {
      items.push({ id: domainFirstView, label: t(domainLabelKey), isLast: false });
    }
    items.push({ id: view, label: viewLabelKey ? t(viewLabelKey) : view, isLast: true });
  }

  if (items.length <= 1) {
    return (
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4">
        <span className="font-medium text-slate-400">{items[0]?.label}</span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4 flex items-center gap-1.5 flex-wrap">
      {items.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-600">/</span>}
          {item.isLast ? (
            <span className="font-medium text-slate-400">{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="text-slate-500 hover:text-slate-300 hover:underline transition-colors"
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
