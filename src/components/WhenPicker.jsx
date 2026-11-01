import { CalendarDays, Repeat } from "lucide-react";
import { dayDate, formatDate, roadmapDayForDate } from "../utils/dates";

// Roadmap day number for a calendar date (YYYY-MM-DD) — the data model stores days, the UI works in dates.
export const dayFromDate = (startDate, value) => (value ? roadmapDayForDate(startDate, new Date(`${value}T00:00:00`)) : NaN);

// Validation + numbers for the picker. `mode` is "once" (one date) or "every" (that date through the end of the plan).
export function whenInfo({ startDate, duration, mode, date }) {
  const day = dayFromDate(startDate, date);
  const valid = Number.isInteger(day) && day >= 1 && day <= duration;
  return { day, valid, count: valid ? (mode === "every" ? duration - day + 1 : 1) : 0, planStart: dayDate(startDate, 1), planEnd: dayDate(startDate, duration) };
}

const longDate = value => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// "When" control used by Add task (Daily tracker) and Add topic (Learning roadmap): pick a date, or repeat every day.
export default function WhenPicker({ mode, onMode, date, onDate, startDate, duration, allowEvery = true, label = "When" }) {
  const info = whenInfo({ startDate, duration, mode, date });
  const hint = !info.valid
    ? `Pick a date between ${formatDate(info.planStart)} and ${formatDate(info.planEnd)}.`
    : mode === "every"
      ? `Added to ${info.count} day${info.count === 1 ? "" : "s"}: ${formatDate(date)} to ${formatDate(info.planEnd)}, the last day of your ${duration}-day plan.`
      : `${longDate(date)} (roadmap day ${info.day}).`;
  return <div className="when-picker">
    <span className="when-label">{label}</span>
    {allowEvery && <div className="when-seg" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={mode === "once"} className={mode === "once" ? "on" : ""} onClick={() => onMode("once")}><CalendarDays size={14} /> On a date</button>
      <button type="button" role="radio" aria-checked={mode === "every"} className={mode === "every" ? "on" : ""} onClick={() => onMode("every")}><Repeat size={14} /> Every day</button>
    </div>}
    <label className="when-date">{mode === "every" ? "Starting from" : "Date"}
      <input type="date" required min={info.planStart} max={info.planEnd} value={date || ""} onChange={e => onDate(e.target.value)} />
    </label>
    <small className={`when-hint ${info.valid ? "" : "bad"}`}>{hint}</small>
  </div>;
}
