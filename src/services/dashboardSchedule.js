const toMin = time => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(String(time))) return null;
  const [hour, minute] = String(time).split(":").map(Number);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};
const isActive = task => task && task.status !== "skipped";

export const minutesOnSelectedDate = (selectedDate, todayDate, nowMinutes) => {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const current = new Date(`${todayDate}T00:00:00`);
  const dayOffset = Math.round((Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()) - Date.UTC(selected.getFullYear(), selected.getMonth(), selected.getDate())) / 86400000);
  return nowMinutes + dayOffset * 1440;
};

// Times are local wall-clock values from the existing daily task model.
export const scheduleRange = task => {
  const start = toMin(task?.start);
  if (start == null) return null;
  let end = toMin(task?.end);
  if (end == null || end === start) end = start + 30;
  else if (end < start) end += 1440;
  return [start, end];
};

// What the user sees for a task. "now" = its time slot is running but the user has not pressed Start;
// "progress" = the user really started it; "next" = the first task that begins after now (today only).
export const STATE_LABEL = {
  completed: "Completed", progress: "In progress", now: "Not started", next: "Next", upcoming: "Upcoming",
  pending: "Pending", missed: "Not completed", paused: "Paused", skipped: "Skipped",
};

// A task whose time is over and which was not completed:
//  - same day  -> "pending" (it can still be finished)
//  - day over  -> "not completed" (unless the user deliberately keeps it "pending")
// The user can always set completed / pending / not completed by hand, and that choice is respected.
const afterEnd = (status, dayPassed) => status === "pending" ? "pending" : status === "missed" ? "missed" : (dayPassed ? "missed" : "pending");

export const taskTimeState = (task, selectedDate, todayDate, nowMinutes) => {
  const status = task.status;
  if (status === "completed") return "completed";
  if (status === "skipped") return "skipped";
  const dayPassed = selectedDate < todayDate;
  const range = scheduleRange(task);
  if (!range) {
    if (dayPassed) return afterEnd(status, true);
    return ["progress", "paused", "pending", "missed"].includes(status) ? status : "upcoming";
  }
  const relativeNow = minutesOnSelectedDate(selectedDate, todayDate, nowMinutes);
  if (relativeNow >= range[1]) return afterEnd(status, dayPassed);
  if (status === "paused") return "paused";
  if (status === "progress") return "progress";
  if (relativeNow >= range[0]) return "now";
  return "upcoming";
};

// The task whose time slot is running right now (a task the user started wins over one they did not).
export const currentScheduledTask = (tasks, selectedDate, todayDate, nowMinutes) => {
  const relativeNow = minutesOnSelectedDate(selectedDate, todayDate, nowMinutes);
  return [...tasks]
    .filter(task => {
      const range = scheduleRange(task);
      const state = taskTimeState(task, selectedDate, todayDate, nowMinutes);
      return range && relativeNow >= range[0] && (state === "progress" || state === "now");
    })
    .sort((a, b) => (taskTimeState(a, selectedDate, todayDate, nowMinutes) === "progress" ? 0 : 1) - (taskTimeState(b, selectedDate, todayDate, nowMinutes) === "progress" ? 0 : 1)
      || scheduleRange(a)[0] - scheduleRange(b)[0])[0] || null;
};

// One place that decides the status of every task, so Overview and Daily tracker always agree.
export const resolveTaskStates = (tasks, selectedDate, todayDate, nowMinutes) => {
  const states = new Map(tasks.map(task => [task.id, taskTimeState(task, selectedDate, todayDate, nowMinutes)]));
  const current = currentScheduledTask(tasks, selectedDate, todayDate, nowMinutes);
  let next = null;
  if (selectedDate === todayDate) {
    next = tasks
      .filter(task => states.get(task.id) === "upcoming" && scheduleRange(task) && scheduleRange(task)[0] > nowMinutes)
      .sort((a, b) => scheduleRange(a)[0] - scheduleRange(b)[0])[0] || null;
    if (next) states.set(next.id, "next");
  }
  return { states, current, next };
};

export const groupOverlaps = tasks => {
  const groups = [];
  let group = null, groupEnd = -1;
  [...tasks].sort((a, b) => (scheduleRange(a)?.[0] ?? Infinity) - (scheduleRange(b)?.[0] ?? Infinity)).forEach(task => {
    const range = isActive(task) ? scheduleRange(task) : null;
    if (range && group && range[0] < groupEnd) { group.push(task); groupEnd = Math.max(groupEnd, range[1]); }
    else { group = [task]; groups.push(group); groupEnd = range?.[1] ?? -1; }
  });
  return groups;
};

export const scheduleGap = (previousEnd, nextStart) =>
  previousEnd != null && nextStart != null && nextStart > previousEnd
    ? { start: previousEnd, end: nextStart, minutes: nextStart - previousEnd }
    : null;

// How many unfinished tasks are "pending" (can still be done) and "not completed" (day over / chosen by the user).
export const unfinishedCounts = (tasks, selectedDate, todayDate, nowMinutes) => {
  let pending = 0, missed = 0;
  tasks.forEach(task => {
    const state = taskTimeState(task, selectedDate, todayDate, nowMinutes);
    if (state === "pending") pending++; else if (state === "missed") missed++;
  });
  return { pending, missed };
};
