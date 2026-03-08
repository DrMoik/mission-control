# Mission Control — Phase 1: Architecture and Design Proposal

**Date:** 2025-03-07  
**Purpose:** Structured design for the next evolution of the platform.  
**Status:** Design only — no implementation until approved.

**Refinements:** See `DESIGN_PROPOSAL_REFINEMENTS.md` for conceptual refinements.  
**Pre-implementation decisions:** See `ENGINEERING_DECISIONS.md` for explainability model, evidence strength, and strict MVP boundary.

---

## Executive Summary

This proposal addresses five major feature areas: **Responsibility Ledger**, **Community Sessions**, **Knowledge Map**, **Recognition System Evolution** (Merit Families + Contribution Path Discovery), and **Learning–Project Integration**. It also addresses foundational fixes required before safe expansion.

**Core principle:** Extend existing systems where possible; add new structures only when conceptually distinct. Preserve tenant isolation, RBAC, and auditability. Avoid overloading `App.jsx` by extracting handlers into domain-specific hooks and services.

---

## Part 1: Current-State Implications

### What the audit reveals for this evolution

1. **Tasks are the responsibility anchor** — They already represent commitments. The Responsibility Ledger should surface and enrich task data, not create a parallel commitment system. Tasks support multiple assignees; Firestore rules incorrectly use singular `assigneeMembershipId` — **must fix first**.

2. **Merit events are the recognition backbone** — All XP flows through `meritEvents`. Merit Families and Contribution Paths should layer on top of this, not replace it. The current `achievementTypes` and `domains` are loose tags; families would add semantic structure.

3. **Learning is disconnected** — `modules` and `moduleAttempts` exist but have no approval flow, no link to knowledge areas, and no connection to tasks or contribution. Learning–project integration requires fixing the Academy flow first.

4. **Calendar vs sessions** — `teamEvents` is a simple calendar (title, date, description, categoryId). Sessions need attendance, notes, optional merit, artifacts. Extending `teamEvents` with a `type` discriminator and optional session fields would work but would bloat a simple model. **Recommendation: new collection** (see Part 3).

5. **No knowledge structure** — `collabTagSuggestions` and merit `tags`/`domains` are free-form. The Knowledge Map needs team-defined knowledge areas and evidence linking members to areas. MVP can derive evidence from existing data with minimal schema addition.

6. **App.jsx is overloaded** — ~2400 lines, all handlers inline. Adding five feature areas would make it unmaintainable. **Extract handlers before major feature work.**

7. **Module attempts are immutable** — Firestore rules prevent update. Approval requires either a new collection (`moduleApprovals`) or a rules change to allow team admins to update `status`. The latter is simpler and aligns with existing patterns.

---

## Part 2: Recommended Conceptual Model

### Responsibility Ledger

**Concept:** The ledger is a **view over existing tasks**, not a new entity. It makes responsibility explicit by:

- Surfacing assignee(s), assigner, due date, status, completion timing
- Adding optional `blocked` state and `blockedReason` for transparency
- Deriving reliability indicators (e.g. on-time completion rate) from task history — **client-side derived**, not stored

**No new collections.** Extend `tasks` with:
- `blocked?: boolean`
- `blockedReason?: string`
- `blockedAt?: Timestamp`

Task status progression is already captured (`createdAt`, `requestedReviewAt`, `completedAt`). History of status changes could be added later as `taskHistory` subcollection if needed; for MVP, current timestamps suffice.

**Indicators and framing:** Primary framing is **responsibility history and transparency**, not performance scoring. Display "Tu historial de compromisos" — chronological list of commitments, status, completion. Avoid single-number scores, traffic lights, comparative language. Blocked state framed as "necesitas apoyo" not blame. See `DESIGN_PROPOSAL_REFINEMENTS.md` §1.

---

### Community Sessions

**Concept:** Synchronous gatherings with attendance and optional recognition. Distinct from one-off calendar events.

