# Mission Control — Design Proposal: Conceptual Refinements

**Date:** 2025-03-07  
**Purpose:** Refinement pass on the Phase 1 design proposal.  
**Focus:** Conceptual quality, long-term coherence, avoiding shallow gamification.

This document refines the design proposal by addressing seven concerns. It should be read alongside `DESIGN_PROPOSAL.md` and supersedes or extends the relevant sections.

---

## 1. Responsibility Ledger: Accountability Without Punishment

### Problem
The ledger must increase accountability without becoming punitive. Performance scoring and reliability metrics can easily slip into shame-based dynamics.

### Refined Conceptual Model

**Primary framing: Responsibility history and transparency, not performance scoring.**

The ledger is a **narrative of commitments**, not a scorecard. Its purpose is to make commitments visible so that:
- Members can see what they have accepted and how it progressed
- The team can understand who is responsible for what
- Blocked work is visible and discussable
- Completion is acknowledged without reducing it to a number

### What to Avoid
- Single-number "reliability score" or "performance rating"
- Red/yellow/green traffic lights on people
- Leaderboards of "most reliable" or "best performer"
- Language like "failed," "late," "overdue" as primary labels
- Comparative framing ("you vs others")

### What to Emphasize
- **History:** "Tus compromisos" — a chronological list of tasks accepted, their status, and outcome
- **Transparency:** Blocked state with reason — "Bloqueado: esperando piezas" — invites support, not blame
- **Context:** Who assigned, when, what was delivered — the story of the commitment
- **Completion:** "Entregado" with date — focus on what was done, not speed metrics

### UI Language and Indicators

| Avoid | Prefer |
|-------|--------|
| "Reliability: 85%" | "Tu historial de compromisos" |
| "On-time completion rate" | "Entregas realizadas" (list with dates) |
| "X tasks overdue" (as primary) | "Tienes X compromisos pendientes" + "Y están bloqueados" (if any) |
| "Performance indicator" | "Resumen de tus responsabilidades" |
| Red badge for overdue | Neutral "pendiente" + due date; overdue shown as "venció hace X días" (informational, not accusatory) |

### Summaries That Support Accountability Without Shame

- **"Tus compromisos este mes"** — Count of accepted, completed, in progress, blocked. No percentage.
- **"Compromisos completados"** — List with title, date delivered, who reviewed. Celebrates completion.
- **"Bloqueados"** — Separate section: "Estos compromisos están bloqueados. Si necesitas apoyo, habla con tu líder." Framed as a call for support.
- **Optional, low-prominence:** "Tiempo promedio de entrega" — only if shown as personal feedback ("Tus entregas suelen completarse en X días"), never comparative.

### Principle
The ledger answers: *What did I commit to? What happened?* It does not answer: *How do I rank?*

---

## 2. Knowledge Map: Evidence Types From the Start

### Problem
The Knowledge Map must not become only an academic badge map. It must distinguish evidence types so that "learned" (studied) is clearly different from "applied" (used in real work) and "recognized" (others affirmed it).

### Refined Conceptual Model

**Four evidence types, designed into the schema from day one:**

| Type | Meaning | Source (MVP) | Source (future) |
|------|---------|--------------|----------------|
| **learned** | Studied formally; knowledge acquired through structured learning | moduleAttempt (approved) | Retrieval quiz passed, spaced review |
| **applied** | Used in real team work; demonstrated in practice | task completed with knowledgeAreaIds | Project deliverable, peer observation |
| **recognized** | Others affirmed this knowledge; merit or explicit recognition | meritEvent (merit has knowledgeAreaIds) | Peer endorsement, admin assignment |
| **inferred** | Strong signal from combination; not directly attested | learned + recognized in same area | learned + applied, etc. |

### Schema and Architecture

**Evidence must carry evidence type.** Even when derived, the derivation logic outputs typed evidence.

