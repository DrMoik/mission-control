# Stabilization Plan — mission-control

**Date:** 2025-03-07  
**Goal:** Reduce maintenance pain and error hotspots without feature expansion.

---

## Step 1 — Error Triage Summary

### High priority
| Issue | File | Risk |
|-------|------|------|
| `handleViewProfile` no guard | App.jsx ~1606 | `membership` undefined → `/profile/undefined` crash |
| `tend.evidence` direct access | ProfilePageView.jsx 767–773 | If `evidence` missing → crash when expanding |

### Medium priority
| Issue | File | Risk |
|-------|------|------|
| `task.knowledgeAreaIds` legacy | useKnowledgeMap.js 71 | Legacy tasks without field → optional chaining |
| Module attempts for non-admins | useFirebaseSubscriptions.js 209–229 | Incomplete learned evidence for other members (design decision) |

### Low priority
| Issue | Notes |
|------|-------|
| Legacy `assigneeMembershipIds` | Already handled across codebase |
| Legacy `familyIds` / `knowledgeAreaIds` on merits | Handled with `\|\| []` |
| Empty arrays in hooks | Default params handle |

---

## Step 2 — Stabilization Plan

### Batch 1: Defensive guards (immediate fixes) ✅
- [x] Add `if (!membership?.id) return;` before `navigate` in `handleViewProfile`
- [x] Add optional chaining for `ev` in ProfilePageView contribution path: `ev?.meritEventIds`, `ev?.taskIds`, `ev?.moduleIds`

**Test:** Click profile from members list; expand contribution path evidence; verify no crash.

### Batch 2: Legacy field safety (small refactors)
- [ ] useKnowledgeMap: `task.knowledgeAreaIds ?? []` for legacy tasks
- [ ] Review AcademyView `mod` null check (low risk if mod always from list)

**Test:** View Knowledge Map with legacy tasks; view profile with legacy merit data.

### Batch 3: Data completeness (design decision)
- [ ] Document: non-admins see incomplete learned evidence for other members
- [ ] Option: extend moduleAttempts for admins only (future)

**Test:** Manual regression on profile + knowledge map for different roles.

### Manual regression checks (after each batch)
1. **Auth flow:** Sign in, sign out, team picker
2. **Profile:** Own profile, view other member, edit profile, contribution path expand
3. **Knowledge Map:** View with evidence, view empty
4. **Navigation:** All nav items, breadcrumbs, profile links
5. **Tasks:** Create, assign, complete, grade (legacy + multi-assignee)
6. **Merits:** Create, award, view (legacy families)

---

## Step 3 — Implementation

Batch 1 implemented. See Step 4 summary.
