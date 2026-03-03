# Mission Control

**Merit-Based Team Operating System + Learning Academy**

A multi-team web platform for managing member progression, merit awards, and structured learning — backed by Google Firebase.

---

## Quick Start (Local Dev)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> Before the app is fully functional you need to complete the Firebase setup.
> See **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** for full instructions.

---

## What It Does

### Public visitors (not signed in)
- Browse all team names and overviews
- Must sign in with Google to join a team

### Aspirants (auto-assigned on join)
- See the team **Overview** tab only
- Overview is designed to engage potential members: tagline, about, history, objectives, KPIs

### Rookie / Junior / Senior
- See **all tabs** (Categories, Merits, Leaderboard, Academy) in read-only mode
- Can complete Academy modules with retrieval prompts

### Leaders (per team category)
- All of the above
- Can **award merits** within their assigned category only

### Team Admin
- Full edit access for their team
- Edit Overview content (tagline, about, history, objectives, custom KPIs)
- Create / delete categories
- Manage member roles and category assignments
- Add / remove strikes (3 strikes = suspended)
- Create, edit, delete Academy modules (with embedded video support)
- Define and delete merits
- Award and revoke merits (all categories)

### Platform Admin (global)
- All of the above across **every** team
- Create new teams
- Only role that can work across team boundaries

---

## Key Features

### Overview Editor
- Editable tagline, about, history, objectives
- Custom KPI tiles (label + value)
- Auto-computed stats: member count, total points, module count

### Merit System
- Admin-defined merits with point values and optional category scope
- Leaders can only award merits scoped to their category
- Every award and revoke is an **immutable audit event**

### Leaderboard
- Season view (last 3 months) and All-Time view
- Computed in real-time from merit event log

### Academy
- Admin-created modules with text content
- **Embedded video support** — paste any YouTube or Vimeo URL
- Members cannot mark complete without submitting a retrieval prompt response
- Completion is recorded per-user and displayed with their answer

### Strike System
- Admins add/remove strikes per member
- 3 strikes automatically suspends the membership
- Suspended members lose all team access until reinstated

### Collapsible Sidebar
- Toggle the left nav with the `‹` / `›` button in the header

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Auth | Firebase Authentication (Google) |
| Database | Cloud Firestore (NoSQL, real-time) |
| Hosting | Firebase Hosting (optional, free) |

---

## Firebase Setup

Full step-by-step instructions: **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**

Key steps:
1. Enable Google Sign-In in Firebase Console
2. Enable Firestore and paste the security rules
3. Add `localhost` as an authorized domain
4. Sign in once, then manually set `platformRole: "platformAdmin"` on your user doc in Firestore
5. You can now create teams from the app

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy with Firebase Hosting or any static host.

```bash
# Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting   # point to dist/
firebase deploy
```
