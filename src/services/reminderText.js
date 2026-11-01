// Text of a task reminder notification. Pure functions with no imports so they can be unit-tested with plain Node.
// Non-ASCII characters are written as escapes on purpose: a file saved in the wrong encoding can no longer garble them.
const DOT = "\u00B7";   // middle dot
const DASH = "\u2013";  // en dash

const minutes = time => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  return m && Number(m[1]) <= 23 && Number(m[2]) <= 59 ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Title is exactly the task's name; the body says when it starts, its time range and its description.
export function reminderContent(task, minutesLeft) {
  const title = String(task?.name || "").trim() || "Untitled task";
  const when = minutesLeft > 0 ? `Starts in ${minutesLeft} min` : "Starting now";
  const time = task?.start ? `${task.start}${task.end ? `${DASH}${task.end}` : ""}` : "";
  const detail = String(task?.description || "").trim();
  return { title, body: [when, time, detail].filter(Boolean).join(` ${DOT} `) };
}

// For the "Send test notification" button: preview with a real task of today (next one still to come, else the first).
export function pickPreviewTask(tasks, nowMinutes) {
  const timed = (tasks || []).filter(t => t && t.status !== "completed" && t.status !== "skipped" && minutes(t.start) != null)
    .sort((a, b) => minutes(a.start) - minutes(b.start));
  if (!timed.length) return null;
  const next = timed.find(t => minutes(t.start) >= nowMinutes) || timed[0];
  return { task: next, minutesLeft: Math.max(0, minutes(next.start) - nowMinutes) };
}
