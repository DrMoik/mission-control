## STATUS

### What was rewritten

- Replaced the previous Firebase-dependent `App.jsx` with a **clean React single-page application** that uses browser `localStorage` as its data layer.
- Implemented a simple but explicit **multi-tenant model** with tenants, memberships, and tenant-scoped entities (categories, merits, merit events, modules, travel selections).
- Removed the old Quantum-specific UI/logic in favor of a neutral, minimal admin console focused on:
  - Tenants
  - Categories and roles
  - Merits and immutable audit log
  - Leaderboards
  - Travel selection
  - Learning academy module completion with retrieval prompts

### What works (MVP checklist)

- **Build & dev**
  - `npm install`
  - `npm run build` passes.
  - `npm run dev` starts a Vite dev server successfully.

- **User flows**
  - Local dev login (name + email, no password).
  - Tenant setup:
    - Create a new tenant.
    - Automatically become Admin for that tenant.
    - Seed default categories (Mechanics, Software, Sciences) and a default onboarding module.
  - Categories:
    - Admin can create additional categories.
    - Admin can assign member roles (Admin, Category Leader, Member).
    - Admin can assign a primary category to each member.
  - Merits:
    - Admin can define merits with:
      - Name
      - Point value
      - Optional category restriction.
    - Admin and Category Leaders can award merits (leaders only within their category).
    - Each award writes an immutable `meritEvents` record.
    - Admin can revoke an award; this appends a **negative-points event** instead of deleting the original.
  - Leaderboards:
    - Season (last 3 months) and all-time leaderboards per tenant.
    - Ranks (Recruit, Specialist, Veteran, Leader) derived from total points.
  - Travel selection:
    - Admin config: Top N and minimum season points.
    - Preview selection computed from season leaderboard.
    - Deterministic tie-breaker by member name.
    - Selection can be saved as a `travelSelections` record.
  - Learning Academy:
    - Each tenant has at least one module.
    - Members must type a non-empty retrieval response to mark a module complete.
    - Completion is stored in `moduleAttempts` with timestamp and answer.

### Known limitations

- **Local-only data**
  - All data is stored in `localStorage` and is specific to one browser and device.
  - There is no backend, authentication provider, or multi-user real-time sync.

- **Multi-tenant scope**
  - Multi-tenancy is modeled logically (every record has `tenantId`), but there is no server-side enforcement beyond that since everything is client-side.

- **RBAC simplicity**
  - Roles are coarse:
    - `admin`: full rights within tenant.
    - `leader`: can award merits within their category.
    - `member`: read-only for most administrative actions.
  - No fine-grained permission editor UI beyond these defaults.

- **Rank ladders**
  - Only a single global ladder (points → rank) is implemented.
  - Per-category ladders are not yet modeled separately.

- **Travel constraints**
  - Supports top-N with a minimum points threshold and deterministic tie-breaking.
  - Does not yet support advanced constraints (e.g., min/max per category, attendance).

- **Academy features**
  - Modules are seeded per-tenant at creation; there is no in-app module editor yet.
  - Spaced repetition reminders, peer-teaching prompts, and richer learning-science features are not yet implemented.

### Next improvements

- **Data layer and multi-user support**
  - Option 1: Introduce a backend (e.g., hosted database/API) while keeping the same front-end data model.
  - Option 2: Keep a “demo mode” in localStorage and add an optional remote sync mode.

- **Configurable rank ladders**
  - Allow tenants to define their own rank ladders (names, thresholds).
  - Introduce optional per-category ladders and UI to manage them.

- **Advanced travel selection**
  - Add per-category min/max constraints and a small inspector UI that explains why each user was included or excluded.

- **Academy editor & learning science**
  - Tenant Admin UI to add/edit modules, content, and retrieval prompts.
  - Support for multiple sections per module and more structured prompts (summary, muddiest point, peer explanation).
  - Basic spaced-review scheduler that surfaces quick retrieval checks over time.

- **Better onboarding and UX polish**
  - Simple guided “first-run” wizard for new tenants.
  - Clearer visuals for ranks and category leaders.
