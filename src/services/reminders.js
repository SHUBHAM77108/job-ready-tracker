// Browser notifications are delivered through the service worker. Mobile browsers
// require this path; the Notification constructor alone is not reliable there.
import { isUnstarted, toMin } from "./scheduling";
import { localDateString, roadmapDayForDate } from "../utils/dates";

export const isAndroidTrackerWebView = () => typeof navigator !== "undefined" && /JobReadyTrackerAndroidWebView/i.test(navigator.userAgent);
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

// True only when reminders are switched on AND this browser can really deliver them (used for the bell icons).
export const remindersActive = settings => !!settings?.remindersEnabled && !isAndroidTrackerWebView() && notificationsSupported() && Notification.permission === "granted";

export async function registerReminderWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return null;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const registration = await navigator.serviceWorker.ready;
    return typeof registration.showNotification === "function" ? registration : null;
  } catch { return null; }
}

export async function showReminder(title, options = {}) {
  if (!notificationsSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission !== "granted") return { ok: false, reason: Notification.permission === "denied" ? "denied" : "permission" };
  try {
    const registration = await registerReminderWorker();
    if (!registration) return { ok: false, reason: "worker" };
    const icon = `${import.meta.env.BASE_URL}app-icon-v2-192.png`;
    await registration.showNotification(title, { icon, badge: icon, ...options });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.name === "NotAllowedError" ? "denied" : "display" };
  }
}

const GRACE_MIN = 10;
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
