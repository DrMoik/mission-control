# Mission Control — Technical Audit Report

**Date:** 2025-03-07  
**Purpose:** Structured technical summary for planning architecture changes.  
**Scope:** Codebase audit only — no implementation proposals.

---

## 1. Tech Stack

| Layer | Technology | Location / Notes |
|-------|------------|------------------|
| **Frontend framework** | React 18 + Vite | `package.json`, `vite.config.*`, `src/` |
| **Backend/services** | Firebase (client SDK only) | `src/firebase.js` — no custom backend |
| **Database** | Cloud Firestore | All data in Firestore; `teamId` on every doc for tenant scoping |
| **Auth** | Firebase Auth (Google Sign-In) | `src/firebase.js`, `src/hooks/useAuth.js` |
| **Hosting/deployment** | Firebase Hosting or GitHub Pages | `FIREBASE_SETUP.md` §8; `dist/` output |
| **State management** | React state + Firestore subscriptions | No Redux/Zustand; `useFirebaseSubscriptions` + `useState` in `App.jsx` |
| **Styling/UI** | Tailwind CSS | `tailwind.config.*`, utility classes throughout |
| **Routing** | React Router (HashRouter) | `src/main.jsx`, `App.jsx` — path-based views |
| **Supporting libraries** | `lucide-react` (icons), `react-dom` (createPortal for modals) | `package.json` |

**Important:** There is no server-side backend. All business logic runs client-side; Firestore security rules enforce permissions.

---

## 2. Current Domain Models

### Users
- **Collection:** `users/{userId}`
- **Fields:** `displayName`, `email`, `photoURL`, `platformRole` (platformAdmin)
- **Location:** `src/hooks/useAuth.js` (read/write on sign-in); `FIREBASE_SETUP.md` §4

### Teams
- **Collection:** `teams/{teamId}`
- **Fields:** `name`, `overview` (tagline, about, history, objectives, kpis), `achievementTypes`, `domains`, `meritTiers`, `careerOptions`, `semesterOptions`, `personalityTags`, `collabTagSuggestions`, `taskGradePointsIndividual`, `taskGradePointsTeam`, `systemMeritPoints`
- **Relations:** Root tenant; all other collections reference `teamId`

### Memberships
- **Collection:** `memberships/{membershipId}` — ID format: `{userId}_{teamId}` or `ghost_{timestamp}_{teamId}`
- **Fields:** `teamId`, `userId`, `displayName`, `role`, `status` (active/pending/suspended), `strikes`, `categoryId`, profile fields (bio, hobbies, career, semester, etc.), `photoURL`, `coverPhotoURL`
- **Relations:** One membership per user per team; `categoryId` → categories

### Categories (Areas)
- **Collection:** `categories/{categoryId}`
- **Fields:** `teamId`, `name`, `description`
- **Relations:** Many-to-one with team; members and merits reference `categoryId`

### Merits (Logro catalog)
- **Collection:** `merits/{meritId}`
- **Fields:** `teamId`, `name`, `points`, `categoryId`, `logo`, `shortDescription`, `longDescription`, `assignableBy`, `tags[]`, `achievementTypes[]`, `domains[]`, `tier`, `repeatable`
- **Relations:** teamId, optional categoryId

### Merit Events
- **Collection:** `meritEvents/{eventId}`
- **Fields:** `teamId`, `membershipId`, `meritId`, `meritName`, `meritLogo`, `points`, `type` (award), `evidence`, `autoAward`, `awardedByUserId`, `awardedByName`, `createdAt`, optional `taskId`, `taskGrade`, `taskCompletionScope`
- **Relations:** Links merit + membership; XP/ranking derived from sum of `points`

### Tasks
- **Collection:** `tasks/{taskId}`
- **Fields:** `teamId`, `assigneeMembershipIds[]`, `assignedByMembershipId`, `assignedByName`, `title`, `description`, `dueDate`, `status`, `grade`, `createdAt`, `completedAt`, `requestedReviewAt`, `gradedByMembershipId`
- **Relations:** Many assignees; one assigner; no `categoryId` or `areaId`

### Modules (Academy)
- **Collection:** `modules/{moduleId}`
- **Fields:** `teamId`, `title`, `description`, `topics[]` (each: `id`, `title`, `content`, `videoUrl`), `order`, `createdAt`
- **Relations:** teamId only; no skill/category linkage

