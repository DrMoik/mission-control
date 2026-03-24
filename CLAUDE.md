# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server
npm run build            # Production build (GitHub Pages, base = /mission-control/)
npm run build:firebase   # Production build (Firebase Hosting, base = /)
npm run deploy:firebase  # Build + deploy to Firebase Hosting
npm run lint             # ESLint
npm run test             # Vitest (Node environment, files matching **/*.test.js)
```

Run `npm run build` before finishing any change to catch build errors.

## Architecture

**Mission Control** is a team coordination platform for a university robotics team. React 19 + Firebase (Auth + Firestore), Tailwind CSS, React Router 7 (HashRouter), Vite build.

### Data flow

```
App.jsx
  ├── useAuth                         → auth state, sign-in/out
  ├── useFirebaseSubscriptions        → all real-time Firestore reads (onSnapshot)
  ├── derived permissions             → boolean flags (canEdit, canAward, etc.)
  ├── feature handlers                → useTaskHandlers, useMeritHandlers, useSessionHandlers, …
  └── AppViewContent (router)         → lazy-loads one of 22 view components
```

`App.jsx` is the single owner of all shared state. There is no Context API or global store — state is prop-drilled to `AppViewContent`, which passes view-specific slices to each page.

### Routing

Hash-based (`/#/view-name`). `src/app/router/routeState.js` parses the URL into `{ view, profileMemberId }`. `AppViewContent.jsx` lazy-loads the matching view. Invalid routes redirect to `/inicio`.

### Firestore

- Flat top-level collections; every document carries `teamId` for filtering.
- **Reads:** `src/hooks/useFirebaseSubscriptions.js` — subscribes to all collections; returns normalized arrays.
- **Writes:** `src/domains/<feature>/<feature>Service.js` — explicit arguments, predictable document shapes, called from handlers in `App.jsx`.
- Client-side permission flags are UX only; `firestore.rules` is the actual security boundary.

### Permissions

Derived in `App.jsx` from `userProfile.platformRole` and `currentMembership.role`. Role hierarchy (low → high): `rookie → junior → senior → leader → teamAdmin → facultyAdvisor`. Helper `atLeast(role, target)` for comparisons. Preview mode lets admins simulate roles.

### Key files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Root: auth, subscriptions, permissions, handlers, shell UI |
| `src/app/router/AppViewContent.jsx` | Maps view name → lazy-loaded view component |
| `src/hooks/useFirebaseSubscriptions.js` | All Firestore real-time reads |
| `src/domains/` | Firestore write services (feed, hr, channels) |
| `src/constants.js` | Static lookup tables (roles, careers, merit domains) |
| `src/strings.js` | Spanish UI strings and `t()` helper |
| `src/utils.js` | Pure helpers (rankOf, tsToDate, date math, compression) |
| `src/config/navigation.js` | Sidebar structure and view-to-domain mapping |
| `firestore.rules` | Firestore security rules |

### Conventions

- New Firestore writes go in `src/domains/<feature>/`, not in components or views.
- Handlers (functions passed to views) live in `App.jsx` or dedicated `use*Handlers` hooks.
- Add defensive fallbacks for optional/legacy Firestore fields — documents may be missing fields added after initial schema.
- Views are full-page screens in `src/views/`; shared UI primitives are in `src/components/`.
- `src/components/layout/` — Card, Section, PageContainer.
- `src/components/ui/` — Buttons, inputs, avatars, badges, modals.
