import { useEffect, useRef } from "react";
import { dueReminders, notificationsSupported, registerReminderWorker, showReminder } from "../services/reminders";
import { localDateString } from "../utils/dates";

const FIRED_KEY = "job-ready-reminded";
const readFired = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    return saved.date === localDateString() ? new Set(saved.keys || []) : new Set();
  } catch { return new Set(); }
};
const writeFired = (set) => { try { localStorage.setItem(FIRED_KEY, JSON.stringify({ date: localDateString(), keys: [...set] })); } catch { /* ignore */ } };

// Checks every 20 s (and when the tab becomes visible) whether a task is due and shows one notification per task.
export function useReminders(state, active) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const enabled = active && !!state.settings.remindersEnabled && notificationsSupported() && Notification.permission === "granted";
  useEffect(() => {
    if (!enabled) return undefined;
    registerReminderWorker();
    const check = () => {
      const fired = readFired();
      const due = dueReminders(stateRef.current, new Date(), fired);
      if (!due.length) return;
      due.forEach(({ key, task, minutesLeft }) => {
        fired.add(key);
        const time = `${task.start}${task.end ? `–${task.end}` : ""}`;
        showReminder(minutesLeft > 0 ? `In ${minutesLeft} min: ${task.name}` : `Starting now: ${task.name}`, {
          body: [time, task.description].filter(Boolean).join(" · "), tag: `task-${task.id}`, data: { url: "/daily" },
        });
      });
      writeFired(fired);
    };
    check();
    const id = window.setInterval(check, 20000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", check); };
  }, [enabled]);
}