### Module Attempts
- **Collection:** `moduleAttempts/{attemptId}`
- **Fields:** `teamId`, `moduleId`, `userId`, `membershipId`, `status` (requested_review / approved), `requestedAt`, `completedAt?`
- **Relations:** Links user to module; **immutable** (no update/delete in rules)
- **Note:** No UI handler to approve; status `approved` would require manual Firestore edit or future feature

### HR Suggestions (Q&S)
- **Collection:** `hrSuggestions/{suggestionId}`
- **Fields:** `teamId`, `content`, `authorId`, `authorName`, `isAnonymous`, `status` (pending/accepted/dismissed), `targetCategoryId`, `targetMembershipId`, `acceptedPoints`, `acceptedByName`, etc.
- **Relations:** teamId; on accept → merit event created

### HR Complaints
- **Collection:** `hrComplaints/{complaintId}`
- **Fields:** Similar to suggestions; non-anonymous; faculty-only read

### Audit Log
- **Collection:** `auditLog/{logId}`
- **Fields:** `teamId`, `userId`, `userName`, `action`, `targetType`, `targetId`, `details`, `createdAt`
- **Relations:** team-scoped; team admins only can read
- **Note:** Written to but **not read or displayed** anywhere in the UI

### Weekly Statuses
- **Collection:** `weeklyStatuses/{statusId}` — ID: `{membershipId}_{weekOf}`
- **Fields:** `teamId`, `membershipId`, `userId`, `displayName`, `weekOf`, `advanced`, `failedAt`, `learned`, `updatedAt`
- **Relations:** One doc per member per week; drives auto-awards (Actualización semanal, 50 actualizaciones)

### Other collections
- `posts`, `comments` — Feed
- `teamEvents` — Calendar
- `teamSwots`, `teamEisenhowers`, `teamPughs`, `teamBoards`, `teamMeetings`, `teamGoals` — Tools (all have optional `categoryId`)
- `teamFundingAccounts`, `teamFundingEntries` — Funding
- `migrations` — Lock for one-time migrations (e.g. weekly 5→25 pts)

---

## 3. Task System

### Current task fields
| Field | Type | Description |
|-------|------|-------------|
| `teamId` | string | Required |
| `assigneeMembershipIds` | string[] | **Primary** — multiple assignees supported |
| `assigneeMembershipId` | string | **Legacy** — fallback when array absent |
| `assignedByMembershipId` | string | Who assigned |
| `assignedByName` | string | Display name |
| `title` | string | |
| `description` | string | Optional |
| `dueDate` | Timestamp/Date | Optional |
| `status` | string | `pending` \| `pending_review` \| `completed` |
| `grade` | string | `ok` \| `good` \| `excellent` \| `perfect` (when completed via review) |
| `createdAt` | Timestamp | |
| `completedAt` | Timestamp | When completed |
| `requestedReviewAt` | Timestamp | When assignee requested review |
| `gradedByMembershipId` | string | Who graded (assigner) |

### Task statuses
- **pending** — Assigned, not yet completed
- **pending_review** — Assignee requested review; assigner must grade
- **completed** — Done (either direct complete or after grading)

### One vs multiple owners
- **Multiple assignees supported** via `assigneeMembershipIds[]`
- Points on grade: individual (1 assignee) vs team (2+ assignees) — different point tables in Admin

### Missing / not present
- No `categoryId` / area
- No priority
- No comments
- No change history
- No `assigneeMembershipId` in Firestore rules (rules use singular; **potential bug** for multi-assignee update/delete)

### Where task logic lives
- **Handlers:** `src/App.jsx` — `handleCreateTask`, `handleRequestTaskReview`, `handleGradeTask`, `handleCompleteTask`, `handleDeleteTask`
- **UI:** `src/views/TasksView.jsx`
- **Board integration:** `src/views/tools/BoardView.jsx`, `BoardTypeSection.jsx` — create task from card, assign card
- **Subscriptions:** `src/hooks/useFirebaseSubscriptions.js` — `tasks` where `teamId == selectedTeamId`

### Permission enforcement
- **App:** `canAssignTask(membershipId)` — admins: any; leaders: only same `categoryId` as assignee
- **Firestore:** `isLeaderOrAbove` to create; update/delete: assignee, assigner, or team admin. Rules use `resource.data.assigneeMembershipId` (singular) — **inconsistent with `assigneeMembershipIds`**; multi-assignee tasks may have permission edge cases.

---

## 4. Merits / Recognition System

