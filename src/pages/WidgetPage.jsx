import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import PlanGlance from "../components/PlanGlance";
import { isActive } from "../services/scheduling";
import { roadmapDayForDate } from "../utils/dates";

// Minimal full-screen view meant to be pinned to a phone home screen (as a shortcut) or kept open on a spare screen.
export default function WidgetPage({ state }) {
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(state.settings.startDate);
  const day = Math.max(1, Math.min(duration, today));
  const tasks = (state.days[day]?.tasks || []).filter(isActive);
  const done = tasks.filter(t => t.status === "completed").length;
  return <main className="widget-page">
    <header className="widget-head"><Link to="/" className="widget-back"><ChevronLeft size={16} /> Open tracker</Link><div><strong>Day {day}</strong><span> of {duration}</span></div><div className="widget-today">{tasks.length ? `${done}/${tasks.length} done today` : "No tasks today"}</div></header>
    <PlanGlance state={state} compact title="Plan at a glance" />
  </main>;
}
