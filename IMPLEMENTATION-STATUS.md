# Job-Ready Tracker — what is built, how it behaves, what to test

This file documents everything that was added or changed in the project, page by page, plus the rules the app follows and a test checklist.
Run locally with `npm ci && npm run dev` (Vite). Data is stored in the browser (`localStorage`) and, when Firebase is configured, synced to one Firestore document per user.

> **Validation note.** The logic layer (`src/services/scheduling.js`) was unit-tested in Node. Every file was syntax-checked and bundled with esbuild.
> The UI itself has **not** been clicked through in a real browser by the author of these changes — please run the checklist at the bottom.

---

## 1. Project map (new / changed files)

| File | Purpose |
|---|---|
| `src/services/scheduling.js` | All pure scheduling logic: time overlap, clustering, priority, timetables, roadmap placement, day lock, plan length. |
| `src/styles/polish.css` | Visual polish + all styles for the newer features. Loaded last in `main.jsx`; delete the import to revert the look. |
| `src/components/Modal.jsx` | Shared pop-up. Centered card on desktop, **bottom sheet on phones**. Esc / backdrop closes it. |
| `src/components/ConflictDialog.jsx` | Generic warning / confirm popup (time clash, unlock, etc.) with optional radio choice. |
| `src/components/TimetableFollowDialog.jsx` | "How many days will you follow this timetable?" |
| `src/components/RoadmapScheduler.jsx` | Turns roadmap topics into Daily Tracker tasks in free time slots. |
| `src/components/TaskDetail.jsx` | Task details + every saved work log. |
| `src/pages/*.jsx` | Dashboard, DailyTracker, Analytics, History, Applications, Projects, Resources, Roadmap, Settings (see below). |
| `src/styles.css` | **Removed** (was never imported; the real styles are in `src/styles/`). |

---

## 2. Rules the app follows

### 2.1 Day lock (Daily tracker)
- You can **open any day** (previous / next, the 7-day strip, "Jump to date", Analytics heat-map, History).
- **Today and past days** are fully editable. Nothing asks "Continue to Day N?" any more — a new day unlocks automatically at **12:00 AM** (the app also notices the date change while it is open and moves to the new day).
- **Future days are locked.** You can look at them and *plan* (add / edit / delete tasks), but Start, Pause, Mark done, status change, Log work and "Mark remaining as pending" ask: **"Unlock Day N?"**. After you confirm, that action runs and the day stays unlocked (`state.unlockedDays`). An early-unlocked day shows a banner with **Lock again**.
- Unlocking early never moves the calendar.

### 2.2 Time clashes and priority
- Adding or editing a task whose time overlaps another active (not "skipped") task shows a popup. It says *how* they overlap: exactly the same time, inside the other task, containing it, or partly overlapping.
- You choose **which one has priority** (the new task, one of the existing ones, or "same priority") and press **Keep both**, or **Change time**.
- Overlapping tasks are shown **together in one box** ("Same time · N tasks overlap"), the high-priority one first, with a ★ Priority badge. Tasks are sorted by time; flexible tasks (no time) go last.
- Priority can also be set any time in the task form (High / Normal / Low).
- Clash checks also run for: timetable import, single-task recurring rules, and a timetable's "Change days". (There you only choose *Import anyway / Go back*.) Roadmap scheduling never creates clashes — it only uses free slots.
- Back-to-back tasks (10:00 end, 10:00 start) are **not** a clash. A task with a start but no end counts as 30 minutes.

### 2.3 Timetables (Resources page)
- **CSV / Excel columns:** `Task`, `Start`, `End`, `Description`, `Day` (optional).
- **Row has a Day** → that task is created only on that day.
- **Row has no Day** → it belongs to a **timetable** that repeats every day. After "Continue" the app asks **how many days** (start day, number of days, which weekdays, or "Whole plan"). Tasks are created for those days and show up in Daily tracker, Analytics and History.
- Timetables can later be changed with **Change days** (adds new days; removes only *not-yet-started* tasks outside the new range) or deleted (keep all tasks, or also remove not-started ones). Started / logged / completed tasks are never removed.
- A timetable chosen as "whole plan" is flagged `toEnd` and **follows the plan length** (see 2.5).
- Single-task recurring rules (daily / weekly / every other day / one-time) are still available under **Single-task rules**.

