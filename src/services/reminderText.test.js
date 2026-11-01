import test from "node:test";
import assert from "node:assert/strict";
import { pickPreviewTask, reminderContent } from "./reminderText.js";

test("reminder title is exactly the task name and the body carries timing", () => {
  const c = reminderContent({ name: "JavaScript study", start: "12:00", end: "14:00", description: "Learn closures" }, 5);
  assert.equal(c.title, "JavaScript study");
  assert.equal(c.body, "Starts in 5 min \u00B7 12:00\u201314:00 \u00B7 Learn closures");
});

test("a reminder at the start time says Starting now and skips missing parts", () => {
  assert.equal(reminderContent({ name: "Gym", start: "07:30" }, 0).body, "Starting now \u00B7 07:30");
  assert.equal(reminderContent({ name: "  " }, 0).title, "Untitled task");
});

test("no garbled characters are produced", () => {
  const c = reminderContent({ name: "Plan", start: "09:00", end: "10:00", description: "x" }, 10);
  assert.ok(!/[\u00C3\u00C2\u00E2]/.test(c.title + c.body));
});

test("preview task is the next upcoming timed task of the day", () => {
  const tasks = [
    { name: "Done", start: "08:00", status: "completed" },
    { name: "Later", start: "17:00" },
    { name: "Soon", start: "13:30" },
    { name: "Flexible" },
  ];
  const pick = pickPreviewTask(tasks, 13 * 60 + 10);
  assert.equal(pick.task.name, "Soon");
  assert.equal(pick.minutesLeft, 20);
  assert.equal(pickPreviewTask([{ name: "Flexible" }], 600), null);
  // nothing left today -> falls back to the first timed task of the day
  assert.equal(pickPreviewTask(tasks, 20 * 60).task.name, "Soon");
});