**Option A: Derived with explicit type** — `useKnowledgeMap` returns:
```javascript
evidence: [
  { membershipId, knowledgeAreaId, type: 'learned', source: 'moduleAttempt', sourceId, ... },
  { membershipId, knowledgeAreaId, type: 'recognized', source: 'meritEvent', sourceId, ... },
  { membershipId, knowledgeAreaId, type: 'applied', source: 'task', sourceId, ... },
  { membershipId, knowledgeAreaId, type: 'inferred', source: 'derived', from: ['learned','recognized'] }
]
```

**Option B: Persisted evidence collection** — If we add `knowledgeEvidence` later:
```javascript
{ teamId, membershipId, knowledgeAreaId, evidenceType: 'learned'|'applied'|'recognized'|'inferred', sourceType, sourceId, createdAt }
```

**Recommendation:** Schema supports both. MVP: derive with explicit type in the hook. No persistence. Future: if manual evidence or admin override is needed, add `knowledgeEvidence` with `evidenceType` as required field. The four types are part of the schema from the start.

### MVP: "Applied" Partially Implemented

- **Tasks** get `knowledgeAreaIds` in the schema from Phase 1.
- **When a task is completed** (status → completed) and has `knowledgeAreaIds`, the system derives **applied** evidence for each assignee in those areas.
- **MVP scope:** Teams may not tag all tasks with areas initially. Applied evidence will be sparse at first. That is acceptable — the model and UI are ready.
- **UI:** Knowledge Map shows evidence with type badges: "Aprendido" (learned), "Aplicado" (applied), "Reconocido" (recognized), "Inferido" (inferred). Filter by type. Profile: "En ROS: aprendido (módulo X), aplicado (tarea Y), reconocido (logro Z)."

### UI Reflection of Evidence Types

- **Knowledge Map view:** "¿Quién sabe ROS?" — List members with evidence. Each row: name, evidence types (icons or labels: 📚 learned, 🔧 applied, 🏆 recognized, 🔗 inferred). Click to see sources.
- **Profile:** "Conocimientos" section — Group by area. Under each area: "Aprendido en Módulo X", "Aplicado en Tarea Y", "Reconocido por logro Z". Never collapse to a single "knows ROS" badge.
- **Search:** "Who has applied knowledge in X?" — Filter by type: applied. "Who has studied X?" — Filter by type: learned.

### Principle
The Knowledge Map answers: *Who has learned what? Who has applied it? Who has been recognized for it?* It is not a badge collection; it is an evidence-based view of knowledge with provenance.

---

## 3. Merit Families: Single vs Multi-Family

### The Question
Is `familyId` (single) only an MVP simplification, or should merits permanently belong to one family?

### Comparison

| Aspect | Single family (familyId) | Multi-family (familyIds[]) |
|--------|--------------------------|----------------------------|
| **Semantic clarity** | Each merit has one primary meaning | Merit can span multiple families |
| **Path inference** | Simple: count merits per family | Richer: merit can signal multiple paths |
| **Real-world fit** | Some merits are clearly one thing (e.g. "Liderazgo en equipo") | Some merits span (e.g. "Mentor técnico" → technical + mentor) |
| **Admin burden** | One choice per merit | Multiple choices; risk of "everything" |
| **Analytics** | Clean family distribution | More nuanced; harder to aggregate |
| **Contribution path** | One family → one path signal | One merit → multiple path signals |

### Recommendation: **Multi-Family for Long-Term Coherence**

**Rationale:**
- Merits in the real world often reflect blended contributions. "Documentó el proceso y enseñó al equipo" is both documentation and community/mentor.
- Contribution paths are not mutually exclusive. A member can be both Technical Specialist and Mentor. Multi-family merits support that.
- Single-family forces a false choice. Admins will pick "primary" arbitrarily; we lose information.
- Path inference benefits from multi-family: a merit can strengthen both "technical" and "mentor" signals.

**Implementation:**
- **Schema:** `familyIds: string[]` on merits (not `familyId`). Empty = unclassified.
- **MVP:** Allow one family initially in the UI (single-select) for simplicity. Store as `familyIds: [id]`. Schema supports multiple from day one.
- **Phase 2:** Add multi-select in merit edit. Migration: `familyId` → `familyIds: [familyId]` if we shipped single first.
- **Path inference:** When aggregating, a merit with `familyIds: ['technical','mentor']` adds weight to both paths. No double-counting of points; we count *pattern*, not volume.