**New collection: `teamSessions`**

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | string | Required |
| `categoryId` | string \| null | Optional area scope |
| `title` | string | |
| `sessionClass` | string | work \| learning \| belonging \| recovery — semantic grouping |
| `sessionType` | string | build, homework, study, debug, reading, social, blowoff, other |
| `scheduledAt` | Timestamp | Start date/time |
| `durationMinutes` | number | Optional |
| `description` | string | Optional |
| `notes` | string | Post-session notes (editable by leaders+) |
| `artifactUrls` | string[] | Optional links |
| `meritId` | string \| null | Optional — merit to award for attendance |
| `meritPoints` | number | If meritId null, can award ad-hoc points |
| `createdBy` | string | userId |
| `createdAt` | Timestamp | |
| `lastEditedBy` | string | |
| `lastEditedAt` | Timestamp | |

**Subcollection: `teamSessions/{sessionId}/attendance`**

| Field | Type | Description |
|-------|------|-------------|
| `membershipId` | string | Doc ID = membershipId for simple upsert |
| `attended` | boolean | true = attended |
| `recordedAt` | Timestamp | |
| `recordedBy` | string | userId |

**Why not extend teamEvents?**
- Sessions have attendance, notes, artifacts, merit consequences — semantically different from "event on calendar"
- teamEvents is simple; adding optional session fields would create sparse documents and complex queries
- Sessions need their own list view, filters by type, attendance management
- Clear separation: Calendar = what's happening; Sessions = synchronous participation with evidence

---

### Knowledge Map

**Concept:** Evidence-based view of who knows what. Evidence types: learned, applied, recognized, inferred.

**MVP approach:** Derive from existing data + add minimal structure.

**Add to `teams`:**
- `knowledgeAreas?: { id: string, name: string }[]` — team-defined areas (e.g. ROS, control theory, computer vision). Stored as array on team doc, like `careerOptions`. Admin-editable.

**Add to `modules`:**
- `knowledgeAreaIds?: string[]` — which areas this module covers

**Add to `merits`:**
- `knowledgeAreaIds?: string[]` — optional; which areas this merit recognizes (many merits may leave this empty initially)

**Evidence types (schema from day one):** learned, applied, recognized, inferred. All derived evidence carries type. See `DESIGN_PROPOSAL_REFINEMENTS.md` §2.

**Evidence derivation (client-side):**

| Source | Evidence type | Logic |
|--------|---------------|-------|
| moduleAttempt (approved) | learned | User completed module; module has knowledgeAreaIds → learned for those areas |
| meritEvent (awarded) | recognized | Merit has knowledgeAreaIds → recognized for those areas |
| task (completed) | applied | Task has knowledgeAreaIds → applied for assignees in those areas (schema supports from start; may be sparse in MVP) |
| Combination | inferred | e.g. learned + recognized in same area → inferred strength |
| Admin override | (future) | Manual assignment — `knowledgeEvidence` with `evidenceType` required |

**UI:** Always show evidence with type (learned/applied/recognized/inferred). Never collapse to badge. Filter by type.

**MVP scope:** No new evidence collection. Derive from modules + merits. Add `knowledgeAreaIds` to modules and merits. If a module has no areas, it doesn't contribute to the map. Same for merits. Manual admin assignment deferred to Phase 2.

---

### Merit Families

**Concept:** Semantic groupings for analytics and path inference. More meaningful than loose achievementTypes.

**New structure: `meritFamilies` as team config**

Add to `teams`:
- `meritFamilies?: { id: string, name: string, description?: string }[]`

Suggested defaults:
- technical, leadership, collaboration, innovation, learning, reliability, documentation, communication, community

**Add to `merits`:**
- `familyIds?: string[]` — multi-family for long-term coherence. Merits can span (e.g. "Mentor técnico" → technical + mentor). MVP UI can use single-select; schema supports multiple. See `DESIGN_PROPOSAL_REFINEMENTS.md` §3.

**Migration:** Existing merits have `achievementTypes[]`. Map common values to families (e.g. "liderazgo" → leadership, "técnico" → technical). Merits without a match get `familyIds: []` until manually set. Admin UI: when editing merit, choose one or more families from team's list.

**Do not reuse achievementTypes as families:** achievementTypes are multi-select tags for filtering; familyIds are semantic classification for path inference. Keep both.