### Merit (catalog) fields
| Field | Description |
|-------|-------------|
| `name` | Display name |
| `points` | Integer — awarded per event |
| `categoryId` | Optional — scopes to area; null = global |
| `logo` | Emoji/symbol |
| `shortDescription`, `longDescription` | Bilingual |
| `assignableBy` | `leader` \| `teamAdmin` \| `facultyAdvisor` |
| `tags[]`, `achievementTypes[]`, `domains[]` | Filtering/search |
| `tier` | Optional — e.g. bronce, plata, oro |
| `repeatable` | boolean — if false, one award per member |

### Points/XP
- Points come **only from merit events** (`meritEvents` with `type: 'award'`)
- Each event has `points`; leaderboard = sum per `membershipId`
- No separate XP entity; points are denormalized on each event

### Merit creation
- **Location:** `App.jsx` `handleCreateMerit`
- **Who:** Team admins always; leaders only for their `categoryId`
- **Collection:** `merits`

### Merit awarding
- **Location:** `App.jsx` `handleAwardMerit`
- **Who:** Depends on `assignableBy`; leaders restricted to own category and own-area members
- **Flow:** Create `meritEvent` with `meritId`, `meritName`, `points`, `membershipId`, etc.
- **System awards:** `handleSaveWeeklyStatus` (Actualización semanal), profile save (Perfil completo), milestone (50 actualizaciones); `handleGradeTask` (Tarea revisada); HR accept (Sugerencia implementada)

### Permissions
- **Firestore:** `isLeaderOrAbove` to award; leaders can only revoke (delete event)
- **App:** `canAward`, `canEditMerit`, `canCreateMerit` — role-based; leaders scoped to `categoryId`

### Tipo, categoría, nivel
- **Tipo (achievementTypes):** Filter dimension — e.g. técnico, liderazgo, colaboración. Stored as array on merit; used in MeritsView filters.
- **Categoría (categoryId):** Area scope — merit belongs to an area or is global. Leaders can only create/award merits in their area.
- **Nivel (tier):** Optional difficulty — bronce, plata, oro. Display/filter only; no logic.

### Where merit logic lives
- **UI:** `src/views/MeritsView.jsx` — catalog, award modal, event list, revoke
- **Handlers:** `App.jsx` — create, update, delete merit; award, revoke, edit event (platform admin only)

---

## 5. XP / Ranking / Gamification

### Data model
- **No dedicated XP/points table.** Points = sum of `meritEvents.points` per `membershipId`.
- **Leaderboard:** Computed in `App.jsx` `useMemo` from `teamMeritEvents`:
  - `allTime` — all events
  - `season` — events in last 3 months
- **Effort mode:** `LeaderboardView.jsx` — `weeklyStatuses` count + `tasks` completed × 2; not persisted, derived at render.

### Update logic
- Points change only when merit events are created/deleted/edited
- Leaderboard is **derived state** — no write; recalculated when `teamMeritEvents` changes

### XP sources
1. **Manual awards** — leaders/admins award from catalog
2. **Actualización semanal** — 25 pts (configurable) on first weekly status of week with all 3 fields
3. **Perfil completo** — 50 pts (configurable) when profile meets completion criteria
4. **50 actualizaciones** — 100 pts (configurable) at 50 weekly posts
5. **Tarea revisada** — points from grade (ok/good/excellent/perfect), individual vs team table
6. **Sugerencia implementada** — 50–200 pts on HR suggestion accept

### Where implemented
- **Leaderboard computation:** `App.jsx` lines ~314–340
- **Effort tab:** `LeaderboardView.jsx` — `useMemo` over memberships, weeklyStatuses, tasks
- **Streak:** `MyCommitmentsCard.jsx` — consecutive weeks with status; not persisted

---

## 6. Learning / Academy System

### Entities and fields
- **modules:** `teamId`, `title`, `description`, `topics[]`, `order`, `createdAt`
- **Topic:** `id`, `title`, `content`, `videoUrl` (all bilingual where applicable)
- **moduleAttempts:** `teamId`, `moduleId`, `userId`, `membershipId`, `status`, `requestedAt`, `completedAt?`

### Storage
- Modules: one doc per module; topics embedded
- Attempts: one doc per user per module; immutable after create

### Learning progress
- **Linked to:** `userId`, `membershipId`, `moduleId`, `teamId`
- **Not linked to:** skills, categories, or projects
- **Completion:** `status === 'approved'` — but **no UI to approve**; would need manual Firestore or new feature

### Retrieval question
- **Strings exist** (`retrieval_prompt`, `retrieval_ph`, `retrieval_label`) but **not used**
- AcademyView comment: "no retrieval prompt"
- Flow is: read content → "Solicitar revisión" → creates attempt with `requested_review`

