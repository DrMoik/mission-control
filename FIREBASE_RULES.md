# Firebase Rules Guide

This project uses Firebase Auth for identity and Firestore rules for authorization.

## Firestore structure

The database mostly uses top-level collections with a `teamId` field.

Main collections:

- `users`: platform-level user profile and platform role
- `teams`: team configuration
- `memberships`: one document per user-team relationship
- `categories`: team areas
- `tasks`: team tasks
- `merits` and `meritEvents`
- `posts`, `comments`, `postReactions`
- `teamEvents`, `teamSessions`, `weeklyStatuses`
- `teamInventoryItems`, `teamInventoryLoans`
- `teamFundingAccounts`, `teamFundingEntries`
- `crossTeamChannels`, `crossTeamChannelTeams`, `crossTeamMessages`
- `hrSuggestions`, `hrComplaints`

## Important fields

Fields that matter across many collections:

- `teamId`
- `userId`
- `membershipId` or `authorMembershipId`
- `role`
- `status`
- `categoryId`
- timestamps such as `createdAt`, `updatedAt`

For flat collections, missing `teamId` is a serious bug because many queries and rules depend on it.

## Permission logic

Rules are defined in [`firestore.rules`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/firestore.rules).

The main checks are based on:

- authenticated user identity
- whether the user has a membership in the target team
- membership status
- membership role
- platform admin status from `users/{uid}.platformRole`

Important principle:

- client code can hide or disable actions
- rules decide whether the action is actually allowed

## How roles work

Platform-wide role:

- `platformAdmin` on `users/{uid}`

Team roles on `memberships`:

- `facultyAdvisor`
- `teamAdmin`
- `leader`
- `senior`
- `junior`
- `rookie`

Many rules use helper functions such as:

- `isPlatformAdmin`
- `isActiveMember`
- `isTeamAdmin`
- `isLeaderOrAbove`
- `isRookieOrAbove`

## How to safely change rules

1. Read the existing helper functions first.
2. Update rules in the smallest possible way.
3. Keep role logic consistent with the client-side permission booleans.
4. Check both read and write effects.
5. Test at least one allowed case and one denied case.

Avoid duplicating complicated logic inline if a helper function can express it clearly.

## How to test rules locally

Use the Firebase Emulator Suite.

Typical command:

```bash
firebase emulators:start --only firestore
```

Then test:

- a normal member flow
- a leader or admin flow
- a denied write
- a legacy document read if you changed schema expectations

Before production deploy:

```bash
firebase deploy --only firestore:rules
```
