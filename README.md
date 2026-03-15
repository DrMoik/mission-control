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
- Full deploy: `npm run deploy:firebase`

## More docs

- [`MAINTENANCE.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/MAINTENANCE.md)
- [`ARCHITECTURE.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/ARCHITECTURE.md)
- [`FIREBASE_RULES.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/FIREBASE_RULES.md)
- [`CONTRIBUTING.md`](/c:/Users/betel/Documents/Webpages/Quantum/Gamification/mission-control/CONTRIBUTING.md)