### Where logic lives
- **UI:** `src/views/AcademyView.jsx`
- **Handlers:** `App.jsx` — `handleCreateModule`, `handleUpdateModule`, `handleDeleteModule`, `handleRequestModuleReview`
- **Subscriptions:** `useFirebaseSubscriptions` — modules by teamId; moduleAttempts by teamId + userId

---

## 7. Navigation and Major Screens

### Top-level sections (nav order)
| View ID | Label | Role | Description |
|---------|-------|------|-------------|
| inicio | Inicio | All | Personal dashboard: 7-day summary, My commitments, quick links |
| overview | Equipo | All | Team card: name, tagline, KPIs, 7-day team summary |
| feed | Feed | Rookie+ | Posts and comments |
| categories | Áreas | Rookie+ | Categories CRUD |
| members | Miembros | Rookie+ | Members list, roles, strikes, profiles |
| merits | Logros | Rookie+ | Merit catalog, award, event list |
| leaderboard | Posiciones | Rookie+ | Points and effort leaderboards |
| calendar | Calendario | Rookie+ | Team events |
| tools | Herramientas | Rookie+ | SWOT, Eisenhower, Pugh, Boards, Meetings, Goals |
| academy | Academia | Rookie+ | Modules and topics |
| funding | Fondos | Rookie+ | Accounts and entries |
| tasks | Tareas | Rookie+ | Task list, review flow |
| hr | Q&S | Rookie+ | Suggestions and complaints |
| myprofile | Perfil | Member | Own profile |
| admin | Admin | Team admin | Menu options, system merit points, task grade points |
| profile | Profile | — | View another member (route: `/profile/{membershipId}`) |

### Routing
- **Defined in:** `App.jsx` — `pathParts`, `routeView`, `profileMemberId`
- **Router:** HashRouter; path like `#/inicio`, `#/feed`, `#/profile/xyz`
- **Valid views:** `validViews` Set; invalid → redirect to `/inicio`
- **Nav items:** `navItems` array; conditional by `isAtLeastRookie`, `currentMembership`, `canEdit`

---

## 8. Event History / Auditability

### Audit log
- **Collection:** `auditLog`
- **Written by:** `logAudit()` in `App.jsx` — only when `canEdit` (team admin)
- **Actions logged:** `revoke_merit`, `grade_task`, `accept_suggestion`, `dismiss_suggestion`
- **Read/display:** **None** — no subscription, no UI. Data is stored for future use.

### User activity log
- No dedicated user activity log
- Merit events serve as award history; no generic "user did X" log

### What is auditable
- Merit revocations
- Task grades
- HR suggestion accept/dismiss
- **Not audited:** merit awards, task create/complete, module attempts, most other mutations

### Where stored
- `auditLog` collection; `teamId` scoped; team admins can read (Firestore rules)

---

## 9. Tenant and Membership Model

### Multi-tenant structure
- **Team-based:** Each team is a tenant
- **Isolation:** Every document (except `users`, `teams`) has `teamId`; rules check `isActiveMember(teamId)`

### Tenant isolation
- Firestore rules: `isActiveMember(resource.data.teamId)` or equivalent for each collection
- Queries: `where('teamId', '==', selectedTeamId)` for all team-scoped data

### Multiple teams per user
- **Yes** — one user can have memberships in many teams
- `userMemberships` = all memberships for `authUser.uid`
- `selectedTeamId` in state/localStorage; switch via team picker

### Roles
- **Per membership:** `role` on membership doc
- **Order:** aspirant < rookie < junior < senior < leader < facultyAdvisor < teamAdmin
- **Platform:** `users/{uid}.platformRole` — `platformAdmin` can access all teams

### RBAC
- **Implementation:** `atLeast(role, min)` in `utils.js`; `canEdit`, `canAward`, `canCreateMerit`, etc. in `App.jsx`
- **Firestore:** Helper functions `isTeamAdmin`, `isLeaderOrAbove`, `isRookieOrAbove`, `isAreaLeaderCanStrikeTarget`, `isLeaderCanEditMerit`
- **Pattern:** Client checks for UI; Firestore rules for enforcement

---

## 10. Areas / Team Structure

### User–area relationship
- **One area per member** — `memberships.categoryId` (optional)
- No multi-area membership

### Tasks and merits vs areas
- **Tasks:** No `categoryId`; assignment restricted by leader's area (assignee must be in leader's category)
- **Merits:** Optional `categoryId`; leaders create/award only in their area
- **Tools:** Optional `categoryId` on each item; scope filter (All / Global / My area)

