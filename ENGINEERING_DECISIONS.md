# Mission Control — Pre-Implementation Engineering Decisions

**Date:** 2025-03-07  
**Purpose:** Resolve three final issues before coding begins.  
**Status:** Decision note — no implementation yet.

---

## 1. Explainability Model for Contribution Path Discovery

### Principle
Path suggestions must be **inspectable**. Every suggested tendency is backed by visible evidence that the user can see and verify. No opaque scores, no black-box inference.

### Structure

**Each suggested tendency includes:**
1. **Label** — e.g. "Integrador de sistemas", "Mentor", "Constructor de comunidad"
2. **Evidence summary** — 1–3 short phrases describing *why* the system suggests this
3. **Evidence links** — Clickable references to the actual data (merits, tasks, sessions, modules)

### Evidence-to-Tendency Mapping (Explicit)

| Tendency | Evidence that supports it | Example phrase |
|----------|--------------------------|----------------|
| **Technical Specialist** | Merits in technical family; tasks as assignee with applied knowledge; completed technical modules | "Logros en área técnica; aplicaste conocimientos en tareas de ROS y control" |
| **Project Leader** | Tasks as assigner; merits in leadership family | "Has coordinado X tareas; reconocimientos en liderazgo" |
| **Systems Integrator** | Evidence across multiple merit families; tasks as both assigner and assignee; diverse session types | "Contribuyes en varias áreas: técnica, documentación, coordinación" |
| **Mentor / Educator** | Merits in learning/mentor family; study sessions; module completions + teaching recognition | "Reconocimientos en mentoría; participación en sesiones de estudio" |
| **Community Builder** | Belonging/social sessions; community merits | "Participación en sesiones sociales; reconocimientos en comunidad" |
| **Researcher / Innovator** | Innovation merits; applied + recognized in emerging areas | "Reconocimientos en innovación; conocimientos aplicados y reconocidos en [área]" |

### UI Contract

**"Tu perfil de contribución" section must show:**
- Up to 3 suggested tendencies
- For each tendency:
  - **"Por qué:"** One sentence (e.g. "Has coordinado 5 tareas y recibido logros en liderazgo.")
  - **"Ver evidencia"** — Expandable or link to filtered view:
    - List of merit events (with links to merit detail)
    - List of tasks (as assigner or assignee, with links)
    - List of sessions attended (with type/class)
    - Module completions (if relevant)

**No tendency is shown without at least one linked evidence item.** If there is no evidence for a tendency, it is not suggested.

### Implementation Implication
The `useContributionPath` hook must return not only tendencies but also `evidenceByTendency: { [tendencyId]: { phrase, meritEventIds[], taskIds[], sessionIds[], moduleIds[] } }`. The UI renders both the suggestion and the evidence links.

---

## 2. Knowledge Evidence Strength Model

### Strength Hierarchy (Strongest to Weakest)

| Rank | Type | Strength | Rationale |
|------|------|----------|-----------|
| 1 | **applied** | Strongest | Demonstrated in real team work. Direct proof of capability. |
| 2 | **recognized** | Strong | Others affirmed it. Social validation. |
| 3 | **inferred** | Medium | Derived from combination (e.g. learned + recognized). Stronger than learned alone. |
| 4 | **learned** | Base | Studied formally. Necessary but not sufficient for "can do in practice." |

### Combining Evidence in the Same Area

- **Single type:** Strength = that type's rank. Display with type badge.
- **Multiple types:** Strength increases. Order of combination:
  - **learned + recognized** → inferred (medium-strong). "Studied and others affirmed."
  - **learned + applied** → strong. "Studied and used in practice."
  - **applied + recognized** → strongest. "Used in practice and others affirmed."
  - **learned + applied + recognized** → strongest. Full evidence chain.

**Inferred** is computed when we have 2+ of the above. It does not add a fourth source; it represents the combined signal.

### Effect on Display

- **Knowledge Map (who knows X):** Sort by strength when ranking members. Members with applied > recognized > inferred > learned only.
- **Profile "Conocimientos":** Group by area. Under each area, list evidence by type (applied first, then recognized, then learned). Show type badge. If multiple types exist, show combined strength indicator (e.g. "Aprendido + Aplicado + Reconocido").
- **Search "Who can help with X?":** Default filter: prefer applied and recognized. Option to include learned-only for "who has studied this?"

### Effect on Future Recommendations

- **"Who can help with this task?"** — Prefer members with **applied** or **applied + recognized** in the task's knowledge areas. Learned-only is secondary (they may know it but haven't done it).
- **"Who can mentor on X?"** — Prefer **applied + recognized** (proven practitioner) over learned-only.
- **Strength does not affect contribution path directly** — path uses evidence type as signal (e.g. "has applied knowledge" vs "has only learned"), but path inference is pattern-based, not strength-weighted.

