import { dayDate, formatDate } from "../utils/dates";
import { dayFromDate } from "./WhenPicker";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// A calendar-date input for places whose data is stored as a roadmap day number (1..duration).
// The user picks a date; the component converts it to the day number (clamped to the allowed range) and shows both.
export default function DayDateField({ label, day, onDay, startDate, duration, minDay = 1, maxDay = duration }) {
  const lo = clamp(minDay, 1, duration), hi = clamp(maxDay, lo, duration);
  const current = clamp(Number(day) || lo, lo, hi);
  const date = dayDate(startDate, current);
  return <label className="day-date-field">{label}
    <input type="date" min={dayDate(startDate, lo)} max={dayDate(startDate, hi)} value={date}
      onChange={e => { const d = dayFromDate(startDate, e.target.value); if (Number.isInteger(d)) onDay(clamp(d, lo, hi)); }} />
    <small className="when-hint">{formatDate(date)} (roadmap day {current})</small>
  </label>;
}
