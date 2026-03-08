# Tipo (achievementTypes) Removal Plan

**Goal:** Deprecate Tipo; use "Familia de mérito" (meritFamilies / familyIds) as the only canonical semantic classification for merits.

---

## Audit Summary

| Location | Usage | Action |
|----------|-------|--------|
| **AdminView** | "Tipos de logro" section, domains save passes achievementTypes | Remove types section; change domains save to domains-only |
| **App.jsx** | meritAchievementTypes, handleSaveTeamMeritTags, handleCreateTeam seed, MeritsView prop | Remove; change handler to domains-only; stop seeding; remove prop |
| **MeritsView** | achievementTypes prop, filters (meritTypeFilters, gridTypeFilters), create/edit form, search, display | Replace with meritFamilies; filter by familyIds; remove tipo from forms; display family names |
| **useMeritHandlers** | handleCreateMerit, handleUpdateMerit, handleRecoverMerit write achievementTypes | New merits: write []; updates: omit (keep legacy); recover: already [] |
| **constants.js** | MERIT_ACHIEVEMENT_TYPES | Remove export after all usages removed |
| **PlatformConfigSection** | achievementTypes | Not used in App; leave as-is (out of scope) |
| **contributionPathRules** | Uses familyIds only | No change |
| **HR suggestion merit event** | achievementTypes: ['creatividad'] | Leave (event metadata, not merit classification) |

---

## Implementation Order

1. AdminView: Remove types section; change domains save
2. App.jsx: handleSaveTeamMeritTags(domains); remove meritAchievementTypes; handleCreateTeam
3. MeritsView: Replace tipo with familia (filters, forms, display, search)
4. useMeritHandlers: handleCreateMerit write []; handleUpdateMerit omit from updates when not in payload
5. constants.js: Remove MERIT_ACHIEVEMENT_TYPES (or mark deprecated)

---

## Legacy Compatibility

- **Read:** `(m.achievementTypes || [])` — no longer used for UI; legacy docs keep the field
- **Write:** New merits get `achievementTypes: []`; updates omit it (preserve existing)
- **Display:** Use `(m.familyIds || []).map(...).join(', ')`; legacy merits with no familyIds show nothing
- **Filter:** Use familyIds; legacy merits without familyIds only appear when no family filter selected

---

## Firestore Migration

**Not required for this change.** Old documents keep achievementTypes; we simply stop using it. A later optional migration could delete the field from merits/teams to reduce storage — low priority.

---

## Implementation Summary

### What was removed
- AdminView: "Tipos de logro" section (entire UI block)
- MeritsView: achievementTypes prop, meritTypeFilters, gridTypeFilters
- MeritsView: Tipo row from create form, Tipo row from edit form
- MeritsView: Tipo filter dropdowns (replaced with Familia filter using meritFamilies)
- MeritsView: Display of achievementTypes on merit cards (replaced with family names from familyIds)
- App.jsx: meritAchievementTypes, achievementTypes in handleCreateTeam seed
- handleSaveTeamMeritTags: now (domains) only; no longer writes achievementTypes to team

### What remains as legacy compatibility
- **constants.js:** MERIT_ACHIEVEMENT_TYPES kept (deprecated) for PlatformConfigSection
- **PlatformConfigSection:** Still uses achievementTypes (component not used in App; dead code)
- **useMeritHandlers:** handleCreateMerit still accepts and writes achievementTypes: [] for new merits
- **useMeritHandlers:** handleUpdateMerit keeps merit.achievementTypes when updates omit it
- **Firestore:** Old merits/teams keep achievementTypes field; we do not delete it
- **HR suggestion merit event:** achievementTypes: ['creatividad'] unchanged (event metadata)

### Firestore cleanup migration
**Optional, low priority.** To reduce storage, a later script could:
- Remove `achievementTypes` from teams documents
- Remove `achievementTypes` from merits documents

Not recommended until all clients are updated and no legacy readers remain.
