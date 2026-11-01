import { useEffect, useRef } from "react";
import { dueReminders, notificationsSupported, registerReminderWorker, showReminder, isAndroidTrackerWebView } from "../services/reminders";
import { reminderContent } from "../services/reminderText";
import { localDateString } from "../utils/dates";

const FIRED_KEY = "job-ready-reminded";
const readFired = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    return saved.date === localDateString() ? new Set(saved.keys || []) : new Set();
  } catch { return new Set(); }
};
const writeFired = set => { try { localStorage.setItem(FIRED_KEY, JSON.stringify({ date: localDateString(), keys: [...set] })); } catch { /* ignore */ } };

export function useReminders(state, active) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const enabled = active && !!state.settings.remindersEnabled && !isAndroidTrackerWebView() && notificationsSupported() && Notification.permission === "granted";
  useEffect(() => {
    if (!enabled) return undefined;
    let checking = false;
    registerReminderWorker();
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const fired = readFired();
        const due = dueReminders(stateRef.current, new Date(), fired);
        for (const { key, task, minutesLeft } of due) {
          const content = reminderContent(task, minutesLeft);
          const result = await showReminder(content.title, { body: content.body, tag: `task-${task.id}`, data: { url: "/daily" } });
          if (result.ok) { fired.add(key); writeFired(fired); }
        }
      } finally { checking = false; }
    };
    check();
    const id = window.setInterval(check, 20000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, [enabled]);
}