### Implementation Implication
`useKnowledgeMap` returns evidence with `type` and computed `strength` (or `strengthRank`). When multiple types exist for same member+area, derive combined strength. UI sorts/filters by strength when relevant.

---

## 3. Strict MVP Boundary

### In Scope: First Implementation Wave

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **Phase 0: Foundation** | Fix task rules for assigneeMembershipIds; extract task + merit handlers to hooks; add module attempt approval (rules + handler + UI) | Tasks work; App.jsx smaller; Academy approval flow |
| **Phase 1: Responsibility Ledger** | Add blocked/blockedReason/blockedAt to tasks; UI to set blocked; "Tu historial de compromisos" (list, no scores); no reliability metrics | Blocked state; responsibility history view |
| **Phase 2: Community Sessions** | teamSessions + attendance; sessionClass (work/learning/belonging/recovery); sessionType; create/edit/delete; record attendance; optional merit on attendance for work/learning | Sessions exist; attendance; session classes |
| **Phase 3: Merit Families + Knowledge Areas** | teams.meritFamilies, teams.knowledgeAreas; merits.familyIds[], merits.knowledgeAreaIds[]; modules.knowledgeAreaIds[]; tasks.knowledgeAreaIds[]; Admin UI for all | Families; areas; schema ready for evidence |
| **Phase 4: Knowledge Map MVP** | useKnowledgeMap — derive learned (moduleAttempt), recognized (meritEvent), applied (task with areas); four types in schema; Knowledge Map view with type badges; Profile knowledge section with types | Evidence-based map; four types visible |
| **Phase 5: Contribution Path MVP** | useContributionPath — pattern-based; explainability (evidence links per tendency); Profile "Tu perfil de contribución" with "Por qué" + "Ver evidencia" | Path suggestions with inspectable evidence |

### Explicitly Postponed (Not in First Wave)

| Item | Reason |
|------|--------|
| **Reliability indicators** (on-time rate, avg days) | Refinement: avoid performance scoring. History only. |
| **Spaced reinforcement** (Academy) | Phase 2 Academy; not in MVP. |
| **Retrieval question** (Academy) | Phase 2 Academy; not in MVP. |
| **Manual knowledge evidence** (admin override) | Add when needed; schema supports later. |
| **Peer endorsement** (knowledge) | Future; not in MVP. |
| **"Who can help?" recommendations** | Requires Knowledge Map + UI; defer to post-MVP. |
| **Session merit auto-award** | Optional in Phase 2; can be manual at first. |
| **Contribution path persistence** | Fully derived in MVP; persist only if performance demands. |
| **Learning–project explicit links** (modules.relatedTaskIds, tasks.appliedModuleIds) | Phase 6 in original roadmap; defer. Show related tasks/modules only if schema exists; no new links in MVP. |
| **Audit log UI** | Data exists; viewer deferred. |
| **Inferred evidence computation** | Can add when learned + recognized exist; MVP can show learned, applied, recognized only. Inferred is enhancement. |

### MVP Cuts for Scope Control

- **Knowledge Map:** Implement learned, applied, recognized. **Inferred** can be Phase 4.1 (quick add) or deferred.
- **Contribution Path:** Max 3 tendencies; evidence links required. No "explore other paths" in MVP.
- **Sessions:** No recurring sessions; single-instance only. No calendar integration (sessions are separate list).
- **Academy:** Approval flow only. No retrieval, no spacing, no "applied from module" link in MVP.

---

## 4. Explicit Recommendation: What to Build First

**Order of implementation:**

1. **Phase 0** — Foundation. Non-negotiable. Fix task rules, extract handlers, add module approval. Blocks everything else.

2. **Phase 1** — Responsibility Ledger. Extends tasks; adds blocked state and history view. High impact (accountability), low risk. No new collections.

3. **Phase 2** — Community Sessions. New collection; self-contained. Delivers synchronous community. Session classes from the start.

4. **Phase 3** — Merit Families + Knowledge Areas. Schema and Admin UI. Unblocks Knowledge Map and Contribution Path.

5. **Phase 4** — Knowledge Map. Derive evidence; four types; display with strength. Unblocks "who can help" later.

6. **Phase 5** — Contribution Path. Pattern-based + explainability. Requires Phase 3 and 4 data.

**Do not start Phase 1 until Phase 0 is complete.** Do not start Phase 4 until Phase 3 is complete. Phases 1 and 2 can be parallel after Phase 0; Phases 4 and 5 are sequential after 3.

**First commit:** Phase 0.1 — Fix tasks Firestore rules for assigneeMembershipIds.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-03-07 | Initial engineering decisions |
