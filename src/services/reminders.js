// Task reminders. Pure "what is due now" logic + helpers to show a notification.
import { isUnstarted, toMin } from "./scheduling";
import { localDateString, roadmapDayForDate } from "../utils/dates";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export async function registerReminderWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`); } catch { return null; }
}

// Prefer the service worker (works on Android and installed apps); fall back to a plain Notification.
export async function showReminder(title, options = {}) {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.active) { await reg.showNotification(title, options); return true; }
  } catch { /* fall through */ }
  try { new Notification(title, options); return true; } catch { return false; }
}

const GRACE_MIN = 10; // an app opened late does not replay reminders older than this

// Tasks of today that should notify right now. `fired` is a Set of keys already shown today.
export function dueReminders(state, now = new Date(), fired = new Set()) {
  const settings = state.settings || {};
  const duration = Number(settings.durationDays) || 60;
  const day = roadmapDayForDate(settings.startDate, now);
  if (day < 1 || day > duration) return [];
  const lead = Math.max(0, Number(settings.reminderMinutes) || 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateKey = localDateString(now);
  const out = [];
  for (const task of state.days?.[day]?.tasks || []) {
    const start = toMin(task.start);
    if (start == null || !isUnstarted(task)) continue;
    if (nowMin < start - lead || nowMin > start + GRACE_MIN) continue;
    const key = `${dateKey}|${task.id}|${lead}`;
    if (fired.has(key)) continue;
    out.push({ key, task, minutesLeft: Math.max(0, start - nowMin) });
  }
  return out;
}