### Principle
Merits describe contribution. Contribution is often multifaceted. The schema should not force a single facet.

---

## 4. Contribution Path Discovery: Patterns, Not Points

### Problem
Path inference must be based on **patterns of contribution**, not raw volume or point accumulation. Otherwise it becomes another leaderboard.

### What to Avoid
- Summing points per path
- "You are 60% Technical Specialist" as a score
- Path as a single label
- More activity → higher path score
- Gamified "unlock your path" framing

### Refined Model: Pattern-Based Inference

**Core idea:** Path is inferred from *how* and *what* someone contributes, not *how much*.

### Weighting Dimensions

| Dimension | What it captures | How to use (not volume) |
|------------|------------------|-------------------------|
| **Diversity of evidence** | Breadth of contribution types | Presence across families, session types, roles — not count. "Has evidence in technical, leadership, and community" vs "Has 50 technical merits." |
| **Consistency over time** | Steady participation | Weekly status streak, session attendance pattern — regularity matters more than total count. |
| **Type of contribution** | What kind of work | Merit families, not points. "Receives recognition in leadership" vs "Has 200 leadership points." |
| **Role in tasks** | Assignee vs assigner | Assigner ratio signals coordination/leadership. Assignee-only signals execution. Both signals integrator. |
| **Session participation** | What sessions they attend | Study sessions vs build vs social — pattern of participation type, not attendance count. |
| **Knowledge evidence** | Learned vs applied vs recognized | Applied + recognized in same area = practitioner. Learned only = student. Recognized only = affirmed by others. |
| **Leadership vs specialist vs mentor vs community** | Distinct signals | Leadership: assigner role, leadership merits. Specialist: technical merits, applied knowledge. Mentor: teaching merits, session types. Community: social sessions, community merits. |

### Inference Logic (Conceptual)

1. **No single score.** Output is a **profile** of tendencies: "Tus contribuciones sugieren fortalezas en: integración de sistemas, mentoría, documentación."
2. **Evidence over volume.** One strong "applied + recognized" in an area beats ten "learned" only.
3. **Role matters.** Tasks as assigner → coordination signal. Tasks as assignee with high applied knowledge → specialist signal.
4. **Session type matters.** Build + study → technical. Social + community sessions → community builder. Mix → integrator.
5. **Diversity bonus.** Someone with evidence in 3–4 families is likely an integrator. Someone with deep evidence in one is likely a specialist.
6. **Consistency over spikes.** Regular weekly status + regular session attendance > one burst of activity.

### Anti-Patterns to Avoid
- Do not sum points per path.
- Do not output "Path: Technical Specialist (0.72)" — use qualitative language.
- Do not rank paths. Show as "Tendencias" or "Patrones de contribución."
- Do not make path a badge or achievement. It is reflective, not prescriptive.

### UI Framing
- "Patrones en tu contribución" — "Tus logros, tareas y participación sugieren que contribuyes especialmente en..."
- "Descubre cómo contribuyes" — Exploratory, not definitive.
- List 2–3 tendencies with brief evidence: "Integración: has coordinado tareas y conectado áreas."
- Optional: "Otras áreas donde podrías explorar" — based on team needs, not deficit framing.

### Principle
Contribution path answers: *What patterns do I see in how I contribute?* It does not answer: *How much have I contributed?* or *What is my rank?*

---

## 5. Community Sessions: Types of Synchronous Participation

### Problem
Sessions should recognize not only work, but also study, belonging, and recovery. Different session types have different meanings for the community and for path inference.

### Refined Session Classification Model

**Session classes (by purpose):**