---

### Contribution Path Discovery

**Concept:** Reflective system that infers tendencies from evidence. Not a ladder; not prescriptive.

**Paths (examples):**
- Technical Specialist
- Project Leader
- Systems Integrator
- Mentor / Educator
- Community Builder
- Researcher / Innovator

**Evidence sources:**
- Merit history (by family)
- Task history (assignee vs assigner; completion rate)
- Weekly statuses (consistency)
- Session attendance
- Module progress
- Knowledge map evidence (breadth vs depth)

**Recommendation: Pattern-based, fully derived for MVP**

- **Not point accumulation.** Inference from patterns: diversity of evidence, consistency over time, type of contribution, role in tasks (assignee vs assigner), session participation type, knowledge evidence (learned vs applied vs recognized).
- Output: qualitative tendencies — "Patrones en tu contribución: integración, mentoría, documentación" — not scores.
- Weight: evidence type over volume; role (assigner vs assignee) over count; session class (work/learning/belonging/recovery) over attendance count; diversity of families over single-family depth.
- Avoid: path as score, path as single label, ranking. See `DESIGN_PROPOSAL_REFINEMENTS.md` §4.

---

### Learning–Project Integration

**Concept:** Connect learning to practice.

**Links to add:**
- `modules.knowledgeAreaIds[]` — already in Knowledge Map
- `modules.relatedTaskIds?: string[]` — optional; tasks that apply this learning
- `tasks.knowledgeAreaIds?: string[]` — optional; tasks that require/apply these areas
- `moduleAttempts` → on approval, contribute to knowledge evidence (already in Knowledge Map)

**Module approval flow (required first):**
- Firestore rules: allow team admins to update `moduleAttempts` with `status: 'approved'`, `completedAt`, `approvedBy`, `approvedAt`
- App: `handleApproveModuleAttempt(attemptId)` — only team admins
- Academy UI: list of pending attempts for admins; approve button

**Integration points:**
- Academy: show "Related tasks" when module has relatedTaskIds
- Tasks: show "Related modules" when task has knowledgeAreaIds that match modules
- Profile: contribution path considers module completion + merit families

**Evolution toward Uncommon Sense Teaching:** Phase 1 establishes application links. Future: retrieval question before approval; spaced reinforcement flow; explicit "applied from module" when completing tasks. See `DESIGN_PROPOSAL_REFINEMENTS.md` §6.

---

## Part 3: Proposed Schema Changes

### New collections

| Collection | Purpose |
|------------|---------|
| `teamSessions` | Community sessions with type, attendance, notes, optional merit |
| `teamSessions/{id}/attendance` | Attendance records (doc ID = membershipId) |

### Collection changes

| Collection | Add | Change |
|------------|-----|--------|
| `tasks` | `blocked`, `blockedReason`, `blockedAt` | — |
| `teams` | `knowledgeAreas[]`, `meritFamilies[]` | — |
| `modules` | `knowledgeAreaIds[]`, `relatedTaskIds[]` | — |
| `merits` | `familyIds[]`, `knowledgeAreaIds[]` | — |
| `tasks` | `knowledgeAreaIds[]` (optional) | — |
| `moduleAttempts` | — | Rules: allow team admin update for approval |

### Firestore rules to add/change

1. **tasks:** Fix update/delete to support `assigneeMembershipIds` — check if `request.auth.uid` matches any assignee's userId via membership lookup, or is assigner, or is team admin.
2. **teamSessions:** Create, read, update, delete — `isLeaderOrAbove` for write; `isActiveMember` for read. Attendance subcollection: leaders+ write; active members read.
3. **moduleAttempts:** Add update rule for team admins: `allow update: if isTeamAdmin(resource.data.teamId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','completedAt','approvedBy','approvedAt'])`.

---

## Part 4: UI Integration Points

