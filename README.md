# Mission Control

Mission Control is an internal platform for a university robotics team. It combines team coordination, member profiles, tasks, merits, sessions, feed posts, inventory, funding, and admin tools in one React + Firebase app.

It is built for a small student team, so the codebase favors explicit code and low operational complexity over heavy architecture.

## Stack

- React
- Vite
- Firebase Auth
- Firestore
- Tailwind CSS

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Environment variables

There are currently no required environment variables. Firebase configuration is stored in [`src/firebase.js`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/src/firebase.js).

If you later move Firebase config into environment variables, use `VITE_`-prefixed variables and update this document.

## Project structure

```text
src/
  app/        route parsing and view composition
  components/ reusable UI pieces
  config/     navigation and static config
  domains/    Firestore write services by feature
  hooks/      subscriptions and feature handlers
  services/   shared infrastructure wrappers
  views/      page-level screens
```

## Deployment

- Web app build: `npm run build`
- Firebase-oriented build: `npm run build:firebase`
- Firebase Functions only: `npm run deploy:functions`
- Full deploy: `npm run deploy:firebase`

## Android wrapper

The Android app uses Capacitor and shares the same `src/` codebase as the web app.

Typical workflow:

```bash
npm run android:sync
npm run android:open
```

Useful scripts:

- `npm run build:android` builds the shared app with relative asset paths for Capacitor
- `npm run android:copy` rebuilds and copies web assets into the Android shell
- `npm run android:sync` rebuilds and syncs Capacitor plugins/assets
- `npm run android:open` opens the native Android project
- `npm run android:run` rebuilds and runs on a connected Android target
- `npm run android:apk:debug` builds a debug APK
- `npm run android:apk:release` builds a release APK (requires Android SDK and signing setup)

### Android push notifications

Mission Control now supports Android push notifications for:

- New task assignments
- New team sessions

Students manage these preferences from their own profile inside the Android app.

Backend delivery uses Firebase Functions in [`functions/index.js`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/functions/index.js). App-side registration stores device tokens and per-team preferences under `users/{uid}` subcollections.

Before push notifications will work on a real APK:

1. Add `google-services.json` to [`android/app/google-services.json`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/android/app/google-services.json).
2. Deploy the backend triggers with `npm run deploy:functions`.
3. Ensure the build machine has Java 17+ and the Android SDK installed.
4. Build the Android app with `npm run android:apk:debug` or `npm run android:apk:release`.

## More docs

- [`MAINTENANCE.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/MAINTENANCE.md)
- [`ARCHITECTURE.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/ARCHITECTURE.md)
- [`FIREBASE_RULES.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/FIREBASE_RULES.md)
- [`CONTRIBUTING.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/CONTRIBUTING.md)
