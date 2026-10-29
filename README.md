# Job-Ready Tracker (React + Vite)

A responsive React starter based on the supplied 92-day Job-Ready Tracker. It includes a dashboard, daily checklist, manual task status editing, a basic task timer, analytics, activity calendar, learning roadmap, projects, job applications, CSV/Excel timetable import, settings, local backup, and optional Firebase authentication/cloud storage.

## Requirements
- Node.js 20 LTS or later (Node 22 LTS is a safe choice).
- npm.

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build
```bash
npm run build
npm run preview
```

## Local demo vs cloud
- Without Firebase environment variables, the app runs in **local demo mode** and saves data in this browser's localStorage.
- Local demo mode does **not** sync between laptop and phone, and the demo login is not a secure account system.
- To enable real login and cloud sync:
  1. Create a Firebase project at https://console.firebase.google.com/
  2. Add a Web App in Project settings.
  3. Enable Authentication > Sign-in method > Email/Password.
  4. Create a Cloud Firestore database.
  5. Copy `.env.example` to `.env` and fill in the Firebase web config values.
  6. Configure Firestore rules before storing real personal data. See `firestore.rules`.
  7. Restart `npm run dev` after changing `.env`.

## Firestore rules
The included `firestore.rules` is a starting rule set for the path used by this app. Publish it in Firebase Console > Firestore Database > Rules. Never use open rules such as `allow read, write: if true` for private data.

## Timetable import
Supported: `.xlsx`, `.xls`, `.csv`, `.txt`. Recommended columns:
- `Task` (or `Task Name`, `Activity`, `Title`, `Name`)
- `Start` (or `Start Time`, `From`)
- `End` (or `End Time`, `To`)
- `Description` (or `Notes`, `Details`)
- optional `Day` / `Day Number` / `Date`

The app previews rows before import. Imported tasks replace the active task list, so export a JSON backup first if you need to preserve the current schedule.

## Important prototype limitations
- Reminders are checked while the app tab is open. True background/push reminders need service worker + push infrastructure and platform/browser testing.
- The simple timer is active while the Daily Tracker page remains open; a production timer should persist elapsed time reliably across navigation/reloads.
- Project images are entered as URLs only. No image upload feature is included, as requested.
- This is a starter app; test the complete flow before using it as your only copy of important data.
