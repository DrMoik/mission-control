# Maintenance Guide

This document is for new student maintainers. Read this before making feature changes.

## System overview

Mission Control is a single-page React app backed by Firebase Auth and Firestore.

At a high level:

- `src/App.jsx` owns app bootstrapping, auth-aware shell state, selected team state, permission derivation, and wires handlers into the current page.
- `src/hooks/useAuth.js` manages sign-in, sign-out, and loading the current user profile.
- `src/hooks/useFirebaseSubscriptions.js` is the main real-time read layer. It subscribes to the selected team's collections and returns normalized arrays.
- `src/domains/*/*Service.js` contains Firestore writes for specific features.
- `src/app/router/AppViewContent.jsx` decides which page component to render.
- `src/views/*.jsx` are page-level screens.

The app is intentionally simple. Keep it that way.

## How authentication works

- Firebase Auth is the source of truth for signed-in state.
- After sign-in, the app reads `users/{uid}` for platform-level profile data.
- Team membership is separate from auth. A signed-in user may belong to zero, one, or multiple teams.
- The active team is stored in local state and persisted in local storage using `SELECTED_TEAM_STORAGE_KEY`.

Important distinction:

- Auth answers "Who is this user?"
- Membership answers "What can this user do inside this team?"

## How team selection works

- `useFirebaseSubscriptions` always loads public team data and the current user's memberships.
- Once a team is selected, the hook subscribes to that team's team-scoped collections.
- `App.jsx` derives `currentTeam` and `currentMembership` from `selectedTeamId`.
- Permissions are derived from `currentMembership.role` plus platform admin status.

If a user loses access to a team, do not assume the stored team ID is valid. Always derive from current memberships.

## Firestore data model overview

The app uses mostly flat top-level collections with `teamId` fields instead of deep nested subcollections.

Common collections:

- `users`
- `teams`
- `memberships`
- `categories`
- `tasks`
- `merits`
- `meritEvents`
- `posts`
- `comments`
- `postReactions`
- `teamEvents`
- `teamSessions`
- `weeklyStatuses`
- `teamInventoryItems`
- `teamInventoryLoans`
- `teamFundingAccounts`
- `teamFundingEntries`
- `crossTeamChannels`
- `crossTeamChannelTeams`
- `crossTeamMessages`

This design is easier for students to query and reason about. The tradeoff is that every document must carry the fields needed for filtering, especially `teamId`.

## How to safely add a new feature

1. Decide whether the feature belongs to an existing domain or needs a new domain folder.
2. Add Firestore writes in `src/domains/<feature>/`.
3. Keep derived business rules in a hook or small helper, not in the JSX tree.
4. Keep the page component focused on rendering and local interaction state.
5. Add defensive handling for missing docs, missing optional fields, and loading states.
6. Update Firestore rules before shipping the UI.
7. Run `npm run build`.

Good pattern:

- view calls handler
- handler validates current auth/team state
- handler calls domain service
- Firestore subscription updates UI

## How to safely modify Firestore schemas

- Prefer additive changes over breaking changes.
- Treat existing documents as legacy-compatible unless you have migrated all of them.
- Use defaults for optional fields.
- When reading arrays or maps, assume the field might be missing.
- When changing a permission-sensitive field, update both app code and `firestore.rules`.

Example safe approach:

- Add new field
- Read it defensively with fallback
- Backfill data if needed
- Only then make it required in new writes

## Common failure cases

- `selectedTeamId` exists in local storage but the user no longer has access.
- Route expects a profile member ID but the membership is missing.
- Firestore docs are missing legacy fields such as names, category IDs, media arrays, or optional metadata.
- UI assumes `currentMembership` exists before team membership has loaded.
- Rules allow reads but deny writes, which can look like a dead button unless errors are surfaced.
- Feature code writes Firestore directly from a page component and duplicates logic.

## Debugging guide

When something breaks, check in this order:

1. Auth state: is `authUser` present?
2. Selected team: is `selectedTeamId` valid for this user?
3. Membership: does `currentMembership` exist and is it active?
4. Route state: is the route valid and does it need a member ID?
5. Firestore subscription: is the expected collection returning documents?
6. Firestore rules: is the write being denied?
7. Legacy data: is the UI assuming a field that older documents do not have?

Practical tips:

- Watch browser console errors first.
- Inspect Firestore documents directly when behavior is surprising.
- If a button appears to do nothing, suspect a rule denial or a missing guard condition.

## Where business logic should live

Put business logic in:

- domain services for writes
- hooks for shared derived behavior
- utility helpers for pure reusable calculations

Do not bury business rules inside large page components when the same rule may be needed elsewhere.

## Where Firestore access should live

Reads:

- central subscriptions in `src/hooks/useFirebaseSubscriptions.js`
- feature-specific read hooks only when truly needed

Writes:

- `src/domains/<feature>/*Service.js`

Avoid putting Firestore reads or writes directly inside view components unless it is a very small, truly local exception and there is a strong reason.

## What NOT to do

- Do not add more giant responsibilities back into `src/App.jsx`.
- Do not make page components responsible for Firestore writes.
- Do not create giant context providers to avoid passing a few props.
- Do not introduce abstract data layers that hide simple Firestore behavior.
- Do not assume every document has the latest schema.
- Do not change Firestore rules without testing the user flows they protect.
- Do not use clever generic helpers when explicit code would be easier for the next student to read.
