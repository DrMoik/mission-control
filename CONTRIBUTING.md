# Contributing

Mission Control is maintained by students. Write code that the next student can understand quickly.

## Core rules

- Do not add Firestore calls directly inside UI components when the logic belongs to a feature service.
- Use domain services for Firestore writes.
- Keep components small and focused.
- Avoid giant context providers.
- Prefer explicit code over clever abstractions.
- Add defensive fallbacks for optional and legacy Firestore fields.
- Run `npm run build` before finishing a change.

## Where to put code

- page UI: `src/views`
- shared UI: `src/components`
- Firestore writes: `src/domains`
- subscriptions and stateful app logic: `src/hooks`
- routing helpers: `src/app/router`
- pure helpers: `src/utils.js` or `src/utils/*`

## Coding style

- Prefer straightforward functions with clear parameter names.
- Keep conditionals readable.
- Avoid large "do everything" files.
- Use small helper functions when they remove duplication clearly.
- Preserve compatibility with existing Firestore documents unless you are also migrating data.
- Favor one obvious implementation over generic indirection.

## Adding a feature

1. Add or update a domain service if the feature writes to Firestore.
2. Add hook logic only if state or behavior is shared.
3. Keep the view component mostly about rendering and local interactions.
4. Update rules if permissions change.
5. Update the maintenance docs if the feature changes how the system is operated.

## Review checklist

- Is the Firestore write path outside the page component?
- Does the code handle missing auth, team, membership, or document state?
- Will old documents still render safely?
- Is the permission model still enforced by Firestore rules?
- Is this easy for another student to trace next semester?
