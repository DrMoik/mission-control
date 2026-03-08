# Mission Control — Updated Implementation Plan

**Date:** 2025-03-07  
**Incorporates:** Final refinements, Firebase free-tier constraints, strict MVP boundary.

---

## Scale Calibration (~150 users total)

Expected scale is small (at most ~150 users, ~10–50 per team). Implications:

- **Client-side derived logic** for Knowledge Map and Contribution Path is acceptable and preferred.
- **Lightweight team-scoped queries** are sufficient; no need for cross-team aggregation.
- **Avoid realtime listeners** on rarely-used views (consider one-time `getDocs` for HR, Admin sub-tabs).
- **No persisted computed summaries** — derive on the client.
- **Storage minimal** — prefer external links over uploads for session artifacts.
- **Optimize for simplicity and low Firebase usage**, not enterprise-scale complexity.

This does not change the architecture; it reinforces the lean choices already in the plan.

---

## Firebase Free-Tier Constraints

| Constraint | Implementation approach |
|------------|--------------------------|
| Conservative reads/writes | No fan-out writes; no duplicated computed summaries; derived data client-side |
| Minimize realtime listeners | Add only essential subscriptions (teamSessions); batch reads where possible |
| Avoid heavy storage | Session artifacts = external URLs only; no file uploads |
| Prefer derived over persisted | Knowledge evidence, contribution path, reliability indicators — all derived |
| Lean schema | Minimal fields; no media-heavy patterns |

---

## Final Refinements Incorporated

| Refinement | Plan |
|------------|------|
| **Knowledge Map** | Schema and hook support four types (learned, applied, recognized, inferred). Inferred not shown in MVP UI. Architecture ready. |
| **Contribution Path** | Single `contributionPathRules.js` (or similar) — centralized evidence mappings, heuristics. UI shows "Por qué" + evidence links. |
| **Sessions** | Separate collection; `scheduledAt`, `durationMinutes` from start; lean; artifactUrls = external links only; schema allows future calendar integration |
| **Applied knowledge** | Lightweight tagging: task create/edit gets simple multi-select for knowledgeAreaIds (reuse team's knowledgeAreas). Quick to tag. |
| **Responsibility Ledger** | History + transparency only. No scores, rankings, or punitive metrics. |

---

## Implementation Order

### Phase 0: Foundation
1. Fix task Firestore rules for `assigneeMembershipIds`
2. Extract task handlers → `useTaskHandlers`
3. Extract merit handlers → `useMeritHandlers`
4. Add module attempt approval (rules + handler + UI)

### Phase 1: Responsibility Ledger
- Add `blocked`, `blockedReason`, `blockedAt` to tasks
- UI: blocked state, history view (no scores)

### Phase 2: Community Sessions
- `teamSessions` + attendance; sessionClass, sessionType; scheduledAt, durationMinutes
- **Attendance:** Lightweight subcollection (not plain array) — preserves timestamps, recorder identity, extensibility. Batch save = full overwrite (all active members); cleaner than delta.
- **Artifacts:** artifactUrls[] = external links only; no uploads, no Storage.
- **Navigation:** Sesiones as top-level nav for discoverability. Can later group under "Community" or Calendar if nav grows.

### Phase 3: Merit Families + Knowledge Areas
- teams.meritFamilies, teams.knowledgeAreas
- merits.familyIds[], merits.knowledgeAreaIds[]
- modules.knowledgeAreaIds[], tasks.knowledgeAreaIds[]
- Admin UI; lightweight task tagging

### Phase 4: Knowledge Map
- useKnowledgeMap: learned, applied, recognized (inferred in logic, not shown in MVP UI)
- Four types in schema; display learned/applied/recognized

### Phase 5: Contribution Path
- contributionPathRules.js — centralized
- useContributionPath with evidenceByTendency
- UI: tendencies + "Por qué" + "Ver evidencia"

---

## Firebase Cost Notes

| Feature | Potential cost | Lean option |
|---------|----------------|-------------|
| teamSessions subscription | +1 listener per team | Single query; no subcollection listener until viewing session detail |
| Attendance | Subcollection writes | Batch on "Save attendance"; no per-member realtime |
| Knowledge evidence | Derived only | No new collection; no writes |
| Contribution path | Derived only | No new collection; no writes |
| Session artifacts | Could use Storage | External URLs only; zero Storage |

---

## Phase 0 Detail

| Step | Description | Files |
|------|-------------|-------|
| 0.1 | Fix tasks Firestore rules | firestore.rules, FIREBASE_SETUP.md |
| 0.2 | Create useTaskHandlers hook | src/hooks/useTaskHandlers.js |
| 0.3 | Create useMeritHandlers hook | src/hooks/useMeritHandlers.js |
| 0.4 | Wire hooks into App.jsx; remove inline handlers | src/App.jsx |
| 0.5 | Module attempt approval: Firestore rules | firestore.rules |
| 0.6 | Module attempt approval: handler + UI | src/App.jsx, src/views/AcademyView.jsx |

---

## Phase 0 Status

| Step | Status |
|------|--------|
| 0.1 Fix tasks Firestore rules | Done |
| 0.2 useTaskHandlers hook | Done |
| 0.3 useMeritHandlers hook | Done |
| 0.4 Wire hooks into App.jsx | Done |
| 0.5 Module attempt approval (rules) | Done |
| 0.6 Module attempt approval (handler + UI) | Done |

**Phase 0 complete.**

### Phase 1 Status: Responsibility Ledger MVP

| Step | Status |
|------|--------|
| Add blocked/blockedReason/blockedAt to tasks | Done |
| useTaskHandlers: handleSetBlocked, handleUnblockTask | Done |
| TasksView: blocked state UI, set/unset blocked | Done |
| Tu historial de compromisos (responsibility history) | Done |

**Phase 1 complete.**

### Phase 2 Status: Community Sessions MVP

| Step | Status |
|------|--------|
| Firestore rules (teamSessions + attendance subcollection) | Done |
| teamSessions subscription + useSessionHandlers | Done |
| SessionsView: list, create, edit, delete, attendance | Done |
| Sessions nav + routing | Done |

**Phase 2 complete.**

### Phase 3 Status: Merit Families + Knowledge Areas MVP

| Step | Status |
|------|--------|
| teams.meritFamilies, teams.knowledgeAreas | Done |
| merits.familyIds[], merits.knowledgeAreaIds[] | Done |
| modules.knowledgeAreaIds[], tasks.knowledgeAreaIds[] | Done |
| Admin UI (merit families + knowledge areas) | Done |
| MeritsView: create/edit forms with families + areas | Done |
| AcademyView: module create/edit with knowledge areas | Done |
| TasksView: assigner/admin knowledge area tagging | Done |
| FIREBASE_SETUP.md schema docs | Done |

**Phase 3 complete.**

### Phase 4 Status: Knowledge Map MVP

| Step | Status |
|------|--------|
| useKnowledgeMap hook (learned, applied, recognized, inferred) | Done |
| KnowledgeMapView with evidence types, inspectable sources | Done |
| Nav + routing (mapa) | Done |
| No persisted summaries; all client-side derived | Done |

**Phase 4 complete.**

### Phase 5 Status: Contribution Path MVP

| Step | Status |
|------|--------|
| contributionPathRules.js (refined rules, explicit selection) | Done |
| useContributionPath hook | Done |
| ProfilePageView: ContributionPathSection (tendencies + "Por qué" + evidence) | Done |
| Evidence links: merit modal, /tasks, /academy only | Done |
| Strings (path_*) | Done |

**Phase 5 complete.**