| Feature | Primary UI | Secondary |
|---------|------------|-----------|
| Responsibility Ledger | TasksView (enhanced), MyCommitmentsCard | Inicio personal summary |
| Community Sessions | New "Sesiones" tab or Calendar subsection | Inicio team summary, Contribution path |
| Knowledge Map | New "Mapa de conocimiento" tab or Members subsection | Profile, Academy |
| Merit Families | MeritsView (family filter), Admin (family config) | Contribution path |
| Contribution Path | Profile page, new "Mi ruta" section in Inicio | — |
| Learning–Project | Academy (related tasks), Tasks (related modules) | Knowledge Map |

**Navigation:** Add "Sesiones" after Calendario; add "Mapa" or fold into Miembros. Contribution Path is personal — Inicio or Perfil. Avoid nav bloat: consider Sessions as Calendar sub-tab, Knowledge Map as Members sub-tab.

---

## Part 5: Security and RBAC Considerations

- **teamSessions:** Same as teamEvents — `isLeaderOrAbove` create/update/delete; `isActiveMember` read. Attendance: leaders+ write.
- **Tasks (blocked):** Same as task update — assignee, assigner, or leader+.
- **moduleAttempts update:** Team admins only; only status/approval fields.
- **knowledgeAreas, meritFamilies:** Team config; only team admins edit (same as other team options).
- **Audit:** Log session create/update, attendance bulk record, module approval. Extend `logAudit` calls.

---

## Part 6: Derived vs Persisted Logic

| Data | Persisted | Derived |
|------|-----------|---------|
| Task blocked state | ✓ tasks | — |
| Session attendance | ✓ attendance subcollection | — |
| Knowledge evidence | — | ✓ From moduleAttempts, meritEvents |
| Merit families | ✓ merits.familyIds[] | — |
| Contribution path scores | — | ✓ useContributionPath hook |
| Reliability indicators | — | ✓ From tasks |
| Knowledge Map view | — | ✓ Aggregate evidence by membership + area |

**Rationale:** Evidence and paths are computed from source of truth. Persisting would require sync logic and invalidation. Client-side derivation is acceptable for team-sized data (dozens of members, hundreds of tasks/events). If a team grows to hundreds of members, consider persisting path snapshots.

---

## Part 7: Code Organization Strategy

### Extract handlers before feature work

**Create `src/services/` or `src/hooks/`:**

1. **useTaskHandlers** — handleCreateTask, handleRequestTaskReview, handleGradeTask, handleCompleteTask, handleDeleteTask, handleSetTaskBlocked. Takes `{ currentTeam, currentMembership, canEdit, ... }`, returns handlers.
2. **useMeritHandlers** — create, update, delete, award, revoke. Same pattern.
3. **useSessionHandlers** — create, update, delete, recordAttendance.
4. **useModuleHandlers** — create, update, delete, requestReview, approveAttempt.
5. **useAudit** — logAudit, wrapped for consistent usage.

**App.jsx** becomes: compose these hooks, pass handlers to views. Handlers no longer defined inline.

**New hooks for derived data:**
- `useResponsibilityLedger(membershipId, tasks)` — reliability indicators, blocked tasks
- `useKnowledgeMap(memberships, modules, moduleAttempts, merits, meritEvents)` — evidence by member/area
- `useContributionPath(membershipId, evidence)` — path scores

---

## Part 8: Incremental Implementation Roadmap

### Phase 0: Foundation (required first)

| Step | Description | Risk |
|------|-------------|------|
| 0.1 | Fix tasks Firestore rules for `assigneeMembershipIds` | Low |
| 0.2 | Extract task handlers to `useTaskHandlers` | Medium |
| 0.3 | Extract merit handlers to `useMeritHandlers` | Medium |
| 0.4 | Add module attempt approval (rules + handler + UI) | Low |

**Deliverable:** Tasks work correctly for multi-assignee; App.jsx smaller; Academy has approval flow.

---

### Phase 1: Responsibility Ledger

| Step | Description |
|------|-------------|
| 1.1 | Add `blocked`, `blockedReason`, `blockedAt` to tasks |
| 1.2 | UI: TasksView — show blocked state, allow leaders+ to set |
| 1.3 | useResponsibilityLedger — derive reliability from task history |
| 1.4 | MyCommitmentsCard or Inicio — show "Tu historial de entregas" (on-time rate, etc.) |

