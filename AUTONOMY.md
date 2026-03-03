AUTONOMY CONTRACT (REWRITE ALLOWED)

Goal:
Produce a working web app MVP that I can run locally and view in the browser.

Workspace-first:
- First, scan the entire workspace (file tree + package.json + existing code).
- Decide whether to salvage or rewrite. Rewrite is allowed and preferred if it is faster.

Rewrite permissions:
- You MAY rewrite large parts of the codebase.
- You MAY replace broken architecture with a clean one.
- You MUST keep the repo as a web app I can run locally.
- You MUST NOT introduce paid services or change to a different programming language without necessity.

Non-negotiables (must exist in MVP):
- Multi-tenant: each team is a tenant.
- Categories (admin-defined): Mechanics/Software/Sciences/etc.
- Category Leaders: can award merits within their category by default.
- Merits/medals: point values + evidence + immutable audit log (award and revoke with history).
- Ranks: admin-defined ladder; support global and/or per-category ranks.
- Leaderboards: tenant-wide and per-category; season + all-time.
- Travel selection: configurable top-N + constraints + deterministic tie-break.
- Learning Academy: docs/modules/videos (MVP can use simple video embedding or file upload).
- Active learning enforcement: completion requires typed retrieval prompts (not just “watched”).

Build/run rules:
- After changes, run the truth commands and fix errors until they pass.
- If blocked >10 minutes, write STATUS + ROOT CAUSE + NEXT ACTIONS.

Truth commands (must pass):
- npm run build
- npm run dev must start without crashing

Definition of Done:
- npm run build passes
- npm run dev starts
- I can open localhost and click through:
  - login (or local dev auth)
  - tenant setup
  - categories page
  - merits awarding flow
  - leaderboard page
  - academy module completion with retrieval prompt
- Provide a README with exact steps to run.
- Provide STATUS.md summarizing what was built and what remains.