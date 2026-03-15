export const VALID_VIEWS = new Set([
  'inicio',
  'overview',
  'feed',
  'channels',
  'categories',
  'members',
  'merits',
  'leaderboard',
  'calendar',
  'tools',
  'academy',
  'funding',
  'inventory',
  'tasks',
  'sessions',
  'mapa',
  'hr',
  'myprofile',
  'profile',
  'admin',
]);

export function getRouteState(pathname) {
  const normalizedPath = String(pathname || '/').replace(/^\/+|\/+$/g, '') || 'inicio';
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const routeView = pathParts[0] || 'inicio';
  const profileMemberId = routeView === 'profile' && pathParts[1] ? pathParts[1] : null;
  const view = routeView === 'profile' && !profileMemberId
    ? 'myprofile'
    : (routeView === 'profile' ? 'profile' : routeView);

  return {
    routeView,
    view,
    profileMemberId,
    isViewValid: VALID_VIEWS.has(view),
  };
}