### Area leaders
- **Leader + categoryId:** Leader with assigned `categoryId` can:
  - Add/remove strikes only for members in that category
  - Create/edit merits only for that category
  - Award merits only to members in that category
  - Assign tasks only to members in that category

---

## 11. Existing Architecture Constraints

### Must respect
1. **Team scoping:** All new collections must have `teamId` and enforce it in rules
2. **Membership-based access:** Use `isActiveMember`, `isRookieOrAbove`, `isLeaderOrAbove`, `isTeamAdmin` patterns
3. **Audit log:** If extending, keep `teamId`, `userId`, `action`, `targetType`, `targetId`, `details`; only team admins write
4. **Membership ID format:** `{userId}_{teamId}` for real users; `ghost_*` for ghost members

### RBAC assumptions
- Role on membership; no per-resource ACL
- Leaders are area-scoped via `categoryId`
- Platform admin bypasses team checks

### Fragile / tightly coupled
1. **Tasks Firestore rules:** Use `assigneeMembershipId` (singular) for update/delete; app uses `assigneeMembershipIds` — **potential bug** for multi-assignee tasks
2. **All handlers in App.jsx:** ~2400 lines; handlers passed as props; adding features increases prop drilling
3. **No audit log UI:** Data exists but unused; any new audit viewer must subscribe to `auditLog`
4. **Module attempts:** Immutable; no approve flow in app — approval is manual or missing

### Reusable patterns
- `useFirebaseSubscriptions` — single hook for all team data
- `tsToDate()` for Firestore timestamps
- `ensureString()`, `getL()`, `toL()`, `fillL()` for bilingual fields
- `logAudit()` for admin actions
- `canEditToolItem(item)` for tools scope
- `lastEditedStamp()` for tools last-edited metadata

### Do not casually rewrite
- Firestore security rules (FIREBASE_SETUP.md, firestore.rules)
- Membership ID format and ghost member handling
- Role hierarchy and `atLeast()` usage
- Team creation seeding (categories, welcome module)

---

## 12. Best Integration Points for Future Concepts

### Responsibility ledger
- **Natural fit:** Extend `meritEvents` or add `responsibilityEvents` with `teamId`, `membershipId`, `type`, `evidence`
- **Integration:** Reuse `logAudit` pattern; link to tasks (already have `taskId` on merit events for "Tarea revisada")
- **UI:** Near `MyCommitmentsCard`, Inicio personal summary, or new tab

### Community sessions
- **Natural fit:** New collection `teamSessions` or extend `teamEvents` with `type: 'session'`
- **Integration:** `teamEvents` already has `categoryId`; add fields for session-specific data (attendees, duration, etc.)
- **UI:** Calendar view or new "Sesiones" section in Tools/Calendar

### Knowledge map
- **Natural fit:** New collection `knowledgeNodes` / `skills` with `teamId`, optional `categoryId`
- **Integration:** Link `modules` to nodes (add `skillIds[]` or `topicIds[]` on modules); `moduleAttempts` already track completion
- **UI:** New tab or section in Academy; could drive "contribution path" suggestions

### Merit families
- **Natural fit:** Add `parentMeritId` or `familyId` on `merits`; or new `meritFamilies` collection
- **Integration:** Merits already have `achievementTypes`, `domains`, `tier`; families would group these
- **UI:** MeritsView filters; merit detail modal

### Contribution path discovery
- **Natural fit:** Derived from `meritEvents` + `moduleAttempts` + `tasks` + `weeklyStatuses`
- **Integration:** Compute paths client-side from existing data; no new collections required for MVP
- **UI:** New section in Inicio or Perfil; or dedicated "Ruta" tab

### Learning–project integration
- **Natural fit:** Add `projectId` or `taskId` on `modules` or `moduleAttempts`; or new `learningProjects` linking modules to tasks/boards
- **Integration:** Tasks and boards already exist; modules have `moduleAttempts`; link via new relation
- **UI:** Academy view "related projects"; or Tasks/Boards "related modules"

---

## Inconsistencies and Gaps (Explicit Callouts)

1. **Tasks rules vs app:** Firestore uses `assigneeMembershipId`; app uses `assigneeMembershipIds`. Multi-assignee update/delete may fail rules.
2. **Audit log:** Written, never read. No UI.
3. **Module approval:** `moduleAttempts` support `approved` but no handler exists; Firestore rules make attempts immutable.
4. **Retrieval prompt:** Strings exist; Academy has no retrieval question flow.
5. **Bilingual:** Many entities use `{en, es}`; some use plain strings. `ensureString`/`getL` handle both.
