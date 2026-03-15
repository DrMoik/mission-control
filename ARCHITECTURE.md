# Architecture

Mission Control is organized around a small number of practical layers.

## Folder structure

```text
src/
  app/
    router/      route parsing and page rendering
  components/
    layout/      reusable layout primitives
    ui/          reusable low-level UI elements
  config/        navigation and static config
  domains/       Firestore write services grouped by feature
  hooks/         auth, subscriptions, and feature handlers
  services/      shared infrastructure wrappers
  views/         page-level screens
  utils/         feature helpers
  App.jsx        app shell and state wiring
```

## Directory roles

- `app/router`: keeps route parsing and the page switch out of `App.jsx`
- `components`: shared visual building blocks
- `config`: navigation maps and static definitions
- `domains`: the main place for Firestore mutations
- `hooks`: long-lived subscriptions and feature-specific action helpers
- `services`: Firebase client wrappers and shared infrastructure
- `views`: top-level screens for feed, tasks, members, admin, and so on

## Domain separation philosophy

Separate by feature, not by technical theory.

Examples:

- feed logic belongs under `domains/feed`
- HR logic belongs under `domains/hr`
- channel messaging logic belongs under `domains/channels`

The goal is that a maintainer can find the Firestore write path for a feature quickly.

## How routing works

- URL parsing lives in `src/app/router/routeState.js`
- `App.jsx` reads the current location and derives `view` and optional `profileMemberId`
- `AppViewContent.jsx` lazy-loads and renders the matching page
- `App.jsx` still owns permission redirects because permissions depend on live team state

## Where hooks live

Hooks in `src/hooks` should do one of these jobs:

- manage app/session state
- subscribe to Firestore
- bundle repeated domain logic around a feature

Hooks should not become hidden controllers for half the app.

## Where UI components live

- `src/components/ui`: buttons, inputs, avatars, display helpers
- `src/components/layout`: card, section, page container primitives
- `src/views`: full pages with feature-specific composition

If a component is only used in one screen and is not generally reusable, keeping it close to that screen is usually fine.

## Where Firestore services live

Firestore write logic belongs in `src/domains/<feature>/<feature>Service.js`.

These services should:

- accept explicit arguments
- validate required inputs
- write predictable document shapes
- stay small and readable

Do not build a generic repository layer unless the codebase truly needs it.

## How permissions are handled

Permissions are derived in `App.jsx` from:

- `userProfile.platformRole`
- `currentMembership.role`
- selected team context

Those booleans are then passed to pages as props.

Firestore rules remain the final source of truth. Client-side permission checks are for user experience, not security.

## How derived logic works

Derived values such as:

- current membership
- selected team
- leaderboard data
- role-based capabilities

should be computed in one place and passed down, instead of re-derived inconsistently in many screens.

Keep derived logic:

- near `App.jsx` when it affects many features
- in hooks when it is feature-specific
- in utility functions when it is pure and reusable