| Class | Purpose | Examples | Recognition / path |
|-------|---------|----------|--------------------|
| **Work** | Productive output | Build sessions, debugging nights | Merit for attendance optional; strong path signal (technical, coordination) |
| **Learning** | Study and skill development | Study groups, reading groups | Merit optional; learning/mentor path signal |
| **Belonging** | Community and connection | Social sessions, team dinners | Merit typically not; community builder path signal |
| **Recovery** | Rest and balance | Blow-off-steam, games, casual hangout | Merit typically not; signals healthy participation, not productivity pressure |

### Schema: Session Class

Add to `teamSessions`:
- `sessionClass: 'work' | 'learning' | 'belonging' | 'recovery'`

`sessionType` (build, homework, study, etc.) remains for granularity. `sessionClass` is the semantic grouping.

### How Different Classes Affect Recognition

| Class | Merit on attendance? | Path inference |
|-------|----------------------|----------------|
| **Work** | Often yes — participation in productive sessions | Technical, project leader, integrator |
| **Learning** | Optional — study groups may or may not award | Learning, mentor (if leading), specialist |
| **Belonging** | Usually no — social is its own reward | Community builder |
| **Recovery** | No — recovery should not be gamified | Participation diversity; avoids burnout signal |

**Principle:** Not all participation should earn points. Belonging and recovery are valuable for the community but should not be turned into merit-earning activities. The system recognizes them for path inference (e.g. "attends social sessions" → community builder tendency) without attaching points.

### UI and Admin
- When creating a session: choose class (work, learning, belonging, recovery) and type (build, study, social, etc.).
- Class determines default for "Merit on attendance" — work: optional; learning: optional; belonging/recovery: default off, with note "La participación social y de recuperación suele no otorgar puntos."
- Path inference uses class: work sessions → work-related paths; belonging → community; recovery → participation diversity (not productivity).

### Principle
Sessions serve the whole person: work, learning, belonging, recovery. The system should not treat all participation as productivity to be rewarded with points.

---

## 6. Academy: Toward Uncommon Sense Teaching

### Problem
The Academy architecture is weak relative to retrieval practice, spaced reinforcement, and application in real work. The design should explain how learning–project integration evolves to reflect these principles.

### Principles from Uncommon Sense Teaching (and similar)

1. **Retrieval practice** — Testing recall strengthens memory more than re-reading.
2. **Spaced reinforcement** — Revisiting material over time improves retention.
3. **Application** — Using knowledge in real tasks transfers learning from inert to active.

### Current Gap
- Modules have content; no retrieval question.
- No spaced review.
- No explicit link between module completion and task application.

### Refined Learning–Project Integration (Evolution Path)

**Phase 1 (MVP):** Link modules to tasks and knowledge areas. Show "Related tasks" and "Related modules." Module approval contributes to knowledge evidence (learned). Task completion with knowledge areas contributes (applied). This establishes the **application** connection.

**Phase 2: Retrieval practice**
- Add `retrievalQuestion: { en, es }` to modules (or per topic).
- On "Request review," user must answer the retrieval question before submitting.
- Response stored in `moduleAttempts.retrievalResponse`.
- Approval evaluates both completion and retrieval response. No automatic pass without retrieval.
- **Schema:** `modules.retrievalQuestion`, `moduleAttempts.retrievalResponse`, `moduleAttempts.retrievalCorrect` (optional, if we auto-check).

**Phase 3: Spaced reinforcement**
- Add `moduleAttempts.reviewedAt` — when user last reviewed this module (optional "Repasar" flow).
- Or: new `spacedReviews` — user can request a spaced review of a module N weeks after approval. Creates a lightweight "recall check" that updates knowledge evidence strength.
- **Schema:** Either extend moduleAttempts or add `spacedReviews` collection. Evidence type could become "learned (reinforced)" after spaced review.

**Phase 4: Application feedback loop**
- When a task with `knowledgeAreaIds` is completed, optionally prompt: "¿Este trabajo aplicó lo que aprendiste en [módulo X]?" — link task to module.
- Store `tasks.appliedModuleIds` or similar. Strengthens "applied" evidence and connects learning to practice explicitly.
- Contribution path: "Applied knowledge from Module X in Task Y" — visible link.

### How This Reflects the Principles

