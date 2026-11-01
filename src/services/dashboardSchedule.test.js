import test from "node:test";
import assert from "node:assert/strict";
import { currentScheduledTask, groupOverlaps, minutesOnSelectedDate, resolveTaskStates, scheduleGap, unfinishedCounts, scheduleRange, taskTimeState } from "./dashboardSchedule.js";

const today = "2026-10-30";
const task = (overrides = {}) => ({ id: "t1", start: "10:00", end: "11:00", status: "upcoming", ...overrides });

test("a running slot is \"not started\" until the user starts it, then it ends as pending the same day", () => {
  assert.equal(taskTimeState(task(), today, today, 9 * 60 + 42), "upcoming");
  assert.equal(taskTimeState(task(), today, today, 10 * 60 + 18), "now");
  assert.equal(taskTimeState(task({ status: "progress" }), today, today, 10 * 60 + 18), "progress");
  assert.equal(taskTimeState(task(), today, today, 11 * 60), "pending");
  assert.equal(taskTimeState(task({ status: "progress" }), today, today, 11 * 60), "pending");
});

test("saved completion is preserved and the user's own choice is respected after the end", () => {
  assert.equal(taskTimeState(task({ status: "completed" }), today, today, 12 * 60), "completed");
  assert.equal(taskTimeState(task({ status: "paused" }), today, today, 12 * 60), "pending");
  assert.equal(taskTimeState(task({ status: "missed" }), today, today, 12 * 60), "missed");
  assert.equal(taskTimeState(task({ status: "pending" }), "2026-10-29", today, 12 * 60), "pending");
});

test("past and future selected dates use their own calendar day", () => {
  assert.equal(taskTimeState(task(), "2026-10-29", today, 9 * 60), "missed");
  assert.equal(taskTimeState(task(), "2026-10-31", today, 12 * 60), "upcoming");
});

test("unfinished tasks of a finished day become not completed", () => {
  assert.equal(taskTimeState(task({ status: "progress" }), "2026-10-29", today, 9 * 60), "missed");
  assert.equal(taskTimeState(task({ start: "", end: "" }), "2026-10-29", today, 9 * 60), "missed");
  assert.equal(taskTimeState(task({ start: "", end: "" }), today, today, 9 * 60), "upcoming");
});

test("only the first task after now is \"next\"; the ones after it stay upcoming; earlier unfinished ones are pending", () => {
  const tasks = [
    task({ id: "a", start: "08:00", end: "09:00" }),
    task({ id: "b", start: "09:30", end: "10:30" }),
    task({ id: "c", start: "11:00", end: "12:00" }),
    task({ id: "d", start: "13:00", end: "14:00" }),
  ];
  const { states, current, next } = resolveTaskStates(tasks, today, today, 10 * 60);
  assert.equal(current.id, "b");
  assert.equal(next.id, "c");
  assert.deepEqual(tasks.map(t => states.get(t.id)), ["pending", "now", "next", "upcoming"]);
  const other = resolveTaskStates(tasks, "2026-10-31", today, 10 * 60);
  assert.equal(other.next, null);
  assert.deepEqual(tasks.map(t => other.states.get(t.id)), ["upcoming", "upcoming", "upcoming", "upcoming"]);
});

test("current task is selected from real overlapping schedule data", () => {
  const tasks = [task({ id: "later", start: "10:15", end: "10:45" }), task({ id: "first" })];
  assert.equal(currentScheduledTask(tasks, today, today, 10 * 60 + 20).id, "first");
  assert.equal(currentScheduledTask(tasks, "2026-10-31", today, 10 * 60), null);
});

test("positive gaps are reported and overlaps never become free-time gaps", () => {
  assert.deepEqual(scheduleGap(14 * 60, 14 * 60 + 15), { start: 840, end: 855, minutes: 15 });
  assert.equal(scheduleGap(14 * 60 + 30, 14 * 60 + 15), null);
  assert.equal(scheduleGap(14 * 60, 14 * 60), null);
});

test("overlapping intervals are grouped, while non-overlapping intervals remain separate", () => {
  const groups = groupOverlaps([
    task({ id: "a", start: "12:00", end: "14:00" }),
    task({ id: "b", start: "13:45", end: "14:15" }),
    task({ id: "c", start: "14:30", end: "15:00" }),
  ]);
  assert.deepEqual(groups.map(group => group.map(item => item.id)), [["a", "b"], ["c"]]);
});

test("cross-midnight ranges and ongoing overnight tasks are handled", () => {
  const overnight = task({ start: "23:30", end: "00:30" });
  assert.deepEqual(scheduleRange(overnight), [1410, 1470]);
  assert.equal(taskTimeState(overnight, "2026-10-29", today, 20), "now");
  assert.equal(currentScheduledTask([overnight], "2026-10-29", today, 20).id, "t1");
  assert.equal(minutesOnSelectedDate("2026-10-29", today, 20), 1460);
  assert.equal(taskTimeState(overnight, today, today, 23 * 60 + 45), "now");
});

test("flexible or invalid times have no fabricated time range", () => {
  assert.equal(scheduleRange(task({ start: "Flexible", end: "" })), null);
  assert.equal(taskTimeState(task({ start: "invalid" }), today, today, 12 * 60), "upcoming");
});

test("unfinished counts split pending (same day) from not completed (finished day)", () => {
  const tasks = [task({ id: "a", start: "08:00", end: "09:00" }), task({ id: "b", start: "09:00", end: "10:00", status: "completed" }), task({ id: "c", start: "13:00", end: "14:00" })];
  assert.deepEqual(unfinishedCounts(tasks, today, today, 11 * 60), { pending: 1, missed: 0 });
  assert.deepEqual(unfinishedCounts(tasks, "2026-10-29", today, 11 * 60), { pending: 0, missed: 2 });
});