**Deliverable:** Responsibility visible; blocked state; reliability indicators (non-punitive).

---

### Phase 2: Community Sessions

| Step | Description |
|------|-------------|
| 2.1 | Create `teamSessions` collection + rules |
| 2.2 | useFirebaseSubscriptions — subscribe teamSessions |
| 2.3 | useSessionHandlers — create, update, delete, recordAttendance |
| 2.4 | SessionsView or Calendar subsection — list, create, edit |
| 2.5 | Attendance UI — leaders+ mark attendance |
| 2.6 | Optional: merit on attendance (create meritEvent when recording) |

**Deliverable:** Sessions exist; attendance; optional merit for participation.

---

### Phase 3: Merit Families + Knowledge Areas

| Step | Description |
|------|-------------|
| 3.1 | Add `meritFamilies`, `knowledgeAreas` to teams (Admin UI) |
| 3.2 | Add `familyIds[]`, `knowledgeAreaIds` to merits |
| 3.3 | Add `knowledgeAreaIds` to modules |
| 3.4 | MeritsView — family filter, family selector on edit |
| 3.5 | Migration: map existing achievementTypes to families where possible |

**Deliverable:** Merit families; knowledge areas; modules linked to areas.

---

### Phase 4: Knowledge Map MVP

| Step | Description |
|------|-------------|
| 4.1 | useKnowledgeMap hook — derive evidence from moduleAttempts, meritEvents |
| 4.2 | KnowledgeMapView or Members subsection — "Who knows what" |
| 4.3 | Profile — show member's knowledge areas with evidence types |
| 4.4 | Optional: add `knowledgeAreaIds` to tasks for "applied" evidence |

**Deliverable:** Evidence-based knowledge map; queryable by area.

---

### Phase 5: Contribution Path Discovery

| Step | Description |
|------|-------------|
| 5.1 | useContributionPath hook — heuristics from merits, tasks, sessions, modules |
| 5.2 | Profile — "Tu perfil de contribución" section |
| 5.3 | Inicio — "Descubre tu ruta" or similar |
| 5.4 | Refine heuristics based on merit families, session attendance |

**Deliverable:** Reflective contribution profile; no rigid labels.

---

### Phase 6: Learning–Project Integration

| Step | Description |
|------|-------------|
| 6.1 | Add `relatedTaskIds` to modules, `knowledgeAreaIds` to tasks |
| 6.2 | Academy — show related tasks when viewing module |
| 6.3 | Tasks — show related modules when task has knowledge areas |
| 6.4 | Contribution path — factor in module completion + merit families |

**Deliverable:** Learning connected to practice; cross-links in UI.

---

## Part 9: Risks and Architectural Warnings

### Risks

