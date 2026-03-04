# Mission Control — User Guide

**How to use the platform**

Mission Control is a team merit and learning platform: you join a team, progress through roles, earn merits, complete academy modules, and use shared tools (boards, meetings, goals, etc.). This guide explains how to use it.

---

## Sign in and teams

- **Sign in** with Google (button on the first screen).
- **Choose a team** from the team picker. You see:
  - **Your teams** — teams you’re in (active or pending).
  - **Join a team** — browse and request to join others.
- **Switch team** anytime with “Switch Team” in the header; your data is per team.
- **Platform admins** can create new teams and manage all teams.

---

## Roles and what you can do

| Role | What you see and can do |
|------|-------------------------|
| **Visitor** (not signed in) | Browse team names and overviews; must sign in to join. |
| **Aspirant** | Only the **Overview** tab (tagline, about, history, objectives, KPIs). |
| **Rookie / Junior / Senior** | All tabs in **read-only**: Areas, Members, Merits, Leaderboard, Tools, Academy, Funding. Can complete Academy modules. |
| **Leader** | Same as above, plus can **award merits** in their assigned area only. |
| **Team Admin** | Full edit for that team: overview, areas, members, merits, academy, tools, funding, and the **Admin** tab for dropdown options. |
| **Platform Admin** | Same as Team Admin for **every** team; can create/rename/delete teams. |

---

## Main tabs

### Overview
- Team tagline, about, history, objectives, and custom KPI tiles.
- **Admins:** click “Edit” to change text and add/remove KPIs. Stats (members, points, modules) update automatically.

### Feed
- Posts and comments. Create a post (optional image URL); comment on posts; delete your own content. **Admins** can delete any.

### Areas (Categories)
- List of team areas (e.g. Mechanics, Software). **Admins:** create, edit, delete areas and assign members to an area.

### Members
- All members, roles, areas, and strikes. **Admins:** change role, assign area, add/remove strikes (3 strikes = suspended). Click a member to open their profile. **Admins** can add “ghost” members (no Google account) and approve/reject join requests.

### Merits
- List of merits (name, points, category, tier). **Admins:** create/edit/delete merits and set who can award them. **Leaders** award merits only in their area. You cannot award merits to yourself. Leaderboard points come from merit awards.

### Leaderboard
- Points per member: **Season** (last 3 months) and **All-time**. Read-only; updated from merit events.

### Tools
- **Calendar** — team events (create/edit/delete; global or per area).  
- **SWOT** — single team SWOT (strengths, weaknesses, opportunities, threats).  
- **Eisenhower** — urgency/importance matrices (global or per area).  
- **Pugh** — Pugh matrices with criteria and scores (global or per area).  
- **Boards** — Kanban-style boards (global or per area).  
- **Meetings** — meeting notes and action items.  
- **Goals** — goals with key results.  
Visibility and edit rights depend on your role and area; “scope” filters let you switch between All, Global, or one area.

### Academy
- **Modules** (text + optional video). Open a module, read/watch, then answer the **retrieval prompt** to mark it complete. Your completion and answer are saved. **Admins:** create/edit/delete modules and set order.

### Funding
- **Accounts** (e.g. budgets) and **entries** (transactions). **Admins** create/edit/delete accounts and entries.

### My Profile
- Your name, photo, role, area, bio, career, semester, collaboration tags, culture (songs, books, quotes, etc.), and weekly status. **Admins** can edit any member’s profile; you can edit your own. Use “View profile” on a member to open their profile.

### Admin (Team Admin only)
- Edit the options shown in team dropdowns: careers/majors, semesters, personality tags, collaboration suggestions, merit types/domains/tiers. One item per line or comma-separated.

---

## Header and navigation

- **Collapse/expand** the left sidebar with the `‹` / `›` button.
- **Profile avatar** — click to open your profile.
- **Switch Team** — return to team picker.
- **Sign out** — sign out of Google.
- **Platform admins:** “Preview as…” lets you see the app as another role (e.g. Rookie). “Exit Preview” returns to your real role.

---

## Quick start (running the app locally)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).  
To make the app work (auth and data), complete the Firebase setup: **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**.

---

## Build and deploy

```bash
npm run build
```

Output is in `dist/`. Deploy that folder with Firebase Hosting or any static host. For Firebase: `firebase init hosting` (set public directory to `dist`), then `firebase deploy`.