| Principle | Current | Phase 2 | Phase 3 | Phase 4 |
|-----------|---------|---------|---------|---------|
| Retrieval | None | Retrieval question before approval | — | — |
| Spaced | None | — | Spaced review flow | — |
| Application | Weak link | relatedTaskIds, knowledgeAreaIds | — | Explicit "applied from module" link |

### What Not to Do Yet
- Full redesign of Academy (e.g. adaptive spacing, full curriculum).
- Complex retrieval (e.g. multiple choice, auto-grading) — start with free-text response, mentor evaluates.
- Over-engineer: keep Phase 1 minimal; Phase 2–4 are evolution path, not immediate scope.

### Principle
Learning–project integration should make the path from "studied" to "applied" visible and reinforce retrieval and spacing over time. The schema and architecture should allow this evolution without rework.

---

## 7. Product Philosophy Review

### What Parts Best Support Strong Bounded Communities?

| Feature | How it supports bounded community |
|---------|-----------------------------------|
| **Sessions (especially belonging/recovery)** | Synchronous gatherings create shared experience. Belonging and recovery classes signal that the team values connection and balance, not only output. |
| **Knowledge Map** | "Who knows what" enables within-team help. Members find each other. Reduces dependence on external search. |
| **Responsibility Ledger (non-punitive)** | Transparency builds trust. Blocked state invites support. History of commitments reinforces "we deliver together." |
| **Contribution Path Discovery** | Surfaces diverse roles — specialist, mentor, community builder. Reduces pressure to conform to one ladder. |
| **Merit Families** | Semantic structure helps the team articulate what they value. Shared language for recognition. |

### What Parts Risk Becoming Mere Feature Accumulation?

| Risk | Mitigation |
|------|------------|
| **Knowledge Map as badge collection** | Enforce evidence types (learned/applied/recognized/inferred) in schema and UI. Never collapse to "knows X" badge. |
| **Contribution Path as another score** | Pattern-based inference, qualitative framing, no points. Reflective, not prescriptive. |
| **Sessions as attendance tracking** | Session classes; belonging/recovery without merit. Purpose over metrics. |
| **Responsibility Ledger as performance review** | History and transparency framing. No scores, no comparison. |
| **Academy as content dump** | Evolution path: retrieval, spacing, application. Each phase ties learning to practice. |

### What Parts Most Directly Help Students Discover How They Contribute Best?

| Feature | Discovery mechanism |
|---------|---------------------|
| **Contribution Path Discovery** | Primary: infers tendencies from evidence. "Patrones en tu contribución" — reflective. |
| **Knowledge Map (evidence types)** | Shows learned vs applied vs recognized. Student sees: "I've studied X, applied it in Y, been recognized for Z." Clarifies growth path. |
| **Merit Families (multi)** | Merits can signal multiple paths. Student sees recognition spread across technical, mentor, community — "I contribute in several ways." |
| **Session participation (by class)** | "You attend build sessions and social sessions" — pattern of participation type. Helps see where they show up. |
| **Task role (assignee vs assigner)** | "You often coordinate tasks" vs "You often execute" — role pattern. |
| **Responsibility history** | "Your commitments and how they progressed" — not a score, but a narrative of what they've taken on. |

### Synthesis
The features that most directly support discovery are those that **surface patterns** (path, evidence types, session class, task role) and **avoid reduction to numbers** (no path score, no reliability score, no badge count). The design refinements above push each feature toward pattern and narrative, and away from scoring and accumulation.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-03-07 | Initial refinements |

---

**Integration with DESIGN_PROPOSAL.md:** These refinements supersede or extend the corresponding sections. When implementing:
- Responsibility Ledger: use history/transparency framing, avoid scores
- Knowledge Map: implement four evidence types from the start; add task.knowledgeAreaIds for applied
- Merit Families: use familyIds[] in schema; MVP can use single-select UI
- Contribution Path: pattern-based inference, qualitative output, no point accumulation
- Sessions: add sessionClass; different treatment for work/learning/belonging/recovery
- Academy: design for retrieval and spacing evolution; Phase 1 establishes application links