1. **Client-side derivation complexity** — Contribution path and knowledge map logic can become large. Keep heuristics simple; document them; allow tuning via constants.
2. **Firestore rule complexity** — Tasks rule fix requires checking array of assignees. Firestore rules don't support iteration; need `request.auth.uid in [assignee1.userId, assignee2.userId, ...]` but we don't have userId on task — we have membershipIds. Must look up each membership. Rule may need to check: for each id in assigneeMembershipIds, get(memberships/id).userId == request.auth.uid. Firestore allows get() in rules but not loops. **Solution:** Check up to N memberships explicitly, or use a different approach: allow update if isLeaderOrAbove OR (resource.data.assigneeMembershipIds has any membership where that membership's userId == request.auth.uid). Firestore can do: `get(memberships/$(resource.data.assigneeMembershipIds[0])).data.userId == request.auth.uid` for first element, but not for arbitrary array. **Practical fix:** For multi-assignee, the rule could check the first assignee only for "is assignee" case — that would be wrong for assignee 2, 3, etc. Better: create a helper that checks if the user is any of the assignees. In Firestore rules we can't loop. We'd need something like: `resource.data.assigneeMembershipIds.hasAny([membershipPath1, membershipPath2])` — but that doesn't exist. **Actual solution:** The membership ID format is `userId_teamId`. So if we have assigneeMembershipIds = ['uid1_teamId', 'uid2_teamId'], we can check `request.auth.uid + '_' + resource.data.teamId in resource.data.assigneeMembershipIds`. That works! So the fix is: for update/delete, allow if `(request.auth.uid + '_' + resource.data.teamId) in resource.data.assigneeMembershipIds` OR assigner OR team admin. We need to handle legacy assigneeMembershipId (singular) too: `resource.data.assigneeMembershipId == request.auth.uid + '_' + resource.data.teamId`. Good.
3. **Scope creep** — Each feature can expand. Stick to MVP; defer "nice to have."
4. **Performance** — Many subscriptions already. Adding teamSessions, attendance adds more. Monitor; consider lazy loading for less critical data.

### Warnings

- **Do not** add a generic "commitment" system alongside tasks.
- **Do not** replace the merit catalog with a fixed path ladder.
- **Do not** make contribution path a single label; keep it multi-dimensional.
- **Do not** persist contribution path until derivation is proven and performance demands it.
- **Do not** add shallow gamification (badges, levels) — keep recognition tied to evidence.

---

## Part 10: Explicit Answers to Stated Questions

### Should Community Sessions extend teamEvents or be a new collection?

**New collection `teamSessions`.** Sessions have attendance, notes, artifacts, optional merit — conceptually distinct from calendar events. Extending teamEvents would create sparse documents and mixed semantics. Separate collection allows clear queries, dedicated UI, and attendance subcollection.

### Should Merit Families reuse achievementTypes or become a new normalized structure?

**New normalized structure.** Add `meritFamilies` to team config; add `familyIds[]` to merits (multi-family for long-term coherence). achievementTypes remain as multi-select tags for filtering. Migration maps common achievementTypes to families where possible.

### Should Contribution Paths be fully derived or partially persisted?

**Fully derived for MVP.** Compute in `useContributionPath` from meritEvents, tasks, weeklyStatuses, moduleAttempts, sessions. No persistence. If performance or historical trends are needed later, add `memberships.contributionPathSnapshot` updated on relevant events.

### What is the best MVP version of the Knowledge Map given the existing data model?

**Derive from modules + merits.** Add `knowledgeAreas` to teams (admin config). Add `knowledgeAreaIds` to modules and merits. Evidence: moduleAttempt approved → learned; merit awarded → recognized. No new evidence collection. Display: "Who knows X" = members with evidence in area X. Defer manual admin assignment and task→applied to Phase 2.

### What should be implemented first to maximize product impact with minimal architectural risk?

**Phase 0 (foundation) first:** Fix task rules, extract handlers, add module approval. Then **Phase 1 (Responsibility Ledger)** — it surfaces existing task data better and adds blocked state. High impact (accountability), low risk (extends tasks). **Phase 2 (Sessions)** next — new but self-contained; strengthens community.

### What parts of the current system are most reusable?

- `useFirebaseSubscriptions` — add teamSessions, attendance
- RBAC (`canEdit`, `canAward`, `canEditToolItem`) — reuse for sessions, module approval
- `logAudit` — extend for new actions
- Task handlers — extend for blocked; extract to hook
- Merit structure — add familyIds[], knowledgeAreaIds
- Module structure — add knowledgeAreaIds, relatedTaskIds
- `tsToDate`, `ensureString`, `getL` — unchanged

### What parts are too fragile and should be corrected first?

1. **Tasks Firestore rules** — assigneeMembershipId vs assigneeMembershipIds. Fix with `(request.auth.uid + '_' + teamId) in resource.data.assigneeMembershipIds`.
2. **App.jsx handler concentration** — extract to hooks before adding features.
3. **Module attempt approval** — no flow exists; required for learning integration.

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-03-07 | Design | Initial proposal |
| 1.1 | 2025-03-07 | Design | Refinements: accountability framing, evidence types, familyIds, pattern-based paths, sessionClass, Academy evolution. See DESIGN_PROPOSAL_REFINEMENTS.md. |

---

**Next step:** Review this proposal and refinements. Once approved, proceed to Phase 0 implementation.
