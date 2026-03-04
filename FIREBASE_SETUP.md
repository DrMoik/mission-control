# Firebase Setup Guide

This app uses **Firebase Authentication** (Google Sign-In) and **Cloud Firestore** (database).
Both services are free within the Spark (free) tier for most teams.

---

## 1. Open Your Firebase Project

Go to [https://console.firebase.google.com](https://console.firebase.google.com) and open the project:
`quantum-robotics-48d7e`

---

## 2. Enable Google Sign-In

1. In the left sidebar, click **Authentication**
2. Click the **Sign-in method** tab
3. Click **Google** → toggle **Enable** → click **Save**
4. Add your authorized domain (see Step 5 below)

---

## 3. Enable Firestore

1. In the left sidebar, click **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (you'll add rules below)
4. Choose the region closest to your users → click **Enable**

---

## 4. Set Firestore Security Rules

In **Firestore Database → Rules**, replace everything with the rules below, then click **Publish**.

These rules enforce **strict per-team data isolation**: users can only read data
from teams they belong to, and only perform actions allowed by their role.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ═══════════════════════════════════════════════════════════
    //  HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    // Platform Admin: stored in users/{uid}.platformRole
    // Uses regex so accidental leading/trailing spaces are forgiven
    function isPlatformAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid))
          .data.platformRole.matches('\\s*platformAdmin\\s*');
    }

    // Membership documents use predictable IDs: uid_teamId
    function membershipPath(teamId) {
      return /databases/$(database)/documents/memberships/$(request.auth.uid + '_' + teamId);
    }

    function membershipExists(teamId) {
      return exists(membershipPath(teamId));
    }

    function membershipDoc(teamId) {
      return get(membershipPath(teamId));
    }

    // Active member = has a membership with status 'active' (not pending/suspended)
    function isActiveMember(teamId) {
      return request.auth != null && (
        isPlatformAdmin() || (
          membershipExists(teamId) &&
          membershipDoc(teamId).data.status == 'active'
        )
      );
    }

    function myRole(teamId) {
      return membershipDoc(teamId).data.role;
    }

    // Team Admin or Faculty Advisor: can create/edit content for the team
    function isTeamAdmin(teamId) {
      return isPlatformAdmin() || (
        isActiveMember(teamId) &&
        myRole(teamId) in ['teamAdmin', 'facultyAdvisor']
      );
    }

    // Leader or above: can award merits, edit tools, manage calendar/boards
    function isLeaderOrAbove(teamId) {
      return isPlatformAdmin() || (
        isActiveMember(teamId) &&
        myRole(teamId) in ['teamAdmin', 'facultyAdvisor', 'leader']
      );
    }

    // Rookie or above: can see all tabs, post in feed, complete modules
    function isRookieOrAbove(teamId) {
      return isPlatformAdmin() || (
        isActiveMember(teamId) &&
        myRole(teamId) in ['teamAdmin', 'leader', 'senior', 'junior', 'rookie']
      );
    }

    // ═══════════════════════════════════════════════════════════
    //  USERS
    //  Each user reads/writes only their own profile.
    //  platformRole can ONLY be set by a platform admin.
    // ═══════════════════════════════════════════════════════════

    match /users/{userId} {
      allow read: if request.auth != null &&
        (request.auth.uid == userId || isPlatformAdmin());

      allow create: if request.auth != null && request.auth.uid == userId;

      // Users may update their own profile, but cannot change platformRole
      allow update: if (
          request.auth != null &&
          request.auth.uid == userId &&
          !('platformRole' in request.resource.data.diff(resource.data).affectedKeys())
        ) || isPlatformAdmin();

      allow delete: if isPlatformAdmin();
    }

    // ═══════════════════════════════════════════════════════════
    //  TEAMS
    //  Any signed-in user can browse teams (for the home screen).
    //  Only platform admins can create or delete teams.
    //  Team admins can update their own team's data (overview, SWOT, etc.)
    // ═══════════════════════════════════════════════════════════

    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow create: if isPlatformAdmin();
      allow update: if isTeamAdmin(teamId);
      allow delete: if isPlatformAdmin();
    }

    // ═══════════════════════════════════════════════════════════
    //  MEMBERSHIPS
    //  Active members of a team can see all memberships in that team.
    //  Only the user themselves (to join) or team admins can create/update.
    // ═══════════════════════════════════════════════════════════

    match /memberships/{membershipId} {
      allow read: if request.auth != null && (
        isPlatformAdmin() ||
        resource.data.userId == request.auth.uid ||
        isActiveMember(resource.data.teamId)
      );

      allow create: if request.auth != null && (
        isPlatformAdmin() ||
        request.resource.data.userId == request.auth.uid
      );

      allow update: if isTeamAdmin(resource.data.teamId);

      allow delete: if isPlatformAdmin() ||
        isTeamAdmin(resource.data.teamId) ||
        (request.auth != null && resource.data.userId == request.auth.uid);
    }

    // ═══════════════════════════════════════════════════════════
    //  CATEGORIES
    //  Visible to any active team member.
    //  Only team admins can create, edit, or delete.
    // ═══════════════════════════════════════════════════════════

    match /categories/{categoryId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isTeamAdmin(request.resource.data.teamId);
      allow update: if isTeamAdmin(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  MERITS
    //  Visible to any active team member.
    //  Team admins can create/edit/delete. Leaders can create only for their category.
    // ═══════════════════════════════════════════════════════════

    match /merits/{meritId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isTeamAdmin(request.resource.data.teamId) ||
        (isLeaderOrAbove(request.resource.data.teamId) &&
         request.resource.data.categoryId != null &&
         request.resource.data.categoryId == membershipDoc(request.resource.data.teamId).data.categoryId);
      allow update: if isTeamAdmin(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  MERIT EVENTS
    //  Immutable ledger — create only, never edit or delete.
    //  Leaders can award merits in their team; admins can award any.
    // ═══════════════════════════════════════════════════════════

    match /meritEvents/{eventId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId) ||
        (request.resource.data.autoAward == true &&
         get(/databases/$(database)/documents/memberships/$(request.resource.data.membershipId)).data.userId == request.auth.uid);
      allow update: if isPlatformAdmin();
      allow delete: if isPlatformAdmin();
    }

    // ═══════════════════════════════════════════════════════════
    //  ACADEMY MODULES
    //  Rookie and above can read. Only team admins can manage.
    // ═══════════════════════════════════════════════════════════

    match /modules/{moduleId} {
      allow read: if isRookieOrAbove(resource.data.teamId);
      allow create: if isTeamAdmin(request.resource.data.teamId);
      allow update: if isTeamAdmin(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  MODULE ATTEMPTS
    //  Users can only read and create their own attempts.
    //  Team admins can read all (for progress tracking).
    //  Immutable once submitted.
    // ═══════════════════════════════════════════════════════════

    match /moduleAttempts/{attemptId} {
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        isTeamAdmin(resource.data.teamId)
      );
      allow create: if request.auth != null &&
        isRookieOrAbove(request.resource.data.teamId) &&
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    // ═══════════════════════════════════════════════════════════
    //  CALENDAR EVENTS
    //  Any active member can see. Leaders+ can manage.
    // ═══════════════════════════════════════════════════════════

    match /teamEvents/{eventId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if isLeaderOrAbove(resource.data.teamId);
      allow delete: if isLeaderOrAbove(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  PROJECT BOARDS (KANBAN)
    //  Any active member can view. Leaders+ can manage cards.
    //  Only team admins can delete an entire board.
    // ═══════════════════════════════════════════════════════════

    match /teamBoards/{boardId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if isLeaderOrAbove(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  FEED — POSTS
    //  Rookies+ can read and post. Authors or team admins can delete.
    //  Posts are immutable once created (no editing).
    // ═══════════════════════════════════════════════════════════

    match /posts/{postId} {
      allow read: if isRookieOrAbove(resource.data.teamId);
      allow create: if isRookieOrAbove(request.resource.data.teamId) &&
        request.resource.data.authorId == request.auth.uid;
      allow update: if false;
      allow delete: if isTeamAdmin(resource.data.teamId) ||
        (request.auth != null && resource.data.authorId == request.auth.uid);
    }

    // ═══════════════════════════════════════════════════════════
    //  FEED — COMMENTS
    //  Same policy as posts.
    // ═══════════════════════════════════════════════════════════

    match /comments/{commentId} {
      allow read: if isRookieOrAbove(resource.data.teamId);
      allow create: if isRookieOrAbove(request.resource.data.teamId) &&
        request.resource.data.authorId == request.auth.uid;
      allow update: if false;
      allow delete: if isTeamAdmin(resource.data.teamId) ||
        (request.auth != null && resource.data.authorId == request.auth.uid);
    }

    // ═══════════════════════════════════════════════════════════
    //  MEETING NOTES
    //  Active members can read. Leaders+ can manage.
    // ═══════════════════════════════════════════════════════════

    match /teamMeetings/{meetingId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if isLeaderOrAbove(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  GOALS / OKRs
    //  Active members can read. Leaders+ can manage.
    // ═══════════════════════════════════════════════════════════

    match /teamGoals/{goalId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if isLeaderOrAbove(resource.data.teamId);
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  WEEKLY STATUSES (profile mission updates)
    //  Active members can read all in their team.
    //  Members can create/update their own (membershipId matches).
    // ═══════════════════════════════════════════════════════════

    match /weeklyStatuses/{statusId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isActiveMember(request.resource.data.teamId) &&
        request.resource.data.membershipId == request.auth.uid + '_' + request.resource.data.teamId;
      allow update: if isActiveMember(resource.data.teamId) &&
        resource.data.membershipId == request.auth.uid + '_' + resource.data.teamId;
      allow delete: if isTeamAdmin(resource.data.teamId);
    }

    // ═══════════════════════════════════════════════════════════
    //  FUNDING — transparent ledger for team money
    //  teamFundingAccounts: multiple accounts per team. All active members read; leaders+ write.
    //  teamFundingEntries: movement log with accountId. All active members read; leaders+ create/delete.
    // ═══════════════════════════════════════════════════════════

    match /teamFundingAccounts/{accountId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if isLeaderOrAbove(resource.data.teamId);
      allow delete: if isLeaderOrAbove(resource.data.teamId);
    }

    match /teamFundingEntries/{entryId} {
      allow read: if isActiveMember(resource.data.teamId);
      allow create: if isLeaderOrAbove(request.resource.data.teamId);
      allow update: if false;
      allow delete: if isLeaderOrAbove(resource.data.teamId);
    }

  }
}
```

Click **Publish** after pasting. Changes take effect immediately.

---

## 5. Add Authorized Domains

1. In **Authentication → Settings → Authorized domains**
2. `localhost` is already there for local dev
3. Add your GitHub Pages domain: `drmoik.github.io` (or your custom domain)

---

## 6. Set Up the First Platform Admin

The `platformRole` field must be set once manually — no one can promote themselves.

1. Sign in to the app with Google
2. Go to **Firebase Console → Firestore Database → users**
3. Find your user document (click it — look for your email)
4. Click the `platformRole` field → change `"user"` → `"platformAdmin"` (no spaces)
5. Refresh the app — the **Platform Admin** badge appears and you can create teams

> **Tip:** If the app still doesn't recognize the change, open DevTools → Application → Clear
> site data → reload. The real-time listener will pick it up within 1–2 seconds.

---

## 7. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 8. Deploy to Firebase Hosting (Optional — Free Alternative to GitHub Pages)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "dist", SPA: yes
npm run build
firebase deploy
```

Your app will be live at `https://quantum-robotics-48d7e.web.app`

---

## Firestore Collections Reference

| Collection | Key fields | Who can read |
|---|---|---|
| `users` | `uid`, `displayName`, `email`, `photoURL`, `platformRole` | Own doc only |
| `teams` | `name`, `overview`, `swot` | Any signed-in user |
| `memberships` | `teamId`, `userId`, `displayName`, `role`, `status`, `strikes`, `categoryId` | Active team members |
| `categories` | `teamId`, `name`, `description` | Active team members |
| `merits` | `teamId`, `name`, `points`, `categoryId`, `achievementTypes[]`, `domains[]`, `tier`, `tags[]` | Active team members |
| `meritEvents` | `teamId`, `membershipId`, `meritId`, `points`, `type`, `evidence` | Active team members |
| `modules` | `teamId`, `title`, `content`, `videoUrl`, `retrievalPrompt` | Rookie+ members |
| `moduleAttempts` | `teamId`, `moduleId`, `userId`, `answer`, `completedAt` | Own doc + team admins |
| `teamEvents` | `teamId`, `title`, `date`, `description`, `createdBy` | Active team members |
| `teamBoards` | `teamId`, `name`, `columns[]` (with `cards[]`) | Active team members |
| `posts` | `teamId`, `content`, `imageUrl?`, `authorId`, `authorName`, `authorPhoto` | Rookie+ members |
| `comments` | `teamId`, `postId`, `content`, `authorId`, `authorName` | Rookie+ members |
| `teamMeetings` | `teamId`, `title`, `date`, `attendees`, `notes`, `actionItems[]` | Active team members |
| `teamGoals` | `teamId`, `objective`, `owner`, `dueDate`, `keyResults[]`, `status` | Active team members |
| `weeklyStatuses` | `teamId`, `membershipId`, `weekOf`, `advanced`, `failedAt`, `learned` | Active team members |

---

## Role Hierarchy (per team)

| Role | Overview | All tabs | Post/Comment | Award merits | Edit tools/calendar | Edit content | Create teams |
|---|---|---|---|---|---|---|---|
| Aspirant | ✓ | — | — | — | — | — | — |
| Rookie | ✓ | ✓ | ✓ | — | — | — | — |
| Junior | ✓ | ✓ | ✓ | — | — | — | — |
| Senior | ✓ | ✓ | ✓ | — | — | — | — |
| Leader | ✓ | ✓ | ✓ | Own category | ✓ | — | — |
| **Faculty Advisor** | ✓ | ✓ | ✓ | All | ✓ | **✓** | — |
| Team Admin | ✓ | ✓ | ✓ | All | ✓ | ✓ | — |
| Platform Admin | ✓ | ✓ (all teams) | ✓ | All | ✓ | ✓ | ✓ |

## Strike System

- Each member starts with 0 strikes
- Team Admins can add or remove strikes from the **Categories** tab
- At **3 strikes** the membership is automatically suspended
- Suspended members lose access to all team tabs (Firestore rules enforce this server-side)
- Admins can **Reinstate** a suspended member (removes one strike, restores active status)

---

## How Team Data Isolation Works

Every document in every collection (except `users` and `teams`) stores a `teamId` field.
The security rules always check that the requesting user has an active membership in that
specific `teamId` before allowing any read or write. This means:

- A member of Team A **cannot read** Team B's categories, merits, modules, posts, etc.
- Membership documents use the format `uid_teamId` as their document ID, enabling O(1)
  membership lookups inside security rules without extra queries.
- The `platformRole` field in `users` can only be modified by a platform admin, preventing
  privilege escalation.
