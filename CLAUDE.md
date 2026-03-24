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


## UI System (Critical)

All UI must follow a premium, minimal, high-consistency design system.

Claude must not directly generate or modify UI without first evaluating structure, hierarchy, and proportions.

---

### Philosophy

- Premium = restraint, not decoration
- Structure before styling
- Hierarchy before color
- Composition before components
- Motion must clarify, not decorate
- Avoid clutter and visual noise
- Components must feel cohesive across the entire app
- No emoji-based design
- No generic dashboard templates

---

### UI Enforcement Protocol (Mandatory)

For any UI-related task, Claude MUST follow:

1. DIAGNOSE  
2. CRITIQUE  
3. REDESIGN  
4. IMPLEMENT  

Skipping steps is not allowed.

---

### 1. DIAGNOSE

Briefly identify:

- Primary focal element (or absence of one)
- Hierarchy clarity (what is seen first, second, third)
- Layout and proportion issues (uniform cards, weak dominance, poor spacing)
- Typography hierarchy issues
- Surface inconsistency (too many styles, borders, shadows)
- Motion gaps (missing or meaningless transitions)

---

### 2. CRITIQUE

If issues exist:

- State them explicitly
- Explain why they reduce perceived quality
- Identify whether the issue is structural (layout/hierarchy) or cosmetic

Do not accept weak UI silently.

---

### 3. REDESIGN

Before coding:

- Define primary vs secondary sections
- Adjust layout proportions (introduce dominance and contrast in size/spacing)
- Reduce or merge unnecessary components
- Introduce visual rhythm (contrast between dense and sparse areas)
- Decide where motion is needed and where it is not

Structural fixes take priority over styling.

---

### 4. IMPLEMENT

- Use PageContainer → Section → Card hierarchy
- Reuse primitives from `src/components/layout/` and `src/components/ui/`
- Do not introduce new UI patterns without justification
- Keep components modular and reusable
- Maintain consistent spacing scale: 4 / 8 / 12 / 16 / 24 / 32

---

### FINAL CHECK (Required)

Reject output if:

- No clear focal point exists
- Layout feels flat or overly uniform
- Spacing is inconsistent
- Components compete equally for attention
- UI looks generic or template-like
- Motion is absent where state changes occur

Revise before returning.

---

### Layout Rules

- Avoid grids where all elements have equal weight
- Introduce dominant sections (size, spacing, or position)
- Ensure clear reading flow across the screen
- Use negative space intentionally to create breathing room

---

### Components

- Reuse primitives; do not duplicate patterns
- Badges must feel like achievements, not labels
- Leaderboards must emphasize rank and hierarchy clearly
- Profiles must balance identity richness with structure
- Avoid component inflation (too many cards, panels, or nested elements)

---

### Styling (Tailwind)

- Prefer subtle borders over heavy shadows
- Shadows only for elevation, not decoration
- Use rounded-2xl for primary containers, rounded-xl for secondary
- Avoid excessive colors; rely on contrast and typography
- Avoid gradients unless structurally justified

---

### Interaction and Motion

- Motion must communicate state change, focus, or hierarchy
- Hover: subtle elevation or scale only
- Transitions: 150–200ms, ease-out
- Avoid exaggerated or decorative animation
- Do not animate everything — only meaningful elements

---

### Anti-patterns (Forbidden)

Do not attempt to improve UI by:

- Adding gradients without structural changes
- Adding more colors instead of fixing hierarchy
- Increasing shadows arbitrarily
- Adding more components instead of simplifying
- Making all cards visually similar
- Overusing borders, badges, or icons

Fix structure first, styling second.

---

### Critical Behavior

If a requested UI is:

- cluttered  
- inconsistent  
- visually noisy  
- structurally weak  
- lacking hierarchy  

Claude MUST:

1. Explain the problem clearly  
2. Propose a stronger layout/composition  
3. Implement the improved version  

Do not comply passively with poor design decisions.