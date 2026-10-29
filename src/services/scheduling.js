// Pure scheduling helpers (no React, no storage). Everything here takes plain data and returns new data,
// so it is easy to reason about and to test.
import { makeId } from "../utils/dates";

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/* ---------- time helpers ---------- */
export const toMin = (time) => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(String(time))) return null;
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (minutes) => {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
// [startMinute, endMinute] or null for flexible tasks (no start time). Missing/invalid end => 30 minutes.
export const taskRange = (task) => {
  const start = toMin(task?.start);
  if (start === null) return null;
  let end = toMin(task?.end);
  if (end === null || end <= start) end = Math.min(24 * 60, start + 30);
  return [start, end];
};
export const overlaps = (a, b) => {
  const ra = taskRange(a), rb = taskRange(b);
  return !!ra && !!rb && ra[0] < rb[1] && rb[0] < ra[1];
};
export const isActive = (task) => task && task.status !== "skipped";
export const findConflicts = (tasks, candidate) =>
  (tasks || []).filter((t) => t.id !== candidate.id && isActive(t) && isActive(candidate) && overlaps(t, candidate));
export const timeLabel = (task) => (task.start ? `${task.start}${task.end ? `–${task.end}` : ""}` : "Flexible");

/* ---------- priority + overlap kind ---------- */
export const PRIORITY_LABEL = { high: "High priority", normal: "Normal", low: "Low" };
export const priorityOf = (task) => task?.priority || "normal";
export const priorityRank = (task) => ({ high: 0, normal: 1, low: 2 }[priorityOf(task)] ?? 1);
// How task `a` relates to task `b` in time: same | inside (a within b) | contains (b within a) | partial
export const overlapKind = (a, b) => {
  const ra = taskRange(a), rb = taskRange(b);
  if (!ra || !rb) return null;
  if (ra[0] === rb[0] && ra[1] === rb[1]) return "same";
  if (ra[0] >= rb[0] && ra[1] <= rb[1]) return "inside";
  if (rb[0] >= ra[0] && rb[1] <= ra[1]) return "contains";
  return "partial";
};
export const overlapText = (kind) => ({
  same: "Exactly the same time",
  inside: "Your task falls inside this task’s time",
  contains: "This task falls inside your task’s time",
  partial: "Partly overlaps",
}[kind] || "Overlaps");

/* Sort by start time (flexible tasks last) and group tasks whose times overlap into clusters. */
export const sortByTime = (tasks) =>
  [...tasks].sort((a, b) => {
    const ra = taskRange(a), rb = taskRange(b);
    if (!ra && !rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return ra[0] - rb[0] || ra[1] - rb[1];
  });
export const clusterTasks = (tasks) => {
  const clusters = [];
  let current = null, currentEnd = -1;
  for (const task of sortByTime(tasks)) {
    const range = isActive(task) ? taskRange(task) : null;
    if (range && current && range[0] < currentEnd) {
      current.push(task);
      currentEnd = Math.max(currentEnd, range[1]);
    } else {
      current = [task];
      clusters.push(current);
      currentEnd = range ? range[1] : -1;
    }
  }
  clusters.forEach((c) => c.sort((x, y) => priorityRank(x) - priorityRank(y)));
  return clusters;
};

/* ---------- calendar helpers ---------- */
export const weekdayOf = (startDate, day) => (new Date(`${startDate}T12:00:00`).getDay() + day - 1) % 7;

// Same occurrence rules the recurring-schedule form always used.
export const ruleOccurs = (rule, day, startDate) => {
  if (day < rule.startDay || day > rule.endDay) return false;
  if (rule.recurrence === "daily") return true;
  if (rule.recurrence === "custom") return (day - rule.startDay) % 2 === 0;
  if (rule.recurrence === "weekly") return (rule.weekdays || []).includes(weekdayOf(startDate, day));
  if (rule.recurrence === "once") return day === rule.startDay;
  return false;
};

const hasContent = (log) => !!(log?.note?.trim() || log?.url?.trim() || Number(log?.minutes) > 0);
export const isUnstarted = (task) =>
  (!task.status || ["upcoming", "ready", "pending"].includes(task.status)) && !(task.workLogs || []).some(hasContent);

/* ---------- recurring rules (existing feature) ---------- */
export function applyRule(days, rule, startDate) {
  const next = { ...days };
  let added = 0;
  for (let d = rule.startDay; d <= rule.endDay; d++) {
    if (!ruleOccurs(rule, d, startDate)) continue;
    const old = next[d] || { tasks: [] };
    const list = old.tasks || [];
    if (list.some((t) => t.scheduleId === rule.id)) continue;
    next[d] = { ...old, tasks: [...list, {
      id: makeId(), scheduleId: rule.id, name: rule.name, description: rule.description || "",
      start: rule.start, end: rule.end, status: "upcoming", required: true, workLogs: [], recurrence: rule.recurrence,
    }] };
    added++;
  }
  return { days: next, added };
}

/* ---------- imported timetables (same tasks on every chosen day) ---------- */
export const rowToTask = (row, timetable, rowKey) => ({
  id: makeId(), scheduleId: timetable.id, rowKey,
  name: row.name, description: row.description || "", start: row.start || "", end: row.end || "",
  flexible: !row.start, status: "upcoming", required: true, workLogs: [], recurrence: "timetable",
});
export const timetableDays = (timetable, startDate, duration) => {
  const out = [];
  for (let d = Math.max(1, timetable.startDay); d <= Math.min(duration, timetable.endDay); d++) {
    if ((timetable.weekdays || ALL_WEEKDAYS).includes(weekdayOf(startDate, d))) out.push(d);
  }
  return out;
};
// Adds missing tasks on the chosen days and removes this timetable's *not yet started* tasks on days that
// fell outside the chosen range. Started / completed tasks are never touched.
export function applyTimetable(days, timetable, startDate, duration) {
  const next = { ...days };
  const wanted = new Set(timetableDays(timetable, startDate, duration));
  let added = 0, removed = 0;
  const dayNumbers = new Set([...Object.keys(next).map(Number), ...wanted]);
  for (const d of dayNumbers) {
    const old = next[d] || { tasks: [] };
    let list = old.tasks || [];
    if (!wanted.has(d)) {
      const kept = list.filter((t) => !(t.scheduleId === timetable.id && isUnstarted(t)));
      if (kept.length !== list.length) { removed += list.length - kept.length; next[d] = { ...old, tasks: kept }; }
      continue;
    }
    const fresh = [];
    (timetable.rows || []).forEach((row) => {
      if (!list.some((t) => t.scheduleId === timetable.id && t.rowKey === row.key)) fresh.push(rowToTask(row, timetable, row.key));
    });
    if (fresh.length) { added += fresh.length; next[d] = { ...old, tasks: [...list, ...fresh] }; }
  }
  return { days: next, added, removed };
}
export function removeTimetableTasks(days, timetableId, onlyUnstarted = true) {
  const next = { ...days };
  let removed = 0;
  for (const [d, value] of Object.entries(next)) {
    const list = value?.tasks || [];
    const kept = list.filter((t) => !(t.scheduleId === timetableId && (!onlyUnstarted || isUnstarted(t))));
    if (kept.length !== list.length) { removed += list.length - kept.length; next[d] = { ...value, tasks: kept }; }
  }
  return { days: next, removed };
}

// Which existing tasks would clash if `rows` were placed on `dayList`? Returns [{day,row,with:[tasks]}].
export function previewConflicts(days, rows, dayList, ignoreScheduleId = null) {
  const out = [];
  for (const d of dayList) {
    const existing = (days[d]?.tasks || []).filter((t) => !ignoreScheduleId || t.scheduleId !== ignoreScheduleId);
    for (const row of rows) {
      const probe = { id: `probe-${row.key}`, start: row.start, end: row.end, status: "upcoming" };
      const hits = findConflicts(existing, probe);
      if (hits.length) out.push({ day: d, row, with: hits });
    }
  }
  return out;
}

/* ---------- learning roadmap -> tasks in free time slots ---------- */
function freeSlot(busy, minutes, windowStart, windowEnd) {
  const sorted = [...busy].sort((a, b) => a[0] - b[0]);
  let cursor = windowStart;
  for (const [bs, be] of sorted) {
    if (be <= cursor) continue;
    if (bs - cursor >= minutes) break;
    cursor = Math.max(cursor, be);
  }
  return cursor + minutes <= windowEnd ? cursor : null;
}

export function scheduleTopics({ topics, days, duration, startDay = 1, perDay = 2, minutes = 60, windowStart = "09:00", windowEnd = "21:00", roadmapId = null }) {
  const ws = toMin(windowStart) ?? 540, we = toMin(windowEnd) ?? 1260;
  const next = { ...days };
  const alreadyScheduled = new Set();
  Object.values(next).forEach((v) => (v?.tasks || []).forEach((t) => t.topicId && alreadyScheduled.add(t.topicId)));
  const pending = topics.filter((t) => !t.completed && !alreadyScheduled.has(t.id));
  // explicit-day topics keep their day (in day order); the rest are spread `perDay` per day from startDay
  const explicit = pending.filter((t) => Number(t.day) >= 1).sort((a, b) => Number(a.day) - Number(b.day));
  const loose = pending.filter((t) => !(Number(t.day) >= 1));
  const plan = [
    ...explicit.map((t) => ({ topic: t, target: Math.min(duration, Number(t.day)) })),
    ...loose.map((t, i) => ({ topic: t, target: startDay + Math.floor(i / Math.max(1, perDay)) })),
  ];
  const placedDay = {};
  let created = 0, moved = 0, skipped = 0;
  for (const { topic, target } of plan) {
    let d = Math.max(1, target), placed = false;
    while (d <= duration) {
      const old = next[d] || { tasks: [] };
      const busy = (old.tasks || []).filter(isActive).map(taskRange).filter(Boolean);
      const slot = freeSlot(busy, minutes, ws, we);
      if (slot !== null) {
        next[d] = { ...old, tasks: [...(old.tasks || []), {
          id: makeId(), name: topic.title, description: topic.description || topic.phase || "",
          start: fromMin(slot), end: fromMin(slot + minutes), status: "upcoming", required: true, workLogs: [],
          topicId: topic.id, roadmapId, source: "roadmap",
        }] };
        placedDay[topic.id] = d; created++; if (d !== target) moved++;
        placed = true; break;
      }
      d++;
    }
    if (!placed) skipped++;
  }
  return { days: next, created, moved, skipped, placedDay };
}
export const syncTopicTasks = (days, topicId, completed) => {
  const next = { ...days };
  for (const [d, value] of Object.entries(next)) {
    const list = value?.tasks || [];
    if (!list.some((t) => t.topicId === topicId)) continue;
    next[d] = { ...value, tasks: list.map((t) => t.topicId !== topicId ? t : completed
      ? { ...t, status: "completed", completedAt: t.completedAt || new Date().toISOString() }
      : (t.status === "completed" ? { ...t, status: "upcoming", completedAt: null } : t)) };
  }
  return next;
};

/* ---------- day lock: any day can be opened, but future days need an explicit unlock to be worked on ---------- */
export const isDayLocked = (day, today, unlockedDays = []) => day > today && !(unlockedDays || []).includes(day);

/* ---------- roadmap topic <-> task completion ---------- */
export const setTopicCompleted = (state, topicId, completed) => {
  const mark = (t) => t.id === topicId ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null } : t;
  return { ...state, roadmap: (state.roadmap || []).map(mark), roadmaps: (state.roadmaps || []).map((r) => ({ ...r, topics: (r.topics || []).map(mark) })) };
};

/* ---------- plan length ---------- */
export const MAX_PLAN_DAYS = 365;
// Timetables that were set to run "to the end of the plan" follow the plan when it gets longer.
export function extendTimetables(state, newDuration) {
  let days = state.days, count = 0;
  const schedules = (state.schedules || []).map((x) => {
    if (x.kind !== "timetable" || !x.toEnd) return x;
    const next = { ...x, endDay: newDuration };
    days = applyTimetable(days, next, state.settings.startDate, newDuration).days;
    count++;
    return next;
  });
  return { days, schedules, count };
}
export const countToEndTimetables = (state) => (state.schedules || []).filter((x) => x.kind === "timetable" && x.toEnd).length;
export function changeDuration(state, newDuration, extend = true) {
  const nd = Math.max(1, Math.min(MAX_PLAN_DAYS, Number(newDuration) || 60));
  const old = Number(state.settings.durationDays) || 60;
  let next = { ...state, settings: { ...state.settings, durationDays: nd } };
  if (extend && nd > old) {
    const ext = extendTimetables(next, nd);
    next = { ...next, days: ext.days, schedules: ext.schedules };
  }
  return next;
}
export const stateSizeKB = (state) => Math.round(JSON.stringify(state).length / 1024);

/* ---------- give old "Not on a day yet" roadmap topics a day, in their saved order ---------- */
export const isLooseTopic = (topic, duration) => !(Number(topic.day) >= 1) || Number(topic.day) > duration;
// Smallest topics-per-day that still fits inside the plan (e.g. 92 topics in a 60-day plan -> 2).
export const minTopicsPerDay = (count, startDay, duration) => Math.max(1, Math.ceil(count / Math.max(1, duration - startDay + 1)));
export function spreadTopicsAcrossDays(topics, { startDay = 1, perDay = 1, duration }) {
  const loose = topics.filter((t) => isLooseTopic(t, duration));
  const per = Math.max(perDay, minTopicsPerDay(loose.length, startDay, duration));
  const assign = {}, prev = {};
  loose.forEach((t, i) => {
    assign[t.id] = Math.min(duration, startDay + Math.floor(i / per));
    prev[t.id] = Number(t.day) >= 1 ? Number(t.day) : null;
  });
  const lastDay = loose.length ? Math.max(...Object.values(assign)) : startDay;
  return { assign, prev, count: loose.length, perDay: per, lastDay };
}

/* ---------- undo the most recent file import ---------- */
// Removes the tasks that import created (timetable tasks + day-specific tasks) unless they were already started,
// logged or completed. Returns the new days plus how many tasks were removed / kept.
export function undoImportTasks(days, imp) {
  const next = { ...days };
  let removed = 0, kept = 0;
  const mine = (t) => (imp.importId && t.importId === imp.importId) || (imp.timetableId && t.scheduleId === imp.timetableId);
  for (const [d, value] of Object.entries(next)) {
    const list = value?.tasks || [];
    const keep = list.filter((t) => !(mine(t) && isUnstarted(t)));
    kept += list.filter((t) => mine(t) && !isUnstarted(t)).length;
    if (keep.length !== list.length) { removed += list.length - keep.length; next[d] = { ...value, tasks: keep }; }
  }
  return { days: next, removed, kept };
}