### 2.4 Learning roadmap → tasks
- Roadmap page → **Schedule in Daily Tracker**. Each open topic becomes a task (`source: "roadmap"`, `topicId`).
- Defaults: 60 min per topic, window 09:00–21:00, 2 topics per day for topics that have no day. All editable in the popup, with a live preview (how many will be created / moved / won't fit).
- Only **free time** is used, so timetable slots stay untouched. If a day is full the topic moves to the next day. Running it again never duplicates a topic.
- Topics with no day sit in a group called **"Not on a day yet"**; scheduling gives them a day.
- In Daily tracker a roadmap task has its **own card style** (purple accent, "Roadmap topic" badge, round **learned checkbox**) and there is a **Roadmap topics** checklist in the side panel. Ticking a topic (card, checklist or Mark learned) completes the roadmap topic too, and vice-versa from the Roadmap page.

### 2.5 Plan length (Settings → Roadmap duration)
- 1 to **365** days.
- **Longer plan:** if timetables are set to run to the end of the plan, you are asked whether to **extend** them (or keep them as they are).
- **Shorter plan:** days after the new end are hidden from Daily tracker / Analytics / History but **stay saved**; making the plan longer brings them back.
- **After the plan ends** (today > last day) Overview and Daily tracker show a banner with **Extend by 30 days** (up to 365). At 365, set a new start date in Settings for a new plan.
- **Size warning:** the whole tracker is stored as one Firestore document (≈1 MB limit). Settings → Data overview shows the saved size and warns above ~800 KB. A 365-day plan with ~6 timetable tasks per day is about 0.6 MB.

### 2.6 Work logs
- **Log work** adds an entry (note, URL, minutes). Empty entries are discarded on save.
- **Click any task card** → details window: description, link, badges, roadmap / timetable origin, and **every saved work log** with date, minutes, note and link, plus total minutes. From there you can Edit or Log more work.
- A card shows a chip like "2 logs · 45 min · view".

---

## 3. Pages

### Daily tracker
- New **day header**: big "Day N of M", full weekday + date, status tag (Today / Past day / Upcoming / Unlocked early / Locked), previous / next, a **7-day strip** (weekday, date, ✓ when the day's required tasks are done, lock icon for locked days), date picker and "Go to today".
- Task cards grouped by clashes, source badges (Roadmap topic / Timetable / Priority), clickable for details.
- Side panel: Daily notes, **Roadmap topics** checklist, **Catch up** (earlier days that still have unfinished required tasks — click to open), Day summary.
- Add / Edit task is a shared pop-up (bottom sheet on phones) and now has a Priority field.

### Overview
- Shows **all** of the selected day's tasks (first 12, then "View all"), each with time range, name, description, source badge, priority, work-log count and status; clashing tasks are boxed together.
- **Now / Up next** strip for today, roadmap-learned count in the stats, plan-complete banner, locked-day note.
- Mobile layout: time column narrows and the status pill moves under the text.

### Analytics (made for 7 … 365 days)
- Range chips (last 7 / 30 / 90 / 180 days / all so far — only sensible options are offered).
- Cards: completion rate, tasks completed, **current streak**, time logged.
- **Plan at a glance** heat-map: one small square per plan day (click to open that day). **Week by week** bar chart (scrolls sideways when long). **By type** (timetable / roadmap / manual).
- **Daily completion** list is paginated (10, then "Show 20 more" / "Show all").
- Only days that have already started are counted; future days never drag the percentage down.

### Activity history (made for long plans)
- Search (task names and notes), filters (All / Fully done / Unfinished / Notes & logs), "Include upcoming days" switch.
- Days are grouped by **month** in collapsible sections (latest month open). Each row shows day number, date, progress bar, "x / y tasks", log and note icons.

### Job applications
- **Add application opens a pop-up** (same form edits an existing application — there was no edit before).
- Status tiles (All / Saved / Applied / Interview / Offer / Rejected) double as filters with counts; search box; header search also filters.
- Desktop: table. Phone: cards. Status is a colored dropdown; delete supports Undo.

### Projects
- **Add project opens a pop-up** (also used for editing). Filter chips show counts. Header search filters by name / description / technologies.
- Status chip colors, edit/delete buttons appear on hover on desktop and are always visible on touch screens.

### Timetable & resources
- Compact page: one-line upload bar + three tabs (Timetables / Single-task rules / Import history) with search. See 2.3.

### Learning roadmap
- Schedule in Daily Tracker button, "Not on a day yet" group, imported topics without a Day column no longer get forced onto Day 1.

### Settings
- Duration up to 365 with the plan's end date shown, extend / shorten prompts, saved-data size.

---

## 4. Data model additions (backwards compatible)

```
state.unlockedDays: number[]                      // future days the user unlocked
state.schedules[]: { kind: "timetable", id, name, sourceFile, rows:[{key,name,description,start,end}],
                     startDay, endDay, weekdays:[0-6], toEnd:boolean, createdAt }
                   { kind: "recurring", ... }       // single-task rule (existing)
                   { kind: "import", ... }          // day-specific import record
task: { ..., priority: "high"|"normal"|"low",
        scheduleId, rowKey,                         // generated by a timetable / rule
        topicId, roadmapId, source: "roadmap",      // generated from a roadmap topic
        workLogs:[{id,note,url,minutes,createdAt}] }
roadmap topic: { ..., day: number|null }            // null = not on a day yet
```
Old saved data keeps working; `unlockedDays` is added automatically on load.

---

## 5. Known limitations

- Attachments store only the file name / type / size, not the file bytes.
- Editing a recurring rule does not rewrite tasks that were already generated.
- Roadmap topic completion and Daily tracker completion are synced for *scheduled* topics only.
- Notifications work only while the app is open.
- Firebase sign-in / sync has not been tested end-to-end. Check Firestore rules and the ~1 MB document limit for very large plans.
- Tasks that cross midnight (end earlier than start) are treated as a 30-minute task for clash purposes.

---

## 6. Test checklist

1. **Lock:** open a future day → banner "locked". Press Start → "Unlock Day N?" → confirm → task starts. Reopen: banner says unlocked early; "Lock again" works. Today and past days never ask.
2. **Midnight:** leave the app open across 12:00 AM → it moves to the new day by itself; Next → today's day never shows a "Continue" popup.
3. **Clash:** add two tasks at the same time, then one inside the other's time → popup with overlap type + priority choice → both appear in one box, priority first.
4. **Timetable:** import a CSV with no Day column → choose days → check Daily tracker, Analytics, History. Import one with a Day column → only that day gets the task. Change days / delete → started tasks survive.
5. **Roadmap:** Schedule in Daily Tracker → roadmap cards appear only in free slots; tick the checkbox → topic is learned on the Roadmap page.
6. **Work log:** Log work → save → click the card → the log is listed with minutes and link.
7. **Plan length:** Settings → 90 days → extend prompt; 365 → check Analytics heat-map and History months; shorten to 30 → days beyond are hidden, lengthen again → they return.
8. **Applications / Projects:** Add opens a pop-up on desktop and a bottom sheet on a phone; edit works; delete → Undo.
9. **Phone widths (≈375 px):** Overview rows, 7-day strip, Analytics, History, Applications cards, all pop-ups.

---

## 7. Earlier changes (kept for reference)

- Daily tracker: task actions inside each card; descriptions, times, URLs, required flag, work logs, attachment metadata; pause / resume.
- Multiple named roadmaps with topic checkboxes, CSV / Excel topic import, optional sample roadmap.
- Calendar duration used everywhere instead of a fixed 92.
- Dark / light / system theme, dark-mode status colors, readable font sizes, hover and focus states, missing styles for roadmap day groups, empty-state actions and work-log editor.

---

## 8. Latest additions (backup restore, undo import, spread topics, bottom nav, reminders)

- **Settings → Import backup.** Pick a JSON exported by "Export JSON backup". The file is validated, a Now-vs-Backup comparison is shown, and nothing changes until you press **Replace my data** (there is also "Save current data first"). Export file names now include the date. Cloud sync now writes the whole document (no `merge`) so a restored backup cannot mix with older cloud data.
- **Roadmap → "Give them days →"** (on the "Not on a day yet" group). Spreads those topics over Day N, N+1… in saved order (topics per day is raised automatically if the plan is too short). Only topic days change; **Undo** is offered in the toast.
- **Resources → Undo last import.** Every import is remembered (`state.lastImport`). Undo removes the tasks that import created (timetable tasks and day-specific tasks, tagged with `importId`) plus its schedule entry; tasks already started / logged / completed are kept. One level only.
- **Bottom navigation (≤ 900 px).** Overview, Daily, Roadmap, Analytics, More (opens the side menu).
- **Reminders (new engine).** `services/reminders.js` + `hooks/useReminders.js` check every 20 s; today's tasks with a start time that are not started get one notification (lead time from Settings). `public/sw.js` is a service worker so notifications work on Android Chrome and installed apps; `manifest.webmanifest` + icons make the app installable. **Limit:** if the browser is fully closed nothing is delivered — that needs push (Firebase Cloud Messaging) and a server.
- **Not tested in a browser** (the build tools could not be installed in the authoring sandbox). Pure logic was tested in Node; please run `npm ci && npm run dev` and the checklist below.

Extra checklist: restore a backup (cancel, then confirm) · import a CSV then Undo last import · Give them days then Undo · phone width: bottom bar highlights the page, More opens the menu · Settings → enable reminders → Send test notification → add a task 2 minutes ahead.

---

## 9. Sync, Plan at a glance, Daily tracker, login (latest)

- **Firebase** config now ships in `src/firebase.js` (a `.env` still overrides it). Analytics loads lazily and only where the browser supports it. Web config values are not secrets; protection = `firestore.rules` (publish them!) + Authentication → Authorized domains (add `localhost` and your live domain) + Email/Password and Google providers enabled.
- **Live sync across devices** (`hooks/useTracker.js`): same account on phone and laptop → changes appear on the other device within ~1–2 s (Firestore `onSnapshot`). Saves are debounced (0.7 s) and flushed when the tab is hidden. The cloud document carries `_rev` / `_client` so a device never re-applies its own write or an older version. Two devices editing the very same second: the last save wins.
- **New accounts start empty.** The old starter-app data (`job-ready-tracker-react-v1`) is now imported only into the local demo account, never into a signed-in account.
- **Plan at a glance** (`components/PlanGlance.jsx`): GitHub-style, always 365 squares (Day 1 … 365, one column per week), dimmed after the plan's last day, today outlined, tap a day to open it. Used on **Overview** and **Analytics**; updates live from the same state.
- **`/widget`** page: a minimal full-screen Plan at a glance (also a manifest shortcut "Plan at a glance"). Real home-screen widgets are not possible from a web app — see chat notes.
- **Daily tracker**: empty accounts see a start screen instead of an empty calendar; the hard-coded "LeetCode problems solved" field is gone; "Today's tasks" redesigned (progress ring, chips, timeline-style cards with a round done-checkbox and tidy actions).
- **Login page**: one screen, no scrolling; Login / Sign up tabs, Google button, show/hide password, "Forgot password?" e-mail reset, clearer error messages.

---

## 10. Fixes after first real test

- **Cloud sync errors now say why.** The banner shows the Firestore error code with the fix (e.g. `permission-denied` → publish `firestore.rules`; `not-found` → create the Firestore database; `unavailable` → network, retried automatically). Full error is also in the browser console. Saves drop empty (`undefined`) fields, Firestore uses `ignoreUndefinedProperties` + automatic long-polling fallback, and a save over ~1 MB is refused with a clear size message instead of failing silently.
- **Roadmap → Add / Edit topic** opens as a popup (bottom sheet on phones).
- **Overview**: Plan at a glance (365 days) now sits above Progress overview in the same column and same width.
- **Profile menu** closes on click/tap anywhere outside, on Esc, or when the window loses focus.
- **Login page** restyled (card, gradient background, preview of the 365-day grid, feature list); still one screen with no scrolling.
